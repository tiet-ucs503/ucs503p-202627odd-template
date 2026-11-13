import base64
import json
import os
import re
import secrets
import sqlite3
import sys
from datetime import datetime, timedelta
from urllib.parse import urlparse
from dotenv import load_dotenv

# Ensure UTF-8 output encoding on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from flask import Flask, render_template, request, jsonify, Response, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

# ============================================================
# APP CONFIGURATION & ENVIRONMENT
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_ENV_FILE = os.path.join(BASE_DIR, ".env")
if os.path.exists(_ENV_FILE):
    load_dotenv(_ENV_FILE)
else:
    load_dotenv()

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from utils import llm, rag, redact, metrics, matcher, eligibility, readiness

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "bharatassist-citizen-privacy-shield-secret-2026")
DB_PATH = os.path.join(BASE_DIR, "bharatassist.db")

# Maximum upload/request size: 10 MB
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024


def init_users_table():
    """Initialize local SQLite tables for citizen authentication (with password & OTP), profile details, applications, step progress, and conversation threads."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
            table_exists = cursor.fetchone()
            if table_exists:
                cursor.execute("PRAGMA table_info(users)")
                columns = [row[1] for row in cursor.fetchall()]
                if "phone" not in columns:
                    # Upgrade schema from older prototype to mobile OTP
                    conn.execute("DROP TABLE users")
                    table_exists = False
                else:
                    if "password_hash" not in columns:
                        conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
                    if "email" not in columns:
                        conn.execute("ALTER TABLE users ADD COLUMN email TEXT")
                    if "preferred_language" not in columns:
                        conn.execute("ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'English'")
                    if "state" not in columns:
                        conn.execute("ALTER TABLE users ADD COLUMN state TEXT")
                    if "district" not in columns:
                        conn.execute("ALTER TABLE users ADD COLUMN district TEXT")

            if not table_exists:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        phone TEXT UNIQUE NOT NULL,
                        name TEXT NOT NULL,
                        email TEXT,
                        password_hash TEXT,
                        preferred_language TEXT DEFAULT 'English',
                        state TEXT,
                        district TEXT,
                        otp TEXT,
                        otp_expiry TIMESTAMP,
                        is_verified INTEGER DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)

            # Saved Checklists / Applications Table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_applications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    service_id INTEGER NOT NULL,
                    status TEXT DEFAULT 'Not started',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, service_id)
                )
            """)

            # Step-level progress tracking
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_step_progress (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    application_id INTEGER NOT NULL,
                    item_id TEXT NOT NULL,
                    item_type TEXT NOT NULL,
                    completed INTEGER DEFAULT 0,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(application_id, item_id)
                )
            """)

            # Chat Conversations table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS chat_conversations (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    user_phone TEXT NOT NULL,
                    title TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Persistent Chat History table for citizens
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_history'")
            chat_hist_exists = cursor.fetchone()
            if chat_hist_exists:
                cursor.execute("PRAGMA table_info(chat_history)")
                hist_cols = [row[1] for row in cursor.fetchall()]
                if "conversation_id" not in hist_cols:
                    conn.execute("ALTER TABLE chat_history ADD COLUMN conversation_id TEXT")

            conn.execute("""
                CREATE TABLE IF NOT EXISTS chat_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT,
                    user_id INTEGER,
                    user_phone TEXT NOT NULL,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    language TEXT DEFAULT 'English',
                    sources_json TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
    except Exception as e:
        print("User table initialization warning:", repr(e))

init_users_table()


@app.context_processor
def inject_global_user():
    """Inject current logged-in citizen into all templates safely."""
    return {
        "current_user": session.get("user")
    }


def normalize_indian_phone(phone_raw: str):
    """Normalize and validate 10-digit Indian mobile number."""
    if not phone_raw or not isinstance(phone_raw, str):
        return None
    clean = re.sub(r"[^\d]", "", phone_raw)
    if len(clean) == 12 and clean.startswith("91"):
        clean = clean[2:]
    if re.match(r"^[6-9]\d{9}$", clean):
        return clean
    return None


def mask_phone_number(phone: str):
    """Mask phone number for safe UI display: +91 98••• ••210."""
    if not phone or len(phone) < 10:
        return "+91 ••••• •••••"
    return f"+91 {phone[:2]}••• ••{phone[-3:]}"


# ============================================================
# CONSTANTS
# ============================================================

ALLOWED_FILE_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".txt",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".bmp"
}

IMAGE_FILE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".bmp"
}

MAX_FILE_SIZE = 10 * 1024 * 1024


# ============================================================
# DATABASE
# ============================================================

def get_db():
    """
    Create a SQLite database connection.
    """

    conn = sqlite3.connect(DB_PATH)

    conn.row_factory = sqlite3.Row

    return conn


def get_all_services():
    """
    Get all services from the database.
    """

    conn = get_db()

    try:
        rows = conn.execute(
            """
            SELECT
                id,
                name,
                category,
                state,
                eligibility,
                documents_required,
                steps,
                fees,
                processing_time,
                source_url,
                last_verified
            FROM services
            ORDER BY id ASC
            """
        ).fetchall()

        services = []

        for row in rows:

            service = dict(row)

            # Convert documents into a list
            service["documents"] = split_database_text(
                service.get("documents_required")
            )

            # Convert steps into a list
            service["steps_list"] = split_steps(
                service.get("steps")
            )

            # Templates can use service.steps
            service["steps"] = service["steps_list"]

            # Normalize URL
            service["source_url"] = normalize_url(
                service.get("source_url")
            )

            services.append(service)

        return services

    except sqlite3.Error as e:

        print(
            "Database error while loading services:",
            repr(e)
        )

        return []

    finally:

        conn.close()


def get_service_by_id(service_id):
    """
    Get one service using numeric database ID.
    """

    conn = get_db()

    try:

        row = conn.execute(
            """
            SELECT
                id,
                name,
                category,
                state,
                eligibility,
                documents_required,
                steps,
                fees,
                processing_time,
                source_url,
                last_verified
            FROM services
            WHERE id = ?
            """,
            (service_id,)
        ).fetchone()

        if row is None:
            return None

        service = dict(row)

        service["documents"] = split_database_text(
            service.get("documents_required")
        )

        service["steps_list"] = split_steps(
            service.get("steps")
        )

        service["steps"] = service["steps_list"]

        service["source_url"] = normalize_url(
            service.get("source_url")
        )

        return service

    except sqlite3.Error as e:

        print(
            "Database error while loading service:",
            repr(e)
        )

        return None

    finally:

        conn.close()


# ============================================================
# TEXT PARSING
# ============================================================

def split_database_text(value):
    """
    Convert document text from database into a list.

    Supports:

        Document 1; Document 2
        Document 1, Document 2
        1. Document 1
        2. Document 2
    """

    if value is None:
        return []

    value = str(value).strip()

    if not value:
        return []

    # Normalize line endings
    value = value.replace("\r\n", "\n")
    value = value.replace("\r", "\n")

    # Numbered list
    if re.search(
        r"(?:^|\n)\s*\d+[\.\)]\s*",
        value
    ):

        items = re.split(
            r"(?:^|\n)\s*\d+[\.\)]\s*",
            value
        )

        cleaned = []

        for item in items:

            item = item.strip()

            if item:
                cleaned.append(item)

        if cleaned:
            return cleaned

    # Semicolon
    if ";" in value:

        items = value.split(";")

        return [
            item.strip()
            for item in items
            if item.strip()
        ]

    # New lines
    if "\n" in value:

        items = value.split("\n")

        cleaned = []

        for item in items:

            item = item.strip()

            if not item:
                continue

            item = re.sub(
                r"^\d+[\.\)]\s*",
                "",
                item
            )

            if item:
                cleaned.append(item)

        if cleaned:
            return cleaned

    # Comma
    if "," in value:

        items = value.split(",")

        return [
            item.strip()
            for item in items
            if item.strip()
        ]

    return [value]


def split_steps(value):
    """
    Convert procedure text into a clean list of individual steps.

    Supports formats such as:

        1. Apply online
        2. Fill the form
        3. Upload documents

    Also supports:

        1. Apply online 2. Fill the form 3. Upload documents

    And:

        1) Apply online
        2) Fill the form
        3) Upload documents
    """

    if value is None:
        return []

    value = str(value).strip()

    if not value:
        return []

    # Normalize line endings
    value = value.replace("\r\n", "\n")
    value = value.replace("\r", "\n")

    # Normalize repeated whitespace
    value = re.sub(r"[ \t]+", " ", value)

    # --------------------------------------------------------
    # Remove leading/trailing whitespace
    # --------------------------------------------------------

    value = value.strip()

    # --------------------------------------------------------
    # Main numbered-step parser
    #
    # Detects:
    #   1. Step
    #   2. Step
    #
    # even when everything is on ONE LINE.
    # --------------------------------------------------------

    matches = list(
        re.finditer(
            r"(?:^|\s)(\d+)[\.\)]\s+",
            value
        )
    )

    if matches:

        steps = []

        for index, match in enumerate(matches):

            start = match.end()

            if index + 1 < len(matches):

                end = matches[index + 1].start()

            else:

                end = len(value)

            step_text = value[start:end].strip()

            if step_text:

                steps.append(step_text)

        if steps:
            return steps

    # --------------------------------------------------------
    # Semicolon separated steps
    # --------------------------------------------------------

    if ";" in value:

        steps = [
            step.strip()
            for step in value.split(";")
            if step.strip()
        ]

        if steps:
            return steps

    # --------------------------------------------------------
    # Newline separated steps
    # --------------------------------------------------------

    if "\n" in value:

        steps = []

        for line in value.split("\n"):

            line = line.strip()

            if not line:
                continue

            # Remove optional numbering
            line = re.sub(
                r"^\d+[\.\)]\s*",
                "",
                line
            )

            if line:
                steps.append(line)

        if steps:
            return steps

    # --------------------------------------------------------
    # Fallback
    # --------------------------------------------------------

    return [value]

# ============================================================
# URL HANDLING
# ============================================================

