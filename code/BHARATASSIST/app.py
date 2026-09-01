import os
import re
import sqlite3
from urllib.parse import urlparse

from flask import Flask, render_template, request, jsonify,session


# ============================================================
# APP CONFIGURATION
# ============================================================

app = Flask(__name__)
app.secret_key = "bharatassist-development-key"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "bharatassist.db")

# Maximum upload/request size: 10 MB
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024


# ============================================================
# CONSTANTS
# ============================================================

ALLOWED_FILE_EXTENSIONS = {
    ".pdf",
    ".docx",
    ".txt",
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
    # PDF
    # --------------------------------------------------------

    if filename.endswith(".pdf"):

        try:

            import PyPDF2

        except ImportError:

            raise Exception(
                "PDF support is not installed. "
                "Run: pip install PyPDF2"
            )

        try:

            reader = PyPDF2.PdfReader(
                uploaded_file
            )

            pages = []

            for page in reader.pages:

                page_text = page.extract_text()

                if page_text:
                    pages.append(page_text)

            result = "\n".join(pages)

            if not result.strip():

                raise Exception(
                    "No readable text was found in this PDF."
                )

            return result

        except Exception as e:

            raise Exception(
                f"Could not read PDF: {str(e)}"
            )

    # --------------------------------------------------------
    # DOCX
    # --------------------------------------------------------

    if filename.endswith(".docx"):

        try:

            from docx import Document

        except ImportError:

            raise Exception(
                "DOCX support is not installed. "
                "Run: pip install python-docx"
            )

        try:

            document = Document(
                uploaded_file
            )

            paragraphs = []

            for paragraph in document.paragraphs:

                text = paragraph.text.strip()

                if text:
                    paragraphs.append(text)

            result = "\n".join(paragraphs)

            if not result.strip():

                raise Exception(
                    "No readable text was found in this DOCX."
                )

            return result

        except Exception as e:

            raise Exception(
                f"Could not read DOCX: {str(e)}"
            )

    raise Exception(
        "Unsupported file type. "
        "Please upload PDF, DOCX or TXT."
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

    output = []

    output.append(
        "<strong>What this document says</strong>"
    )

    output.append(
        "<p class='text-muted mb-3'>"
        "Here is a simpler breakdown of the important information:"
        "</p>"
    )

    output.append("<ul class='mb-0'>")

    for sentence in useful:

        # Escape HTML
        safe_sentence = (
            sentence
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )

        output.append(
            f"<li class='mb-2'>{safe_sentence}</li>"
        )

    output.append("</ul>")

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
                        "Please upload PDF, DOCX or TXT."
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
            redact_pii(text)
        )

        # ----------------------------------------------------
        # SIMPLIFICATION
        # ----------------------------------------------------

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
# API - AI ASSISTANT
# ============================================================

# ============================================================
# API - AI ASSISTANT
# ============================================================

@app.route(
    "/api/assistant",
    methods=["POST"]
)
def api_assistant():

    try:

        # ====================================================
        # 1. READ REQUEST
        # ====================================================

        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            data = {}

        question = data.get(
            "question",
            data.get("message", "")
        )

        if not isinstance(question, str):
            question = str(question)

        question = question.strip()

        if not question:
            return jsonify({
                "answer": "Please enter a question.",
                "sources": []
            })

        question_lower = question.lower()

        # ====================================================
        # 2. GET PREVIOUS CONVERSATION CONTEXT
        # ====================================================

        conversation_context = session.get(
            "assistant_context",
            {}
        )

        previous_service = conversation_context.get(
            "service"
        )

        previous_question = conversation_context.get(
            "question",
            ""
        )

        # ====================================================
        # 3. DETECT USER INTENT
        # ====================================================

        intent = "general"

        # Documents
        if any(
            phrase in question_lower
            for phrase in [
                "documents",
                "document",
                "proof",
                "papers",
                "what do i need",
                "what is required",
                "requirements"
            ]
        ):
            intent = "documents"

        # Fees
        elif any(
            phrase in question_lower
            for phrase in [
                "how much",
                "how much does",
                "cost",
                "costs",
                "fee",
                "fees",
                "price",
                "charge",
                "charges"
            ]
        ):
            intent = "fees"

        # Application
        elif any(
            phrase in question_lower
            for phrase in [
                "how do i apply",
                "how can i apply",
                "how to apply",
                "apply",
                "application",
                "register",
                "registration",
                "enrol",
                "enroll",
                "procedure",
                "process"
            ]
        ):
            intent = "application"

        # Eligibility
        elif any(
            phrase in question_lower
            for phrase in [
                "eligible",
                "eligibility",
                "qualify",
                "qualification",
                "who can apply",
                "can i apply"
            ]
        ):
            intent = "eligibility"

        # Processing time
        elif any(
            phrase in question_lower
            for phrase in [
                "how long",
                "processing time",
                "processing",
                "when will",
                "how much time",
                "time taken",
                "how many days"
            ]
        ):
            intent = "processing_time"

        # ====================================================
        # 4. LOAD SERVICES
        # ====================================================

        services_list = get_all_services()

        # ====================================================
        # 5. SERVICE ALIASES
        # ====================================================

        aliases = {

            "driving licence": [
                "driving licence",
                "driving license",
                "driver licence",
                "driver license",
                "dl"
            ],

            "income certificate": [
                "income certificate",
                "income proof"
            ],

            "pan card": [
                "pan card",
                "permanent account number",
                "pan"
            ],

            "aadhaar": [
                "aadhaar",
                "aadhar",
                "aadhaar card",
                "aadhar card"
            ],

            "passport": [
                "passport"
            ],

            "ration card": [
                "ration card"
            ],

            "voter id": [
                "voter id",
                "voter card",
                "election card"
            ],

            "caste certificate": [
                "caste certificate",
                "caste proof",
                "community certificate"
            ]
        }

        # ====================================================
        # 6. DETERMINE WHETHER USER EXPLICITLY
        #    MENTIONED A SERVICE
        # ====================================================

        explicit_service = None
        explicit_service_score = 0

        for service in services_list:

            service_name = str(
                service.get("name") or ""
            ).strip()

            service_name_lower = service_name.lower()

            if not service_name_lower:
                continue

            # -----------------------------------------------
            # Exact full service name
            # -----------------------------------------------

            if service_name_lower in question_lower:

                if len(service_name_lower) > explicit_service_score:

                    explicit_service = service
                    explicit_service_score = len(
                        service_name_lower
                    )

            # -----------------------------------------------
            # Check aliases
            # -----------------------------------------------

            for canonical_name, alias_list in aliases.items():

                if canonical_name in service_name_lower:

                    for alias in alias_list:

                        if alias in question_lower:

                            alias_score = len(alias) + 500

                            if alias_score > explicit_service_score:

                                explicit_service = service
                                explicit_service_score = alias_score

        # ====================================================
        # 7. FIND SERVICE USING SCORING
        # ====================================================

        matches = []

        ignored_words = {
            "what",
            "which",
            "where",
            "when",
            "how",
            "can",
            "could",
            "would",
            "should",
            "do",
            "does",
            "did",
            "is",
            "are",
            "the",
            "a",
            "an",
            "for",
            "of",
            "to",
            "in",
            "on",
            "my",
            "me",
            "please",
            "tell",
            "give",
            "required",
            "requirements",
            "documents",
            "document",
            "proof",
            "papers",
            "cost",
            "costs",
            "fee",
            "fees",
            "price",
            "charge",
            "charges",
            "apply",
            "application",
            "register",
            "registration",
            "eligible",
            "eligibility",
            "qualify",
            "qualification",
            "time",
            "long",
            "processing",
            "much"
        }

        query_words = [
            word
            for word in re.findall(
                r"[a-zA-Z0-9]+",
                question_lower
            )
            if len(word) > 2
            and word not in ignored_words
        ]

        for service in services_list:

            service_name = str(
                service.get("name") or ""
            ).strip()

            service_name_lower = service_name.lower()

            category = str(
                service.get("category") or ""
            ).lower()

            state = str(
                service.get("state") or ""
            ).lower()

            eligibility = str(
                service.get("eligibility") or ""
            ).lower()

            documents = str(
                service.get("documents_required") or ""
            ).lower()

            steps_value = service.get("steps")

            if isinstance(
                steps_value,
                list
            ):

                steps_text = " ".join(
                    str(step)
                    for step in steps_value
                ).lower()

            else:

                steps_text = str(
                    steps_value or ""
                ).lower()

            searchable = " ".join([
                service_name_lower,
                category,
                state,
                eligibility,
                documents,
                steps_text
            ])

            score = 0

            # Exact service
            if (
                service_name_lower
                and service_name_lower in question_lower
            ):
                score += 1000

            # Service words
            service_words = [
                word
                for word in re.findall(
                    r"[a-zA-Z0-9]+",
                    service_name_lower
                )
                if len(word) > 2
            ]

            for word in service_words:

                if word in question_lower:
                    score += 100

            # Alias matching
            for canonical_name, alias_list in aliases.items():

                if canonical_name in service_name_lower:

                    for alias in alias_list:

                        if alias in question_lower:
                            score += 500

            # General keyword matching
            for word in query_words:

                if word in service_name_lower:
                    score += 50

                elif word in category:
                    score += 20

                elif word in searchable:
                    score += 5

            if score > 0:

                matches.append(
                    (
                        score,
                        service
                    )
                )

        matches.sort(
            key=lambda item: item[0],
            reverse=True
        )

        # ====================================================
        # 8. EXPLICIT SERVICE ALWAYS WINS
        # ====================================================

        if explicit_service is not None:

            matches = [
                (
                    10000,
                    explicit_service
                )
            ]

        # ====================================================
        # 9. FOLLOW-UP QUESTION HANDLING
        #
        # If user says:
        #
        # "What documents are required for driving licence?"
        #
        # followed by:
        #
        # "How much does it cost?"
        #
        # the second question uses the previous service.
        #
        # BUT:
        #
        # "What documents are required for PAN?"
        #
        # explicitly mentions PAN, so PAN wins.
        # ====================================================

        elif (
            previous_service
            and intent != "general"
        ):

            previous_service_lower = str(
                previous_service
            ).strip().lower()

            previous_matches = [
                service
                for service in services_list
                if str(
                    service.get("name") or ""
                ).strip().lower()
                == previous_service_lower
            ]

            if previous_matches:

                matches = [
                    (
                        9000,
                        previous_matches[0]
                    )
                ]

        # ====================================================
        # 10. PM-KISAN SPECIAL CASE
        # ====================================================

        if (
            "pm-kisan" in question_lower
            or "pm kisan" in question_lower
            or "kisan" in question_lower
        ):

            answer = (
                "<strong>PM-KISAN</strong>"
                "<br><br>"
                "PM-KISAN is a Government of India "
                "scheme for eligible farmer families."
            )

            sources = [
                {
                    "name": "PM-KISAN Official Portal",
                    "source_url": (
                        "https://pmkisan.gov.in/"
                    )
                }
            ]

            session["assistant_context"] = {
                "service": "PM-KISAN",
                "intent": intent,
                "question": question
            }

            session.modified = True

            return jsonify({
                "answer": answer,
                "sources": sources,
                "context_service": "PM-KISAN"
            })
        # ====================================================
        # 11. NO MATCH
        # ====================================================

        if not matches:

            return jsonify({
                "answer": (
                    "I could not find a matching service "
                    "in the BharatAssist database.<br><br>"
                    "Try asking about a specific service such as "
                    "Driving Licence, Income Certificate, Passport, "
                    "Aadhaar, PAN, Ration Card, Voter ID or PM-KISAN."
                ),
                "sources": []
            })

        # ====================================================
        # 12. SELECT BEST SERVICE
        # ====================================================

        service = matches[0][1]

        service_name = str(
            service.get("name")
            or "Government Service"
        )

        eligibility = (
            service.get("eligibility")
            or "Not specified"
        )

        documents = (
            service.get("documents_required")
            or "Not specified"
        )

        fees = (
            service.get("fees")
            or "Not specified"
        )

        processing_time = (
            service.get("processing_time")
            or "Not specified"
        )

        steps = service.get("steps")

        # ====================================================
        # 13. FORMAT APPLICATION STEPS
        # ====================================================

        if isinstance(steps, list):

            steps_text = "<br>".join(
                str(step)
                for step in steps
            )

        else:

            steps_text = str(
                steps
                or "Application procedure not specified."
            )

        # ====================================================
        # 14. INTENT-SPECIFIC ANSWER
        # ====================================================

        if intent == "documents":

            answer = (
                f"<strong>{service_name}</strong>"
                "<br><br>"
                "<strong>Required Documents:</strong><br>"
                f"{documents}"
            )

        elif intent == "fees":

            answer = (
                f"<strong>{service_name}</strong>"
                "<br><br>"
                "<strong>Fees / Cost:</strong><br>"
                f"{fees}"
            )

        elif intent == "application":

            answer = (
                f"<strong>{service_name}</strong>"
                "<br><br>"
                "<strong>How to Apply:</strong><br>"
                f"{steps_text}"
            )

        elif intent == "eligibility":

            answer = (
                f"<strong>{service_name}</strong>"
                "<br><br>"
                "<strong>Eligibility:</strong><br>"
                f"{eligibility}"
            )

        elif intent == "processing_time":

            answer = (
                f"<strong>{service_name}</strong>"
                "<br><br>"
                "<strong>Processing Time:</strong><br>"
                f"{processing_time}"
            )

        else:

            answer = (
                f"<strong>{service_name}</strong>"
                "<br><br>"
                "<strong>Eligibility:</strong><br>"
                f"{eligibility}"
                "<br><br>"
                "<strong>Documents:</strong><br>"
                f"{documents}"
                "<br><br>"
                "<strong>Fees:</strong><br>"
                f"{fees}"
                "<br><br>"
                "<strong>Processing Time:</strong><br>"
                f"{processing_time}"
            )

        # ====================================================
        # 15. SOURCE
        # ====================================================

        sources = []

        source_url = normalize_url(
            service.get("source_url")
        )

        if source_url:

            sources.append({
                "name": service_name,
                "source_url": source_url
            })

        # ====================================================
        # 16. SAVE CONVERSATION CONTEXT
        # ====================================================

        session["assistant_context"] = {
            "service": service_name,
            "intent": intent,
            "question": question
        }

        session.modified = True

        # ====================================================
        # 17. RETURN RESPONSE
        # ====================================================

        return jsonify({
            "answer": answer,
            "sources": sources,
            "context_service": session.get(
                "assistant_context",
                {}
            ).get("service")
        })

    except Exception as e:

        print(
            "Assistant error:",
            repr(e)
        )

        return jsonify({
            "error": (
                "Assistant could not process "
                "the request."
            )
        }), 500
    # ============================================================
# CLEAR ASSISTANT CONVERSATION
# ============================================================

@app.route(
    "/api/assistant/clear",
    methods=["POST"]
)
def clear_assistant_conversation():

    try:
        # Remove the stored follow-up context
        session.pop(
            "assistant_context",
            None
        )

        session.modified = True

        return jsonify({
            "success": True,
            "message": "Conversation context cleared."
        })

    except Exception as e:

        print(
            "Clear conversation error:",
            repr(e)
        )

        return jsonify({
            "success": False,
            "error": (
                "Could not clear conversation."
            )
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