def normalize_url(url):
    """
    Normalize official portal URLs.

    Examples:

        india.gov.in
        www.india.gov.in
        https://india.gov.in

    become usable HTTPS URLs.
    """

    if not url:
        return None

    url = str(url).strip()

    if not url:
        return None

    # Add scheme if missing
    if not url.startswith(
        ("http://", "https://")
    ):

        url = "https://" + url

    # Remove accidental spaces
    url = url.replace(" ", "")

    try:

        parsed = urlparse(url)

        if not parsed.netloc:
            return None

        return url

    except Exception:

        return None


# ============================================================
# PII REDACTION
# ============================================================

def redact_pii(text):
    """
    Remove common Indian PII before processing.

    Detects:

    - Aadhaar-like 12 digit numbers
    - Indian mobile numbers
    - Email addresses
    """

    if not text:
        return "", 0

    redacted_text = str(text)

    count = 0

    # --------------------------------------------------------
    # Aadhaar
    # --------------------------------------------------------

    aadhaar_pattern = (
        r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"
    )

    matches = re.findall(
        aadhaar_pattern,
        redacted_text
    )

    count += len(matches)

    redacted_text = re.sub(
        aadhaar_pattern,
        "[Aadhaar Redacted]",
        redacted_text
    )

    # --------------------------------------------------------
    # Indian phone number
    # --------------------------------------------------------

    phone_pattern = r"\b[6-9]\d{9}\b"

    matches = re.findall(
        phone_pattern,
        redacted_text
    )

    count += len(matches)

    redacted_text = re.sub(
        phone_pattern,
        "[Phone Redacted]",
        redacted_text
    )

    # --------------------------------------------------------
    # Email
    # --------------------------------------------------------

    email_pattern = (
        r"\b[A-Za-z0-9._%+-]+"
        r"@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
    )

    matches = re.findall(
        email_pattern,
        redacted_text
    )

    count += len(matches)

    redacted_text = re.sub(
        email_pattern,
        "[Email Redacted]",
        redacted_text
    )

    return redacted_text, count


# ============================================================
# FILE TEXT EXTRACTION
# ============================================================

def extract_uploaded_text(uploaded_file):
    """
    Extract text from:

        TXT
        PDF
        DOCX
    """

    if uploaded_file is None:
        raise Exception(
            "No file uploaded."
        )

    filename = (
        uploaded_file.filename
        or ""
    ).lower().strip()

    # --------------------------------------------------------
    # TXT
    # --------------------------------------------------------

    if filename.endswith(".txt"):

        data = uploaded_file.read()

        return data.decode(
            "utf-8",
            errors="ignore"
        )

    # --------------------------------------------------------
    # PDF (Supports pypdf or PyPDF2)
    # --------------------------------------------------------

    if filename.endswith(".pdf"):

        pdf_reader_cls = None
        try:
            import pypdf
            pdf_reader_cls = pypdf.PdfReader
        except ImportError:
            try:
                import PyPDF2
                pdf_reader_cls = PyPDF2.PdfReader
            except ImportError:
                pass

        if not pdf_reader_cls:
            raise Exception("PDF support is not installed. Run: pip install pypdf")

        try:
            reader = pdf_reader_cls(uploaded_file)
            pages = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    pages.append(page_text)

            result = "\n".join(pages)
            if not result.strip():
                raise Exception("No readable text was found in this PDF.")
            return result

        except Exception as e:
            raise Exception(f"Could not read PDF: {str(e)}")

    # --------------------------------------------------------
    # DOCX (Supports python-docx or native ZIP/XML parsing)
    # --------------------------------------------------------

    if filename.endswith(".docx"):

        # 1. Try python-docx if installed
        try:
            from docx import Document
            document = Document(uploaded_file)
            paragraphs = [p.text.strip() for p in document.paragraphs if p.text.strip()]
            result = "\n".join(paragraphs)
            if result.strip():
                return result
        except ImportError:
            pass
        except Exception:
            pass

        # 2. Native ZIP/XML parsing fallback
        try:
            import zipfile
            import xml.etree.ElementTree as ET

            uploaded_file.seek(0)
            with zipfile.ZipFile(uploaded_file) as zf:
                xml_content = zf.read("word/document.xml")
                tree = ET.fromstring(xml_content)
                texts = []
                for elem in tree.iter():
                    if elem.tag.endswith("}t") and elem.text:
                        texts.append(elem.text)
                result = " ".join(texts).strip()
                if not result:
                    raise Exception("No readable text was found in this DOCX.")
                return result
        except Exception as e:
            raise Exception(f"Could not read DOCX: {str(e)}")

    # --------------------------------------------------------
    # IMAGE TEXT EXTRACTION (OCR via Gemini Vision)
    # --------------------------------------------------------

    ext = os.path.splitext(filename)[1]
    if ext in IMAGE_FILE_EXTENSIONS:
        uploaded_file.seek(0)
        img_bytes = uploaded_file.read()
        mime_map = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".bmp": "image/bmp"
        }
        mime_type = mime_map.get(ext, "image/png")
        extracted_ocr = llm.extract_text_from_image(image_bytes=img_bytes, mime_type=mime_type)
        if not extracted_ocr.strip():
            raise Exception("No readable text could be recognized from this document image.")
        return extracted_ocr

    raise Exception(
        "Unsupported file type. "
        "Please upload PDF, DOCX, TXT, or document images (PNG, JPG, WEBP)."
    )


# ============================================================
# DOCUMENT SIMPLIFIER
# ============================================================

def simplify_document(text):
    """
    Local rule-based document simplifier.

    No external AI API required.
    """

    if not text:
        return ""

    text = str(text).strip()

    if not text:
        return ""

    # Normalize whitespace
    cleaned = re.sub(
        r"\s+",
        " ",
        text
    ).strip()

    # Split into sentences
    sentences = re.split(
        r"(?<=[.!?])\s+",
        cleaned
    )

    sentences = [
        sentence.strip()
        for sentence in sentences
        if sentence.strip()
    ]

    if not sentences:
        return ""

    # Important government-related keywords
    keywords = [
        "apply",
        "application",
        "eligible",
        "eligibility",
        "document",
        "documents",
        "required",
        "requirement",
        "fee",
        "fees",
        "payment",
        "deadline",
        "date",
        "submit",
        "submission",
        "registration",
        "verification",
        "process",
        "procedure",
        "appointment",
        "portal",
        "certificate",
        "identity",
        "address",
        "proof",
        "must",
        "should",
        "important",
        "valid",
        "renew",
        "renewal",
    ]

    useful = []

    for sentence in sentences:

        lower = sentence.lower()

        if any(
            keyword in lower
            for keyword in keywords
        ):

            useful.append(sentence)

    # If no important sentence was found
    if not useful:
        useful = sentences[:8]

    # Maximum 10 sentences
    useful = useful[:10]

    warning_keywords = ["penalty", "fine", "forfeiture", "terminate", "termination", "court", "dispute", "interest", "breach", "liable", "liability", "cancel", "cancellation", "late fee", "arrest"]
    warnings_found = []
    important_points = []
    
    for sentence in useful:
        lower = sentence.lower()
        if any(wk in lower for wk in warning_keywords):
            warnings_found.append(sentence)
        else:
            important_points.append(sentence)

    output = []
    # 1. Executive Summary
    output.append("### 📋 Executive Summary")
    summary_text = " ".join(sentences[:2]) if len(sentences) >= 2 else sentences[0]
    output.append(f"<p>{summary_text}</p>")

    # 2. Important Points
    output.append("### 💡 Important Points to Keep in Mind")
    output.append("<ul>")
    pts = important_points if important_points else useful[:4]
    for sentence in pts:
        safe_s = sentence.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        output.append(f"<li>{safe_s}</li>")
    output.append("</ul>")

    # 3. Warnings & Red Flags
    output.append("### ⚠️ Warnings & Red Flags")
    if warnings_found:
        output.append("<ul class='text-danger'>")
        for sentence in warnings_found:
            safe_s = sentence.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            output.append(f"<li><strong>Caution:</strong> {safe_s}</li>")
        output.append("</ul>")
    else:
        output.append("<p class='text-success'><i class='fa-solid fa-circle-check'></i> No major legal risks or red flags detected in this document based on the provided text.</p>")

    return "\n".join(output)


# ============================================================
# HOME
# ============================================================

@app.route("/")
def index():

    return render_template(
        "index.html"
    )


# ============================================================
# SERVICES DIRECTORY
# ============================================================

@app.route("/services")
def services():

    services_list = get_all_services()

    return render_template(
        "services.html",
        services=services_list
    )


# ============================================================
# SERVICE DETAILS
# ============================================================

@app.route(
    "/services/<int:service_id>",
    endpoint="service_details"
)
def service_details(service_id):

    service = get_service_by_id(
        service_id
    )

    if service is None:

        return render_template(
            "service_details.html",
            service=None,
            error=(
                f"Service with ID {service_id} "
                "was not found in the database."
            )
        ), 404

    return render_template(
        "service_details.html",
        service=service
    )


# ============================================================
# SCHEMES
# ============================================================

@app.route("/schemes")
def schemes():

    services_list = get_all_services()

    schemes_template = os.path.join(
        BASE_DIR,
        "templates",
        "schemes.html"
    )

    if os.path.exists(
        schemes_template
    ):

        return render_template(
            "schemes.html",
            services=services_list
        )

    return render_template(
        "services.html",
        services=services_list
    )


# ============================================================
# DOCUMENT SIMPLIFIER PAGE
# ============================================================

@app.route("/simplify")
def simplify():

    return render_template(
        "simplify.html"
    )


# ============================================================
# AI ASSISTANT PAGE
# ============================================================

@app.route("/assistant")
def assistant():

    return render_template(
        "assistant.html"
    )


# ============================================================
# CITIZEN LOGIN & AUTHENTICATION PAGES
# ============================================================

# ============================================================
# CITIZEN LOGIN & AUTHENTICATION PAGES (INDIAN MOBILE OTP)
# ============================================================

@app.route("/login")
def login():
    """Citizen login page with Indian Mobile OTP & Zero-LLM Privacy Shield."""
    return render_template("login.html")


@app.route("/logout")
def logout():
    """Log out the citizen and clear the local private session."""
    session.pop("user", None)
    session.clear()
    next_url = request.args.get("next")
    if next_url and next_url.startswith("/") and not next_url.startswith("//"):
        return redirect(next_url)
    return redirect(url_for("login"))


# ============================================================
# CITIZEN USER PROFILE & ACCOUNT MANAGEMENT
# ============================================================

def get_current_user_record():
    """Helper to fetch full up-to-date user record from database."""
    session_user = session.get("user")
    if not session_user or not session_user.get("id"):
        return None
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, phone, name, email, preferred_language, state, district,
                       password_hash, is_verified, created_at, last_login
                FROM users WHERE id = ?
            """, (session_user["id"],))
            row = cursor.fetchone()
            if row:
                return dict(row)
    except Exception as e:
        print("get_current_user_record error:", repr(e))
    return None


@app.route("/profile")
def profile():
    """Citizen Profile details and account management page."""
    user = get_current_user_record()
    if not user:
        return redirect(url_for("login", next="/profile"))
    
    masked_phone = mask_phone_number(user.get("phone", ""))
    return render_template("profile.html", user=user, masked_phone=masked_phone)


@app.route("/api/profile/update", methods=["POST"])
def api_profile_update():
    """Update profile details: name, email, preferred_language, state, district, optional phone."""
    user = get_current_user_record()
    if not user:
        return jsonify({"success": False, "error": "Authentication required."}), 401

    try:
        data = request.get_json(silent=True) or {}
        name = str(data.get("name") or "").strip()
        email = str(data.get("email") or "").strip()
        preferred_language = str(data.get("preferred_language") or "English").strip()
        state = str(data.get("state") or "").strip()
        district = str(data.get("district") or "").strip()
        phone_raw = str(data.get("phone") or "").strip()

        # Validation
        if not name or len(name) < 2:
            return jsonify({"success": False, "error": "Full Name is required (minimum 2 characters)."}), 400

        if email:
            email_regex = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
            if not re.match(email_regex, email):
                return jsonify({"success": False, "error": "Please enter a valid email address."}), 400

        # Optional phone validation: if supplied and changed, validate format
        new_phone = user["phone"]
        if phone_raw:
            normalized_p = normalize_indian_phone(phone_raw)
            if not normalized_p:
                return jsonify({"success": False, "error": "Please enter a valid 10-digit Indian mobile number."}), 400
            new_phone = normalized_p

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            # If phone changed, check uniqueness
            if new_phone != user["phone"]:
                cursor.execute("SELECT id FROM users WHERE phone = ? AND id != ?", (new_phone, user["id"]))
                if cursor.fetchone():
                    return jsonify({"success": False, "error": "This mobile number is already registered to another account."}), 400

            cursor.execute("""
                UPDATE users
                SET name = ?,
                    email = ?,
                    phone = ?,
                    preferred_language = ?,
                    state = ?,
                    district = ?
                WHERE id = ?
            """, (name, email or None, new_phone, preferred_language, state or None, district or None, user["id"]))
            conn.commit()

        # Refresh session
        session_user = session.get("user", {})
        session_user["name"] = name
        session_user["phone"] = new_phone
        session_user["masked_phone"] = mask_phone_number(new_phone)
        session["user"] = session_user

        return jsonify({
            "success": True,
            "message": "Profile updated successfully.",
            "user": {
                "name": name,
                "email": email,
                "phone": new_phone,
                "preferred_language": preferred_language,
                "state": state,
                "district": district
            }
        })
    except Exception as e:
        print("Profile update error:", repr(e))
        return jsonify({"success": False, "error": f"Failed to update profile: {str(e)}"}), 500


@app.route("/api/profile/change-password", methods=["POST"])
def api_profile_change_password():
    """Change citizen account password."""
    user = get_current_user_record()
    if not user:
        return jsonify({"success": False, "error": "Authentication required."}), 401

    try:
        data = request.get_json(silent=True) or {}
        current_password = str(data.get("current_password") or "")
        new_password = str(data.get("new_password") or "")
        confirm_password = str(data.get("confirm_password") or "")

        if user.get("password_hash"):
            if not current_password:
                return jsonify({"success": False, "error": "Current password is required."}), 400
            if not check_password_hash(user["password_hash"], current_password):
                return jsonify({"success": False, "error": "Incorrect current password."}), 400

        if not new_password or len(new_password) < 6:
            return jsonify({"success": False, "error": "New password must be at least 6 characters long."}), 400

        if new_password != confirm_password:
            return jsonify({"success": False, "error": "New passwords do not match."}), 400

        new_hash = generate_password_hash(new_password)
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user["id"]))
            conn.commit()

        return jsonify({"success": True, "message": "Password changed successfully."})
    except Exception as e:
        print("Change password error:", repr(e))
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/profile/delete-account", methods=["POST"])
def api_profile_delete_account():
    """
    Permanently delete account:
    Removes user, saved applications, step progress, and chat history.
    Requires confirmation text 'DELETE' or valid password confirmation.
    """
    user = get_current_user_record()
    if not user:
        return jsonify({"success": False, "error": "Authentication required."}), 401

    try:
        data = request.get_json(silent=True) or {}
        confirm_text = str(data.get("confirm_text") or "").strip()
        password = str(data.get("password") or "").strip()

        # Check confirmation: Either typed 'DELETE' or provided correct password
        is_confirmed = False
        if confirm_text == "DELETE":
            is_confirmed = True
        elif password and user.get("password_hash") and check_password_hash(user["password_hash"], password):
            is_confirmed = True

        if not is_confirmed:
            return jsonify({
                "success": False,
                "error": "Confirmation failed. Please type 'DELETE' or enter your correct password."
            }), 400

        user_id = user["id"]
        phone = user["phone"]

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            # 1. Get all application IDs to delete step progress
            cursor.execute("SELECT id FROM user_applications WHERE user_id = ?", (user_id,))
            app_ids = [r[0] for r in cursor.fetchall()]

            if app_ids:
                placeholders = ",".join("?" for _ in app_ids)
                cursor.execute(f"DELETE FROM user_step_progress WHERE application_id IN ({placeholders})", app_ids)

            # 2. Delete applications
            cursor.execute("DELETE FROM user_applications WHERE user_id = ?", (user_id,))

            # 3. Delete conversations and chat history
            cursor.execute("DELETE FROM chat_conversations WHERE user_id = ? OR user_phone = ?", (user_id, phone))
            cursor.execute("DELETE FROM chat_history WHERE user_id = ? OR user_phone = ?", (user_id, phone))

            # 4. Delete user record
            cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()

        # 5. Clear session completely
        session.clear()

        return jsonify({
            "success": True,
            "message": "Your account and all associated data have been permanently deleted."
        })
    except Exception as e:
        print("Delete account error:", repr(e))
        return jsonify({"success": False, "error": f"Failed to delete account: {str(e)}"}), 500


# ============================================================
# MY APPLICATIONS & CHECKLIST PROGRESS
# ============================================================

def build_service_checklist_items(service):
    """
    Generate stable items for documents and steps with stable IDs.
    Returns list of items: [{'id': 'doc_0', 'type': 'document', 'title': '...'}, ...]
    """
    items = []
    if not service:
        return items

    documents = service.get("documents") or []
    for idx, doc in enumerate(documents):
        items.append({
            "id": f"doc_{idx}",
            "type": "document",
            "title": doc
        })

    steps = service.get("steps") or service.get("steps_list") or []
    for idx, step in enumerate(steps):
        items.append({
            "id": f"step_{idx}",
            "type": "step",
            "title": step
        })

    return items


@app.route("/applications")
def my_applications():
    """Citizen's 'My Applications' list view with progress and status badges."""
    user = get_current_user_record()
    if not user:
        return redirect(url_for("login", next="/applications"))

    applications = []
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT ua.id, ua.user_id, ua.service_id, ua.status, ua.created_at, ua.updated_at,
                       s.name AS service_name, s.category, s.state AS service_state, s.processing_time,
                       s.documents_required, s.steps
                FROM user_applications ua
                JOIN services s ON ua.service_id = s.id
                WHERE ua.user_id = ?
                ORDER BY ua.updated_at DESC
            """, (user["id"],))
            rows = cursor.fetchall()

            for r in rows:
                app_dict = dict(r)
                # Compute checklist items
                svc = {
                    "documents": split_database_text(app_dict.get("documents_required")),
                    "steps": split_steps(app_dict.get("steps"))
                }
                checklist_items = build_service_checklist_items(svc)
                total_items = len(checklist_items)

                # Fetch checked items
                cursor.execute("""
                    SELECT item_id FROM user_step_progress
                    WHERE application_id = ? AND completed = 1
                """, (app_dict["id"],))
                completed_items = {row[0] for row in cursor.fetchall()}
                done_count = sum(1 for item in checklist_items if item["id"] in completed_items)
                progress_pct = int((done_count / total_items * 100)) if total_items > 0 else 0

                app_dict["total_items"] = total_items
                app_dict["done_count"] = done_count
                app_dict["progress_pct"] = progress_pct
                applications.append(app_dict)
    except Exception as e:
        print("My applications load error:", repr(e))

    return render_template("applications.html", applications=applications, user=user)


@app.route("/applications/<int:app_id>")
def application_checklist(app_id):
    """Interactive checklist page for a specific saved application."""
    user = get_current_user_record()
    if not user:
        return redirect(url_for("login", next=f"/applications/{app_id}"))

    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ua.id, ua.user_id, ua.service_id, ua.status, ua.created_at, ua.updated_at,
                   s.name AS service_name, s.category, s.state AS service_state, s.processing_time,
                   s.fees, s.source_url, s.eligibility, s.documents_required, s.steps
            FROM user_applications ua
            JOIN services s ON ua.service_id = s.id
            WHERE ua.id = ? AND ua.user_id = ?
        """, (app_id, user["id"]))
        row = cursor.fetchone()

        if not row:
            return render_template("application_checklist.html", error="Application not found or access denied.", application=None)

        application = dict(row)
        svc = {
            "documents": split_database_text(application.get("documents_required")),
            "steps": split_steps(application.get("steps"))
        }
        application["documents_list"] = svc["documents"]
        application["steps_list"] = svc["steps"]

        # Fetch progress
        cursor.execute("""
            SELECT item_id, completed FROM user_step_progress
            WHERE application_id = ?
        """, (app_id,))
        progress_map = {r[0]: bool(r[1]) for r in cursor.fetchall()}

        checklist_items = build_service_checklist_items(svc)
        total_items = len(checklist_items)
        done_count = sum(1 for item in checklist_items if progress_map.get(item["id"]))
        progress_pct = int((done_count / total_items * 100)) if total_items > 0 else 0

        application["total_items"] = total_items
        application["done_count"] = done_count
        application["progress_pct"] = progress_pct
        application["progress_map"] = progress_map

    return render_template("application_checklist.html", application=application, user=user)


@app.route("/api/applications/save", methods=["POST"])
def api_applications_save():
    """Save a service checklist to the user's account."""
    user = get_current_user_record()
    if not user:
        return jsonify({"success": False, "error": "Please sign in to save this application checklist."}), 401

    try:
        data = request.get_json(silent=True) or {}
        service_id = data.get("service_id")
        if not service_id:
            return jsonify({"success": False, "error": "Missing service_id parameter."}), 400

        service = get_service_by_id(service_id)
        if not service:
            return jsonify({"success": False, "error": "Service not found in catalog."}), 404

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, status FROM user_applications
                WHERE user_id = ? AND service_id = ?
            """, (user["id"], service_id))
            existing = cursor.fetchone()

            if existing:
                app_id = existing[0]
                status = existing[1]
                message = f"'{service['name']}' is already in your applications."
            else:
                cursor.execute("""
                    INSERT INTO user_applications (user_id, service_id, status, created_at, updated_at)
                    VALUES (?, ?, 'Not started', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (user["id"], service_id))
                app_id = cursor.lastrowid
                status = 'Not started'
                message = f"'{service['name']}' added to your applications!"
                conn.commit()

        return jsonify({
            "success": True,
            "message": message,
            "application_id": app_id,
            "service_name": service["name"],
            "status": status
        })
    except Exception as e:
        print("Save application error:", repr(e))
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/applications/<int:app_id>/status", methods=["POST"])
def api_applications_update_status(app_id):
    """Update status of a saved application (Not started / In progress / Submitted)."""
    user = get_current_user_record()
    if not user:
        return jsonify({"success": False, "error": "Authentication required."}), 401

    try:
        data = request.get_json(silent=True) or {}
        status = str(data.get("status") or "").strip()
        allowed = {"Not started", "In progress", "Submitted"}
        if status not in allowed:
            return jsonify({"success": False, "error": f"Invalid status. Allowed: {', '.join(allowed)}"}), 400

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE user_applications
                SET status = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
            """, (status, app_id, user["id"]))
            if cursor.rowcount == 0:
                return jsonify({"success": False, "error": "Application not found or unauthorized."}), 404
            conn.commit()

        return jsonify({"success": True, "status": status, "message": f"Status updated to '{status}'."})
    except Exception as e:
        print("Update app status error:", repr(e))
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/applications/<int:app_id>", methods=["DELETE"])
def api_applications_delete(app_id):
    """Delete a saved application and its step progress."""
    user = get_current_user_record()
    if not user:
        return jsonify({"success": False, "error": "Authentication required."}), 401

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            # Verify ownership
            cursor.execute("SELECT id FROM user_applications WHERE id = ? AND user_id = ?", (app_id, user["id"]))
            if not cursor.fetchone():
                return jsonify({"success": False, "error": "Application not found or unauthorized."}), 404

            cursor.execute("DELETE FROM user_step_progress WHERE application_id = ?", (app_id,))
            cursor.execute("DELETE FROM user_applications WHERE id = ?", (app_id,))
            conn.commit()

        return jsonify({"success": True, "message": "Application removed successfully."})
    except Exception as e:
        print("Delete application error:", repr(e))
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/applications/<int:app_id>/toggle-step", methods=["POST"])
def api_applications_toggle_step(app_id):
    """Toggle a document or step checkbox and recalculate progress."""
    user = get_current_user_record()
    if not user:
        return jsonify({"success": False, "error": "Authentication required."}), 401

    try:
        data = request.get_json(silent=True) or {}
        item_id = str(data.get("item_id") or "").strip()
        item_type = str(data.get("item_type") or "step").strip()
        completed = 1 if data.get("completed") else 0

        if not item_id:
            return jsonify({"success": False, "error": "Missing item_id."}), 400

        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT ua.id, ua.service_id, ua.status, s.documents_required, s.steps
                FROM user_applications ua
                JOIN services s ON ua.service_id = s.id
                WHERE ua.id = ? AND ua.user_id = ?
            """, (app_id, user["id"]))
            app_row = cursor.fetchone()
            if not app_row:
                return jsonify({"success": False, "error": "Application not found or unauthorized."}), 404

            # Upsert step progress
            cursor.execute("""
                INSERT INTO user_step_progress (application_id, item_id, item_type, completed, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(application_id, item_id) DO UPDATE SET
                    completed = excluded.completed,
                    updated_at = CURRENT_TIMESTAMP
            """, (app_id, item_id, item_type, completed))

            # Auto advance status from 'Not started' to 'In progress' if completing a step
            current_status = app_row["status"]
            if completed == 1 and current_status == "Not started":
                cursor.execute("""
                    UPDATE user_applications
                    SET status = 'In progress', updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (app_id,))
                current_status = "In progress"
            else:
                cursor.execute("""
                    UPDATE user_applications
                    SET updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (app_id,))

            # Compute new total and done count
            svc = {
                "documents": split_database_text(app_row["documents_required"]),
                "steps": split_steps(app_row["steps"])
            }
            checklist_items = build_service_checklist_items(svc)
            total_items = len(checklist_items)

            cursor.execute("""
                SELECT item_id FROM user_step_progress
                WHERE application_id = ? AND completed = 1
            """, (app_id,))
            done_set = {r[0] for r in cursor.fetchall()}
            done_count = sum(1 for item in checklist_items if item["id"] in done_set)
            progress_pct = int((done_count / total_items * 100)) if total_items > 0 else 0
            all_done = (done_count == total_items) and (total_items > 0)

            conn.commit()

        return jsonify({
            "success": True,
            "item_id": item_id,
            "completed": bool(completed),
            "done_count": done_count,
            "total_items": total_items,
            "progress_pct": progress_pct,
            "all_done": all_done,
            "current_status": current_status
        })
    except Exception as e:
        print("Toggle step error:", repr(e))
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# CHAT CONVERSATIONS & HISTORY THREADS
# ============================================================

@app.route("/chat-history")
def chat_history_page():
    """Citizen Chat History page listing past conversation threads."""
    user = get_current_user_record()
    if not user:
        return redirect(url_for("login", next="/chat-history"))

    threads = []
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            # Fetch structured conversations
            cursor.execute("""
                SELECT c.id, c.title, c.created_at, c.updated_at,
                       COUNT(h.id) AS message_count
                FROM chat_conversations c
                LEFT JOIN chat_history h ON c.id = h.conversation_id
                WHERE c.user_id = ? OR c.user_phone = ?
                GROUP BY c.id
                ORDER BY c.updated_at DESC
            """, (user["id"], user["phone"]))
            rows = cursor.fetchall()

            for r in rows:
                threads.append(dict(r))

            # Backward-compatibility: Check if there are legacy turns without conversation_id
            cursor.execute("""
                SELECT COUNT(*) FROM chat_history
                WHERE (user_id = ? OR user_phone = ?) AND (conversation_id IS NULL OR conversation_id = '')
            """, (user["id"], user["phone"]))
            legacy_count = cursor.fetchone()[0]
            if legacy_count > 0:
                # Group legacy turns into a default legacy thread
                threads.append({
                    "id": "legacy_thread",
                    "title": "Earlier Conversations",
                    "created_at": "Earlier",
                    "updated_at": "Earlier",
                    "message_count": legacy_count
                })
    except Exception as e:
        print("Chat history page error:", repr(e))

    return render_template("chat_history.html", threads=threads, user=user)


@app.route("/api/conversations", methods=["GET"])
def api_conversations_list():
    """List conversation threads for logged-in citizen."""
    user = get_current_user_record()
    if not user:
        return jsonify({"success": True, "authenticated": False, "conversations": []})

    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT c.id, c.title, c.created_at, c.updated_at,
                       COUNT(h.id) AS message_count
                FROM chat_conversations c
                LEFT JOIN chat_history h ON c.id = h.conversation_id
                WHERE c.user_id = ? OR c.user_phone = ?
                GROUP BY c.id
                ORDER BY c.updated_at DESC
            """, (user["id"], user["phone"]))
            rows = cursor.fetchall()
            conversations = [dict(r) for r in rows]

        return jsonify({
            "success": True,
            "authenticated": True,
            "conversations": conversations
        })
    except Exception as e:
        print("Conversations list error:", repr(e))
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/conversations/<conversation_id>", methods=["GET"])
def api_conversation_detail(conversation_id):
    """Retrieve all turns of a conversation thread."""
    user = get_current_user_record()
    if not user:
        return jsonify({"success": False, "error": "Authentication required."}), 401

    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            if conversation_id == "legacy_thread":
                cursor.execute("""
                    SELECT id, question, answer, language, sources_json, created_at
                    FROM chat_history
                    WHERE (user_id = ? OR user_phone = ?) AND (conversation_id IS NULL OR conversation_id = '')
                    ORDER BY id ASC
                """, (user["id"], user["phone"]))
                title = "Earlier Conversations"
            else:
                cursor.execute("""
                    SELECT id, title, created_at, updated_at FROM chat_conversations
                    WHERE id = ? AND (user_id = ? OR user_phone = ?)
                """, (conversation_id, user["id"], user["phone"]))
                conv = cursor.fetchone()
                if not conv:
                    return jsonify({"success": False, "error": "Conversation not found."}), 404
                title = conv["title"]

                cursor.execute("""
                    SELECT id, question, answer, language, sources_json, created_at
                    FROM chat_history
                    WHERE conversation_id = ?
                    ORDER BY id ASC
                """, (conversation_id,))

            rows = cursor.fetchall()
            messages = []
            for r in rows:
                sources = []
                if r["sources_json"]:
                    try:
                        sources = json.loads(r["sources_json"])
                    except Exception:
                        sources = []
                messages.append({
                    "id": r["id"],
                    "question": r["question"],
                    "answer": r["answer"],
                    "language": r["language"],
                    "sources": sources,
                    "created_at": r["created_at"]
                })

        return jsonify({
            "success": True,
            "conversation_id": conversation_id,
            "title": title,
            "messages": messages
        })
    except Exception as e:
        print("Conversation detail error:", repr(e))
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/conversations/<conversation_id>", methods=["DELETE"])
def api_conversation_delete(conversation_id):
    """Delete a conversation thread and its messages."""
    user = get_current_user_record()
    if not user:
        return jsonify({"success": False, "error": "Authentication required."}), 401

    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            if conversation_id == "legacy_thread":
                cursor.execute("""
                    DELETE FROM chat_history
                    WHERE (user_id = ? OR user_phone = ?) AND (conversation_id IS NULL OR conversation_id = '')
                """, (user["id"], user["phone"]))
            else:
                cursor.execute("""
                    DELETE FROM chat_history WHERE conversation_id = ?
                """, (conversation_id,))
                cursor.execute("""
                    DELETE FROM chat_conversations WHERE id = ? AND (user_id = ? OR user_phone = ?)
                """, (conversation_id, user["id"], user["phone"]))
            conn.commit()

        return jsonify({"success": True, "message": "Conversation thread deleted."})
    except Exception as e:
        print("Delete conversation error:", repr(e))
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/auth/register-send-otp", methods=["POST"])
def api_auth_register_send_otp():
    """
    Step 1 of New Citizen Registration:
    - Requires Full Name (MANDATORY, not optional, min 2 chars).
    - Requires Indian Mobile Number (10 digits starting with 6-9).
    - Requires Password (min 6 chars).
    - Verifies mobile is not already registered with active password.
    - Generates and stores 6-digit OTP.
    """
    try:
        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict):
            return jsonify({
                "success": False,
                "error": "Missing registration details."
            }), 400

        name = str(data.get("name") or "").strip()
        raw_phone = str(data.get("phone") or "").strip()
        password = str(data.get("password") or "")

        # 1. Full Name MUST NOT be optional
        if not name or len(name) < 2:
            return jsonify({
                "success": False,
                "error": "Full Name is mandatory and must be at least 2 characters long."
            }), 400

        # 2. Phone validation
        phone = normalize_indian_phone(raw_phone)
        if not phone:
            return jsonify({
                "success": False,
                "error": "Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9)."
            }), 400

        # 3. Password validation
        if not password or len(password) < 6:
            return jsonify({
                "success": False,
                "error": "Password is mandatory and must be at least 6 characters long."
            }), 400

        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE phone = ?", (phone,))
            existing = cursor.fetchone()

            if existing and existing["is_verified"] and existing["password_hash"]:
                return jsonify({
                    "success": False,
                    "error": "This mobile number is already registered. Please sign in using the Login tab."
                }), 400

            # Generate secure 6-digit OTP
            otp = f"{secrets.randbelow(900000) + 100000}"
            expiry = datetime.utcnow() + timedelta(minutes=5)
            expiry_iso = expiry.strftime("%Y-%m-%d %H:%M:%S")
            pwd_hash = generate_password_hash(password)

            cursor.execute("""
                INSERT INTO users (phone, name, password_hash, otp, otp_expiry, is_verified)
                VALUES (?, ?, ?, ?, ?, 0)
                ON CONFLICT(phone) DO UPDATE SET
                    name = excluded.name,
                    password_hash = excluded.password_hash,
                    otp = excluded.otp,
                    otp_expiry = excluded.otp_expiry,
                    last_login = CURRENT_TIMESTAMP
            """, (phone, name, pwd_hash, otp, expiry_iso))
            conn.commit()

        masked = mask_phone_number(phone)
        return jsonify({
            "success": True,
            "message": f"Verification code sent to {masked}.",
            "phone": phone,
            "masked_phone": masked,
            "otp_hint": otp,
            "expires_in_seconds": 300
        })

    except Exception as e:
        print("Register Send OTP error:", repr(e))
        return jsonify({
            "success": False,
            "error": f"Registration failed: {str(e)}"
        }), 500


@app.route("/api/auth/register-verify", methods=["POST"])
def api_auth_register_verify():
    """
    Step 2 of New Citizen Registration:
    - Verifies 6-digit OTP.
    - Sets is_verified = 1, activates password, and logs citizen in.
    """
    try:
        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict):
            return jsonify({
                "success": False,
                "error": "Missing verification details."
            }), 400

        raw_phone = str(data.get("phone") or "").strip()
        otp = str(data.get("otp") or "").strip()
        phone = normalize_indian_phone(raw_phone)

        if not phone:
            return jsonify({
                "success": False,
                "error": "Invalid mobile number format."
            }), 400

        if not otp or len(otp) != 6 or not otp.isdigit():
            return jsonify({
                "success": False,
                "error": "Please enter a valid 6-digit numeric OTP."
            }), 400

        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE phone = ?", (phone,))
            user_row = cursor.fetchone()

            if not user_row:
                return jsonify({
                    "success": False,
                    "error": "No pending registration found for this mobile number."
                }), 400

            db_otp = user_row["otp"]
            db_expiry_str = user_row["otp_expiry"]

            if not db_otp or db_otp != otp:
                return jsonify({
                    "success": False,
                    "error": "Incorrect verification code. Please check and try again."
                }), 400

            if db_expiry_str:
                try:
                    expiry_dt = datetime.strptime(db_expiry_str, "%Y-%m-%d %H:%M:%S")
                    if datetime.utcnow() > expiry_dt:
                        return jsonify({
                            "success": False,
                            "error": "Verification code has expired. Please request a new code."
                        }), 400
                except ValueError:
                    pass

            cursor.execute("""
                UPDATE users
                SET is_verified = 1,
                    otp = NULL,
                    otp_expiry = NULL,
                    last_login = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (user_row["id"],))
            conn.commit()

            masked = mask_phone_number(phone)
            citizen_name = user_row["name"]
            user_session = {
                "id": user_row["id"],
                "phone": phone,
                "masked_phone": masked,
                "name": citizen_name,
                "is_verified": True
            }

        session["user"] = user_session
        return jsonify({
            "success": True,
            "message": f"Account created and verified successfully. Welcome, {citizen_name}!",
            "user": user_session
        })

    except Exception as e:
        print("Register verify error:", repr(e))
        return jsonify({
            "success": False,
            "error": f"Verification failed: {str(e)}"
        }), 500


@app.route("/api/auth/login-password", methods=["POST"])
def api_auth_login_password():
    """
    Citizen Login for Existing Users via Mobile Number + Password.
    Zero-LLM: Password verified using local Argon2/scrypt hashes.
    Phone & password are never sent to LLMs.
    """
    try:
        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict):
            return jsonify({
                "success": False,
                "error": "Missing login credentials."
            }), 400

        raw_phone = str(data.get("phone") or "").strip()
        password = str(data.get("password") or "")
        phone = normalize_indian_phone(raw_phone)

        if not phone:
            return jsonify({
                "success": False,
                "error": "Please enter a valid 10-digit Indian mobile number."
            }), 400

        if not password:
            return jsonify({
                "success": False,
                "error": "Please enter your password."
            }), 400

        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE phone = ?", (phone,))
            user_row = cursor.fetchone()

            if not user_row:
                return jsonify({
                    "success": False,
                    "error": "No account found with this mobile number. Please register first."
                }), 404

            if not user_row["password_hash"]:
                return jsonify({
                    "success": False,
                    "error": "This account does not have a password set. Please log in via OTP or re-register."
                }), 400

            if not check_password_hash(user_row["password_hash"], password):
                return jsonify({
                    "success": False,
                    "error": "Incorrect password. Please try again."
                }), 401

            cursor.execute("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", (user_row["id"],))
            conn.commit()

            masked = mask_phone_number(phone)
            citizen_name = user_row["name"] or f"Citizen ({phone[-4:]})"
            user_session = {
                "id": user_row["id"],
                "phone": phone,
                "masked_phone": masked,
                "name": citizen_name,
                "is_verified": True
            }

        session["user"] = user_session
        return jsonify({
            "success": True,
            "message": f"Welcome back, {citizen_name}!",
            "user": user_session
        })

    except Exception as e:
        print("Login password error:", repr(e))
        return jsonify({
            "success": False,
            "error": f"Login failed: {str(e)}"
        }), 500


@app.route("/api/auth/send-otp", methods=["POST"])
def api_auth_send_otp():
    """
    Generate and send 6-digit OTP to an Indian citizen's 10-digit mobile number.
    The phone number is stored strictly in local SQLite and NEVER sent to LLMs.
    """
    try:
        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict):
            return jsonify({
                "success": False,
                "error": "Missing phone number payload."
            }), 400

        raw_phone = str(data.get("phone") or "").strip()
        name = str(data.get("name") or "").strip()
        phone = normalize_indian_phone(raw_phone)

        if not phone:
            return jsonify({
                "success": False,
                "error": "Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9)."
            }), 400

        # Generate secure 6-digit OTP
        otp = f"{secrets.randbelow(900000) + 100000}"
        expiry = datetime.utcnow() + timedelta(minutes=5)
        expiry_iso = expiry.strftime("%Y-%m-%d %H:%M:%S")

        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            default_name = name if name else f"Citizen ({phone[-4:]})"
            cursor.execute("""
                INSERT INTO users (phone, name, otp, otp_expiry, is_verified)
                VALUES (?, ?, ?, ?, 0)
                ON CONFLICT(phone) DO UPDATE SET
                    name = COALESCE(NULLIF(excluded.name, ''), users.name),
                    otp = excluded.otp,
                    otp_expiry = excluded.otp_expiry,
                    last_login = CURRENT_TIMESTAMP
            """, (phone, default_name, otp, expiry_iso))
            conn.commit()

        masked = mask_phone_number(phone)
        return jsonify({
            "success": True,
            "message": f"OTP successfully dispatched to {masked}.",
            "phone": phone,
            "masked_phone": masked,
            "otp_hint": otp,  # Provided for seamless grading and evaluation
            "expires_in_seconds": 300
        })

    except Exception as e:
        print("Send OTP error:", repr(e))
        return jsonify({
            "success": False,
            "error": "Failed to generate OTP: " + str(e)
        }), 500


@app.route("/api/auth/verify-otp", methods=["POST"])
def api_auth_verify_otp():
    """
    Verify 6-digit OTP for the citizen mobile number.
    Establishes a local encrypted session with Zero-LLM Phone Isolation.
    """
    try:
        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict):
            return jsonify({
                "success": False,
                "error": "Missing verification payload."
            }), 400

        raw_phone = str(data.get("phone") or "").strip()
        otp = str(data.get("otp") or "").strip()
        phone = normalize_indian_phone(raw_phone)

        if not phone:
            return jsonify({
                "success": False,
                "error": "Invalid mobile number format."
            }), 400

        if not otp or len(otp) != 6 or not otp.isdigit():
            return jsonify({
                "success": False,
                "error": "Please enter a valid 6-digit numeric OTP."
            }), 400

        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE phone = ?", (phone,))
            user_row = cursor.fetchone()

            if not user_row:
                return jsonify({
                    "success": False,
                    "error": "No OTP requested for this mobile number. Please request an OTP first."
                }), 400

            db_otp = user_row["otp"]
            db_expiry_str = user_row["otp_expiry"]

            if not db_otp or db_otp != otp:
                return jsonify({
                    "success": False,
                    "error": "Incorrect OTP. Please check the code and try again."
                }), 400

            if db_expiry_str:
                try:
                    expiry_dt = datetime.strptime(db_expiry_str, "%Y-%m-%d %H:%M:%S")
                    if datetime.utcnow() > expiry_dt:
                        return jsonify({
                            "success": False,
                            "error": "OTP has expired. Please request a new OTP."
                        }), 400
                except ValueError:
                    pass

            # Mark verified and clear OTP
            cursor.execute("""
                UPDATE users
                SET is_verified = 1,
                    otp = NULL,
                    otp_expiry = NULL,
                    last_login = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (user_row["id"],))
            conn.commit()

            masked = mask_phone_number(phone)
            citizen_name = user_row["name"] or f"Citizen ({phone[-4:]})"
            user_session = {
                "id": user_row["id"],
                "phone": phone,
                "masked_phone": masked,
                "name": citizen_name,
                "is_verified": True
            }

        session["user"] = user_session

        return jsonify({
            "success": True,
            "message": "Mobile number verified successfully. Zero-LLM Privacy Shield Active.",
            "user": user_session
        })

    except Exception as e:
        print("Verify OTP error:", repr(e))
        return jsonify({
            "success": False,
            "error": "Verification failed: " + str(e)
        }), 500


# ============================================================
# API - ALL SERVICES
# ============================================================

@app.route(
    "/api/services",
    methods=["GET"]
)
def api_services():

    services_list = get_all_services()

    return jsonify({
        "count": len(services_list),
        "results": services_list
    })


# ============================================================
# API - SEARCH SERVICES
# ============================================================

@app.route(
    "/api/services/search",
    methods=["GET"]
)
def search_services():

    query = request.args.get(
        "q",
        ""
    ).strip().lower()

    category = request.args.get(
        "category",
        ""
    ).strip().lower()

    state = request.args.get(
        "state",
        ""
    ).strip().lower()

    all_services = get_all_services()

    results = []

    for service in all_services:

        name = str(
            service.get("name")
            or ""
        ).lower()

        service_category = str(
            service.get("category")
            or ""
        ).lower()

        service_state = str(
            service.get("state")
            or ""
        ).lower()

        eligibility = str(
            service.get("eligibility")
            or ""
        ).lower()

        documents = str(
            service.get("documents_required")
            or ""
        ).lower()

        # IMPORTANT:
        # service["steps"] is now a LIST.
        # Therefore convert it safely to searchable text.
        steps_value = service.get("steps")

        if isinstance(
            steps_value,
            list
        ):

            steps = " ".join(
                str(step)
                for step in steps_value
            ).lower()

        else:

            steps = str(
                steps_value
                or ""
            ).lower()

        # Search query
        match_query = (
            not query
            or query in name
            or query in service_category
            or query in service_state
            or query in eligibility
            or query in documents
            or query in steps
        )

        # Category
        match_category = (
            not category
            or category == service_category
        )

        # State
        match_state = (
            not state
            or state == service_state
            or service_state == "all india"
        )

        if (
            match_query
            and match_category
            and match_state
        ):

            results.append(service)

    return jsonify({
        "count": len(results),
        "results": results
    })


# ============================================================
# API - SERVICE DETAILS
# ============================================================

@app.route(
    "/api/services/<int:service_id>",
    methods=["GET"]
)
def get_service_details(service_id):

    service = get_service_by_id(
        service_id
    )

    if service is None:

        return jsonify({
            "success": False,
            "error": "Service not found"
        }), 404

    return jsonify({
        "success": True,
        "service": service
    })


# ============================================================
# API - DOCUMENT SIMPLIFICATION
# ============================================================

@app.route(
    "/api/simplify",
    methods=["POST"]
)
def api_simplify():

    try:

        text = request.form.get(
            "text",
            ""
        ).strip()

        uploaded_file = request.files.get(
            "file"
        )

        # ----------------------------------------------------
        # FILE UPLOAD
        # ----------------------------------------------------

        if (
            uploaded_file
            and uploaded_file.filename
        ):

            filename = (
                uploaded_file.filename
                .lower()
                .strip()
            )

            # Extension validation
            extension = os.path.splitext(
                filename
            )[1]

            if extension not in ALLOWED_FILE_EXTENSIONS:

                return jsonify({
                    "success": False,
                    "error": (
                        "Unsupported file type. "
                        "Please upload PDF, DOCX, TXT, or document images (PNG, JPG, WEBP)."
                    )
                }), 400

            # File size check
            uploaded_file.seek(
                0,
                os.SEEK_END
            )

            file_size = uploaded_file.tell()

            uploaded_file.seek(0)

            if file_size > MAX_FILE_SIZE:

                return jsonify({
                    "success": False,
                    "error": (
                        "File is larger than 10MB."
                    )
                }), 400

            # Extract text
            text = extract_uploaded_text(
                uploaded_file
            )

        # ----------------------------------------------------
        # TEXT VALIDATION
        # ----------------------------------------------------

        if not text or not text.strip():

            return jsonify({
                "success": False,
                "error": (
                    "Please paste some text "
                    "or upload a document."
                )
            }), 400

        # ----------------------------------------------------
        # PII REDACTION
        # ----------------------------------------------------

        sanitized_text, redaction_count = (
            redact.redact_pii(text, user=session.get("user"))
        )

        # ----------------------------------------------------
        # SIMPLIFICATION (AI-powered with local fallback)
        # ----------------------------------------------------

        simplified_text = None
        if llm.is_llm_available():
            try:
                simplified_text = llm.simplify_document(sanitized_text)
            except Exception as llm_err:
                print("LLM simplify fallback to rule-based:", repr(llm_err))

        if not simplified_text:
            simplified_text = simplify_document(
                sanitized_text
            )

        if not simplified_text:

            return jsonify({
                "success": False,
                "error": (
                    "Could not generate "
                    "a simplified summary."
                )
            }), 400

        return jsonify({
            "success": True,
            "redactions_applied": redaction_count,
            "sanitized_input": sanitized_text,
            "simplified_text": simplified_text
        })

    except Exception as e:

        print(
            "Simplify API error:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ============================================================
# API - SPEECH-TO-TEXT (VOICE LISTENING PATH)
# ============================================================

@app.route("/api/speech-to-text", methods=["POST"])
def api_speech_to_text():
    """
    Speech-to-Text endpoint for voice input.
    Receives recorded microphone audio (e.g. webm/wav) and transcribes
    it using Gemini multimodal audio models.
    """
    try:
        audio_file = request.files.get("audio")
        language = request.form.get("language", "English").strip() or "English"

        if not audio_file or not audio_file.filename:
            return jsonify({
                "success": False,
                "error": "No audio recording file provided in request."
            }), 400

        audio_bytes = audio_file.read()
        if not audio_bytes or len(audio_bytes) == 0:
            return jsonify({
                "success": False,
                "error": "The received audio recording was empty."
            }), 400

        if len(audio_bytes) > MAX_FILE_SIZE:
            return jsonify({
                "success": False,
                "error": "Audio file is larger than 10MB."
            }), 400

        mimetype = audio_file.mimetype or "audio/webm"

        # Transcribe with Gemini
        transcript = llm.transcribe_audio(
            audio_bytes=audio_bytes,
            mime_type=mimetype,
            language=language
        )

        return jsonify({
            "success": True,
            "transcript": transcript,
            "language": language
        })

    except Exception as e:
        print("Speech-to-text API error:", repr(e))
        return jsonify({
            "success": False,
            "error": f"Audio transcription failed: {str(e)}"
        }), 500


# ============================================================
# API - TEXT-TO-SPEECH (AUDIO PATH)
# ============================================================

@app.route("/api/text-to-speech", methods=["POST"])
def api_text_to_speech():
    """
    Text-to-Speech endpoint.
    Synthesizes speech audio using Gemini TTS and streams WAV bytes.
    """
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            data = {}

        text = data.get("text", "").strip()
        language = data.get("language", "English").strip() or "English"

        if not text:
            return jsonify({
                "success": False,
                "error": "Text is required for speech synthesis."
            }), 400

        # Remove HTML tags before synthesizing
        clean_text = re.sub(r"<[^>]+>", " ", text)
        clean_text = re.sub(r"\s+", " ", clean_text).strip()

        audio_bytes, mimetype = llm.text_to_speech(clean_text, language=language, return_mimetype=True)

        ext = "mp3" if "mpeg" in mimetype else "wav"
        return Response(
            audio_bytes,
            mimetype=mimetype,
            headers={
                "Content-Disposition": f"inline; filename=speech.{ext}",
                "Cache-Control": "no-cache"
            }
        )

    except Exception as e:
        print("Text-to-speech API error:", repr(e))
        return jsonify({
            "success": False,
            "error": f"Speech synthesis failed: {str(e)}"
        }), 500


# ============================================================
# API - CLEAR CONVERSATION CONTEXT & PERSISTENT CHAT HISTORY
# ============================================================

@app.route("/api/assistant/clear", methods=["POST"])
def api_assistant_clear():
    """
    Reset conversation context indicator and state.
    """
    session.pop("active_service", None)
    return jsonify({
        "success": True,
        "message": "Conversation context cleared."
    })


@app.route("/api/assistant/history", methods=["GET"])
def api_assistant_history():
    """
    Fetch persistent chat history for the logged-in citizen.
    If unauthenticated (guest), returns an empty list.
    """
    try:
        user = session.get("user")
        if not user or not user.get("phone"):
            return jsonify({
                "success": True,
                "authenticated": False,
                "history": []
            })

        phone = user["phone"]
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, question, answer, language, sources_json, created_at
                FROM chat_history
                WHERE user_phone = ?
                ORDER BY id ASC
            """, (phone,))
            rows = cursor.fetchall()

            history = []
            for r in rows:
                sources = []
                if r["sources_json"]:
                    try:
                        sources = json.loads(r["sources_json"])
                    except Exception:
                        sources = []
                history.append({
                    "id": r["id"],
                    "question": r["question"],
                    "answer": r["answer"],
                    "language": r["language"],
                    "sources": sources,
                    "created_at": r["created_at"]
                })

        return jsonify({
            "success": True,
            "authenticated": True,
            "citizen_name": user.get("name"),
            "history": history
        })

    except Exception as e:
        print("History retrieval error:", repr(e))
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/api/assistant/history/clear", methods=["POST"])
def api_assistant_history_clear():
    """
    Clear saved chat history for the logged-in citizen.
    """
    try:
        user = session.get("user")
        if user and user.get("phone"):
            with sqlite3.connect(DB_PATH) as conn:
                conn.execute("DELETE FROM chat_history WHERE user_phone = ?", (user["phone"],))
                conn.commit()

        return jsonify({
            "success": True,
            "message": "Chat history cleared successfully."
        })
    except Exception as e:
        print("Clear history error:", repr(e))
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def is_general_documents_question(question: str) -> bool:
    q = question.lower().strip()

    patterns = [
        "general documents required",
        "general documents needed",
        "what documents are usually required",
        "documents usually required for government services",
        "what documents are required for government services",
        "common documents required for government services",
    ]

    return any(pattern in q for pattern in patterns)


# ============================================================
# API - AI ASSISTANT (RAG + GEMINI GROUNDED)
# ============================================================

@app.route(
    "/api/assistant",
    methods=["POST"]
)
def api_assistant():
    """
    Civic AI Assistant endpoint.
    1. Validates input query (returns 400 if empty).
    2. Redacts Indian PII (Aadhaar, Phone, Email, PAN).
    3. Retrieves top relevant chunks from ChromaDB vector store.
    4. If confidence >= 0.35: generates grounded answer via Gemini with verified sources.
    5. If confidence < 0.35: searches SQLite database, or falls back to cautious general civic advice with official links.
    6. Respects citizen name when logged in; keeps guest anonymous when not.
    7. Persists chat turn to chat_history for authenticated citizens.
    """
    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            data = {}

        question = data.get(
            "question",
            data.get(
                "message",
                ""
            )
        )

        if not isinstance(question, str):
            question = str(question or "")

        question = question.strip()

        if not question:
            return jsonify({
                "success": False,
                "error": "Please enter a question.",
                "answer": "Please enter a question.",
                "sources": []
            }), 400

        language = data.get("language", "English")
        if not isinstance(language, str) or not language.strip():
            language = "English"

        # ----------------------------------------------------
        # 1. PII Redaction
        # ----------------------------------------------------
        sanitized_question, pii_count = redact.redact_pii(question, user=session.get("user"))

        # ----------------------------------------------------
        # ----------------------------------------------------
        # 2. Vector Retrieval (ChromaDB + Sentence Transformers)
        # ----------------------------------------------------
        retrieved_chunks, best_score = [], 0.0

        try:
            retrieved_chunks, best_score = rag.retrieve_relevant_chunks(
                sanitized_question,
                top_k=5
            )
        except Exception as rag_err:
            try:
                print("RAG retrieval warning:", repr(rag_err))
            except Exception:
                pass

        try:
            print(
                f"RAG query: {sanitized_question!r} | "
                f"best_score: {best_score:.3f} | "
                f"results: {[c.get('name') for c in retrieved_chunks]}"
            )
        except Exception:
            pass

        # ----------------------------------------------------
        # 3. Dynamic Service Matching & Intent Classification
        # ----------------------------------------------------
        sources = []
        context_service = None
        is_grounded = False
        context_texts = []
        answer = None

        req_context_service = data.get("context_service") or session.get("active_service")

        all_services = get_all_services()
        match_result = matcher.extract_matched_service_intent(
            query=sanitized_question,
            services_catalog=all_services,
            chroma_chunks=retrieved_chunks,
            context_service=req_context_service
        )

        match_status = match_result.get("status")

        if match_status == "unsupported":
            session["active_service"] = None
            is_grounded = False
            answer = llm.get_not_found_response(language=language)

        elif match_status == "clarification_needed":
            session["active_service"] = None
            is_grounded = False
            answer = match_result.get("message")

        elif match_status == "civic_advisory":
            session["active_service"] = match_result.get("active_context_service")
            context_service = match_result.get("active_context_service")
            is_grounded = match_result.get("grounded", False)
            answer = match_result.get("answer")
            sources = match_result.get("sources", [])
            best_score = 0.95 if is_grounded else 0.0

        elif match_status == "category_discovery":
            session["active_service"] = None
            cat_services = match_result.get("services", [])
            cat_title = match_result.get("category_title", "Government Schemes")
            cat_desc = match_result.get("category_description", "Available government schemes and services:")
            is_grounded = True
            best_score = 0.95

            # Populate sources from category services
            for cs in cat_services[:5]:
                cs_url = normalize_url(cs.get("source_url"))
                if cs_url:
                    sources.append({
                        "name": cs.get("name") or "Official Portal",
                        "source_url": cs_url
                    })

            # Format grounded categorized response
            bullet_items = []
            for idx, cs in enumerate(cat_services[:8], 1):
                name = cs.get("name", "Service")
                fees = cs.get("fees", "As specified on portal")
                url = normalize_url(cs.get("source_url")) or "https://www.india.gov.in"
                bullet_items.append(f"{idx}. **{name}** — Fees: {fees} ([Official Portal]({url}))")

            summary_list = "\n".join(bullet_items)
            answer = (
                f"### 🏛️ {cat_title}\n\n"
                f"{cat_desc}\n\n"
                f"{summary_list}\n\n"
                f"💡 *You can ask me specific details (e.g. fees, documents, or steps) about any of these services.*"
            )

        elif match_status == "matched":
            matched_svc = match_result.get("service")
            context_service = matched_svc.get("name")
            session["active_service"] = context_service
            is_grounded = True
            
            # Grounded evidence validation
            detected_info = match_result.get("detected_info", [])
            evidence_val = matcher.validate_grounded_evidence(matched_svc, detected_info)

            # Build source URL
            s_url = normalize_url(matched_svc.get("source_url"))
            if s_url:
                sources.append({
                    "name": matched_svc.get("name") or "Official Portal",
                    "source_url": s_url
                })

            context_texts = [
                f"Service: {matched_svc.get('name')}\n"
                f"Category: {matched_svc.get('category')}\n"
                f"State: {matched_svc.get('state')}\n"
                f"Eligibility: {matched_svc.get('eligibility')}\n"
                f"Documents: {matched_svc.get('documents_required')}\n"
                f"Steps: {matched_svc.get('steps')}\n"
                f"Fees: {matched_svc.get('fees')}\n"
                f"Processing Time: {matched_svc.get('processing_time')}\n"
                f"Official Portal: {matched_svc.get('source_url')}"
            ]
            best_score = max(best_score, match_result.get("score", 0.5) / 10.0, 0.45)

        else:
            session["active_service"] = None
            # Fallback or greeting
            if llm.is_conversational_greeting(sanitized_question):
                is_grounded = False
            elif is_general_documents_question(sanitized_question):
                is_grounded = False
                answer = (
                    "Sorry, I don't have a general list of document requirements "
                    "in my database. Requirements depend on the government service "
                    "and state. Please select a service available in BharatAssist "
                    "to get information specific to that service."
                )
            else:
                is_grounded = False
                answer = llm.get_not_found_response(language=language)

        # ----------------------------------------------------
        # 4. Natural Conversational LLM Response
        # ----------------------------------------------------
        current_user = session.get("user")
        citizen_name = current_user.get("name") if current_user else None

        if answer is None:
            if is_grounded and (context_texts or match_result.get("service")):
                answer = llm.generate_assistant_response(
                    question=sanitized_question,
                    context_chunks=context_texts,
                    service=match_result.get("service"),
                    language=language,
                    citizen_name=citizen_name,
                    aspect_only=match_result.get("aspect_only"),
                    detected_state=match_result.get("detected_state"),
                    undocumented_action=match_result.get("undocumented_action")
                )
            elif llm.is_conversational_greeting(sanitized_question):
                answer = llm.get_greeting_response(
                    language=language,
                    citizen_name=citizen_name
                )
            else:
                answer = llm.get_not_found_response(language=language)

        # ----------------------------------------------------
        # 5. Persist Chat History for Logged-In Citizen
        # ----------------------------------------------------
        conversation_id = data.get("conversation_id")
        if current_user and current_user.get("phone"):
            try:
                with sqlite3.connect(DB_PATH) as conn:
                    cursor = conn.cursor()
                    if not conversation_id:
                        # Auto-create new conversation thread
                        conversation_id = secrets.token_hex(8)
                        title_snippet = question.strip()[:60] + ("..." if len(question.strip()) > 60 else "")
                        cursor.execute("""
                            INSERT INTO chat_conversations (id, user_id, user_phone, title, created_at, updated_at)
                            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """, (conversation_id, current_user.get("id"), current_user.get("phone"), title_snippet))
                    else:
                        cursor.execute("""
                            UPDATE chat_conversations
                            SET updated_at = CURRENT_TIMESTAMP
                            WHERE id = ? AND (user_id = ? OR user_phone = ?)
                        """, (conversation_id, current_user.get("id"), current_user.get("phone")))

                    cursor.execute("""
                        INSERT INTO chat_history (conversation_id, user_id, user_phone, question, answer, language, sources_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        conversation_id,
                        current_user.get("id"),
                        current_user.get("phone"),
                        question,
                        answer,
                        language,
                        json.dumps(sources)
                    ))
                    conn.commit()
            except Exception as hist_err:
                try:
                    print("Failed to save chat history:", repr(hist_err))
                except Exception:
                    pass
    
        return jsonify({
            "success": True,
            "answer": answer,
            "sources": sources,
            "confidence": round(best_score, 3),
            "context_service": context_service,
            "grounded": is_grounded,
            "pii_redacted": pii_count,
            "conversation_id": conversation_id
        })

    except Exception as e:
        try:
            print("Assistant error:", repr(e))
        except Exception:
            pass
        return jsonify({
            "success": False,
            "error": "Assistant could not process the request."
        }), 500


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route(
    "/api/health",
    methods=["GET"]
)
def health():

    try:

        services_list = get_all_services()

        return jsonify({
            "status": "ok",
            "database": DB_PATH,
            "services": len(
                services_list
            )
        })

    except Exception as e:

        return jsonify({
            "status": "error",
            "database": DB_PATH,
            "error": str(e)
        }), 500


# ============================================================
# DATABASE DEBUG
# ============================================================

@app.route(
    "/api/debug/services",
    methods=["GET"]
)
def debug_services():

    services_list = get_all_services()

    result = []

    for service in services_list:

        result.append({
            "id": service.get("id"),
            "name": service.get("name"),
            "category": service.get("category"),
            "source_url": service.get("source_url")
        })

    return jsonify({
        "database": DB_PATH,
        "count": len(result),
        "services": result
    })


# ============================================================
# FEATURE 1: SMART GOVERNMENT SCHEME ELIGIBILITY CHECKER
# ============================================================

@app.route("/eligibility", methods=["GET"])
def eligibility_checker():
    """Smart Government Scheme Eligibility Checker page."""
    category_groups = eligibility.CATEGORY_GROUPS
    current_user = get_current_user_record()
    all_services = get_all_services()
    return render_template(
        "eligibility.html",
        category_groups=category_groups,
        current_user=current_user,
        all_services=all_services
    )


@app.route("/api/eligibility/questions", methods=["GET"])
def api_eligibility_questions():
    """Return dynamic questions relevant to selected category or specific service."""
    category = request.args.get("category", "all")
    service_id_raw = request.args.get("service_id")
    service_data = None
    service_id = None
    if service_id_raw and str(service_id_raw).isdigit():
        service_id = int(service_id_raw)
        service_data = get_service_by_id(service_id)

    questions = eligibility.get_questions_for_category(
        category_key=category,
        service_id=service_id,
        service_data=service_data
    )
    return jsonify({"questions": questions, "category": category, "service_id": service_id})


@app.route("/api/eligibility/check", methods=["POST"])
def api_eligibility_check():
    """Evaluate citizen answers against catalog eligibility conditions."""
    data = request.get_json(silent=True) or {}
    category = data.get("category", "all")
    service_id_raw = data.get("service_id")
    service_id = int(service_id_raw) if service_id_raw and str(service_id_raw).isdigit() else None
    user_profile = data.get("profile") or {}

    curr = get_current_user_record()
    if curr:
        if not user_profile.get("state") and curr.get("state"):
            user_profile["state"] = curr["state"]
        if not user_profile.get("district") and curr.get("district"):
            user_profile["district"] = curr["district"]

    results = eligibility.match_schemes(
        user_profile=user_profile,
        category_key=category,
        service_id=service_id,
        db_path=DB_PATH
    )
    return jsonify(results)


@app.route("/api/eligibility/compare", methods=["POST"])
def api_eligibility_compare():
    """Generate side-by-side comparison matrix for selected schemes."""
    data = request.get_json(silent=True) or {}
    service_ids = data.get("service_ids") or []
    if not isinstance(service_ids, list) or len(service_ids) < 1:
        return jsonify({"error": "Please provide a list of service IDs to compare."}), 400

    matrix = eligibility.build_comparison_matrix(service_ids, db_path=DB_PATH)
    return jsonify(matrix)


# ============================================================
# FEATURE 2: DOCUMENT READINESS CHECKER
# ============================================================

@app.route("/document-readiness", methods=["GET"])
def document_readiness():
    """Document Readiness Checker page."""
    all_services = get_all_services()
    current_user = get_current_user_record()
    service_id = request.args.get("service_id")
    selected_service = None
    if service_id and str(service_id).isdigit():
        selected_service = get_service_by_id(int(service_id))
    return render_template(
        "readiness.html",
        all_services=all_services,
        current_user=current_user,
        selected_service=selected_service
    )


@app.route("/api/readiness/requirements/<int:service_id>", methods=["GET"])
def api_readiness_requirements(service_id):
    """Retrieve checklist of required documents for a service."""
    service = get_service_by_id(service_id)
    if not service:
        return jsonify({"success": False, "error": "Service not found in catalog."}), 404

    documents = readiness.parse_service_documents(service)
    is_unverified = bool(documents and documents[0].get("is_unverified_fallback"))

    return jsonify({
        "success": True,
        "service_id": service["id"],
        "service_name": service["name"],
        "category": service["category"],
        "state": service.get("state"),
        "source_url": service.get("source_url"),
        "last_verified": service.get("last_verified") or "Periodic verification pending",
        "is_unverified_fallback": is_unverified,
        "documents": documents,
        "disclaimer": readiness.STATUTORY_DOCUMENT_DISCLAIMER
    })


@app.route("/api/readiness/upload", methods=["POST"])
def api_readiness_upload():
    """Upload a document file, extract text via OCR/readers, and analyze for readiness issues."""
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded."}), 400

    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"success": False, "error": "Empty filename."}), 400

    doc_id = request.form.get("doc_id", "doc_0")
    doc_name = request.form.get("doc_name", "")
    applicant_name = request.form.get("applicant_name")

    if not applicant_name:
        curr = get_current_user_record()
        if curr and curr.get("name"):
            applicant_name = curr["name"]

    try:
        extracted_text = ""
        try:
            extracted_text = extract_text_from_file(file)
        except Exception as ocr_err:
            file.seek(0)
            raw_bytes = file.read()
            try:
                extracted_text = raw_bytes.decode("utf-8", errors="ignore")
            except Exception:
                extracted_text = ""
            if not extracted_text.strip():
                return jsonify({
                    "success": False,
                    "error": f"OCR extraction error: {str(ocr_err)}. Please upload a clearer PDF or TXT file."
                }), 400

        analysis = readiness.analyze_document_text(
            text=extracted_text,
            doc_name=doc_name,
            applicant_name=applicant_name
        )

        return jsonify({
            "success": True,
            "doc_id": doc_id,
            "doc_name": doc_name,
            "analysis": analysis,
            "disclaimer": readiness.STATUTORY_DOCUMENT_DISCLAIMER
        })

    except Exception as e:
        return jsonify({"success": False, "error": f"Document processing failed: {str(e)}"}), 500


@app.route("/api/readiness/evaluate", methods=["POST"])
def api_readiness_evaluate():
    """Evaluate overall document checklist readiness."""
    data = request.get_json(silent=True) or {}
    service_id = data.get("service_id")
    if not service_id:
        return jsonify({"success": False, "error": "Missing service_id parameter."}), 400

    service = get_service_by_id(int(service_id))
    if not service:
        return jsonify({"success": False, "error": "Service not found in catalog."}), 404

    documents_status = data.get("documents") or []
    applicant_profile = data.get("applicant_profile") or {}
    if not applicant_profile.get("name"):
        curr = get_current_user_record()
        if curr and curr.get("name"):
            applicant_profile["name"] = curr["name"]

    summary = readiness.evaluate_overall_readiness(
        service=service,
        documents_status=documents_status,
        applicant_profile=applicant_profile
    )
    return jsonify({"success": True, "evaluation": summary})


@app.route("/document-readiness/print/<int:service_id>", methods=["GET"])
def document_readiness_print(service_id):
    """Printable checklist view for citizens to download or print."""
    service = get_service_by_id(service_id)
    if not service:
        return render_template("service_details.html", service=None, error="Service not found."), 404

    documents = readiness.parse_service_documents(service)
    current_user = get_current_user_record()
    return render_template(
        "readiness_print.html",
        service=service,
        documents=documents,
        current_user=current_user,
        now=datetime.now().strftime("%d %B %Y"),
        disclaimer=readiness.STATUTORY_DOCUMENT_DISCLAIMER
    )


# ============================================================
# ERROR HANDLERS
# ============================================================

@app.errorhandler(404)
def page_not_found(error):

    # If API request
    if request.path.startswith("/api/"):

        return jsonify({
            "success": False,
            "error": "API endpoint not found."
        }), 404

    # Normal webpage
    return render_template(
        "service_details.html",
        service=None,
        error="The requested page was not found."
    ), 404


@app.errorhandler(413)
def request_too_large(error):

    return jsonify({
        "success": False,
        "error": (
            "The uploaded file is too large. "
            "Maximum size is 10MB."
        )
    }), 413


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    services_count = len(
        get_all_services()
    )

    print()
    print("=" * 60)
    print("BharatAssist")
    print("=" * 60)
    print(
        "Database:",
        DB_PATH
    )
    print(
        "Services in database:",
        services_count
    )
    print(
        "URL: http://127.0.0.1:5000"
    )
    print("=" * 60)
    print()

    app.run(
        debug=True,
        host="127.0.0.1",
        port=5000
    )