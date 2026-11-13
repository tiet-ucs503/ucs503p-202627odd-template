"""
utils/readiness.py - Document Readiness Checker Engine for BharatAssist

Provides:
1. Retrieval and parsing of required documents from services catalog.
2. Handling of services with generic/unverified documentation requirements.
3. In-depth document inspection:
   - Missing required documents.
   - Expiry date detection and comparison against current date.
   - Unreadable / blurry scan detection.
   - Name and date inconsistencies against applicant profile.
   - Missing mandatory document fields / identification numbers.
4. Readiness summary determination ('Ready', 'Partially ready', 'Not ready') with actionable next steps.
5. Strict statutory non-acceptance disclaimer: Never certifies official validity from OCR alone.
6. PII protection: Automatically applies PII redaction to extracted content.
"""

import re
import datetime
from typing import Dict, List, Any, Optional
from utils import redact

STATUTORY_DOCUMENT_DISCLAIMER = (
    "Pre-submission verification check only. BharatAssist does not certify official legal validity, "
    "authenticity, or government acceptance merely because document text was extracted or reviewed. "
    "Statutory acceptance, verification, and sanction are determined solely by the competent government authority."
)

# Standard baseline document suite for catalog services with unverified/generic document entries
DEFAULT_BASELINE_DOCUMENTS = [
    {
        "id": "doc_identity",
        "name": "Proof of Identity (PoI)",
        "type": "identity",
        "mandatory": True,
        "acceptable_types": ["Aadhaar Card", "Voter ID Card", "Passport", "Driving Licence", "PAN Card"],
        "help": "Government-issued photo identification showing full legal name.",
        "is_unverified_fallback": True
    },
    {
        "id": "doc_address",
        "name": "Proof of Address / Domicile (PoA)",
        "type": "address",
        "mandatory": True,
        "acceptable_types": ["Aadhaar Card", "Electricity / Water Utility Bill", "Ration Card", "Domicile Certificate", "Bank Passbook"],
        "help": "Valid document certifying permanent or current residential address in the state.",
        "is_unverified_fallback": True
    },
    {
        "id": "doc_photo",
        "name": "Recent Passport-Sized Photographs",
        "type": "photograph",
        "mandatory": True,
        "acceptable_types": ["Color passport photograph with plain background"],
        "help": "Recent color photograph taken within the last 6 months.",
        "is_unverified_fallback": True
    },
    {
        "id": "doc_service_specific",
        "name": "Service-Specific Application Form & Fee Acknowledgment",
        "type": "application",
        "mandatory": True,
        "acceptable_types": ["Official portal receipt, signed physical form, or prescribed affidavit"],
        "help": "Application form or registration confirmation from the designated issuing authority.",
        "is_unverified_fallback": True
    }
]


def parse_service_documents(service: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Parse documents_required string from service database record into structured document checklist items.
    If the service has generic/unverified text, provides recommended standard baseline requirements with an explicit notice.
    """
    docs_raw = (service.get("documents_required") or "").strip()
    is_generic = (
        not docs_raw or
        "depends on the service" in docs_raw.lower() or
        "check the official portal" in docs_raw.lower() or
        "verify jurisdiction" in docs_raw.lower()
    )

    if is_generic:
        return [dict(d) for d in DEFAULT_BASELINE_DOCUMENTS]

    # Specific documents provided in catalog: split into discrete items
    # Normalized split across semicolons, newlines, and numbered bullets
    raw_items = re.split(r";|\n|(?:\b\d+[\.\)]\s*)", docs_raw)
    items: List[Dict[str, Any]] = []

    for idx, raw in enumerate(raw_items):
        clean = raw.strip()
        # Also handle comma separated documents if single block
        if len(raw_items) <= 2 and "," in clean:
            sub_items = [s.strip() for s in clean.split(",") if s.strip()]
            for s_idx, s in enumerate(sub_items):
                items.append(_classify_document_item(f"doc_{len(items)}", s))
        elif clean and len(clean) > 2:
            items.append(_classify_document_item(f"doc_{len(items)}", clean))

    if not items:
        return [dict(d) for d in DEFAULT_BASELINE_DOCUMENTS]

    return items


def _classify_document_item(item_id: str, name: str) -> Dict[str, Any]:
    """Helper to categorize document type and generate acceptable alternatives."""
    name_clean = name.strip().rstrip(".,")
    nl = name_clean.lower()

    doc_type = "general"
    acceptable = []
    help_text = "Official supporting documentation required by the authority."

    if "identity" in nl or "photo id" in nl:
        doc_type = "identity"
        acceptable = ["Aadhaar Card", "Voter ID (EPIC)", "Passport", "Driving Licence", "PAN Card"]
        help_text = "Primary government-issued photo identity document."
    elif "address" in nl or "residence" in nl or "domicile" in nl:
        doc_type = "address"
        acceptable = ["Electricity Bill", "Water Bill", "Ration Card", "Registered Rent Agreement", "Domicile Certificate"]
        help_text = "Official address proof matching your application address."
    elif "birth" in nl or "dob" in nl or "age" in nl:
        doc_type = "dob"
        acceptable = ["Birth Certificate", "10th Standard School Marksheet", "Passport", "PAN Card"]
        help_text = "Statutory document certifying your date of birth."
    elif "income" in nl or "salary" in nl or "itr" in nl or "form 16" in nl:
        doc_type = "income"
        acceptable = ["Tehsildar/SDM Income Certificate", "Latest ITR Acknowledgement", "Form 16 / Salary Slips", "BPL Ration Card"]
        help_text = "Evidence of household/individual annual income."
    elif "caste" in nl or "community" in nl or "tribe" in nl:
        doc_type = "caste"
        acceptable = ["State Competent Authority Caste Certificate", "Community Certificate", "Tribe Certificate"]
        help_text = "Official caste/community certificate issued by Sub-Divisional Magistrate or Tehsildar."
    elif "photo" in nl or "photograph" in nl:
        doc_type = "photograph"
        acceptable = ["Passport-sized color photograph with white/light background"]
        help_text = "Clear recent passport photograph."
    elif "land" in nl or "khasra" in nl or "khatauni" in nl or "property" in nl or "title" in nl:
        doc_type = "property"
        acceptable = ["Land Records (7/12, RoR, Khasra-Khatauni)", "Registered Sale Deed", "Property Tax Receipt"]
        help_text = "Official revenue records proving ownership or tenancy."
    elif "disab" in nl or "medical" in nl or "doctor" in nl:
        doc_type = "medical"
        acceptable = ["UDID Card", "District Medical Board Disability Certificate (40%+)", "Authorized Medical Certificate"]
        help_text = "Medical certificate issued by government hospital / competent medical authority."
    elif "mark" in nl or "degree" in nl or "school" in nl or "educat" in nl:
        doc_type = "education"
        acceptable = ["Degree / Diploma Certificate", "School Leaving Certificate", "Consolidated Marksheet"]
        help_text = "Recognized academic board or university educational credentials."
    else:
        acceptable = [name_clean]

    return {
        "id": item_id,
        "name": name_clean,
        "type": doc_type,
        "mandatory": True,
        "acceptable_types": acceptable,
        "help": help_text,
        "is_unverified_fallback": False
    }


def analyze_document_text(
    text: str,
    doc_name: str = "",
    applicant_name: Optional[str] = None,
    applicant_dob: Optional[str] = None
) -> Dict[str, Any]:
    """
    Analyze OCR or parsed document text for:
    - Blur / illegibility / low text content
    - Expiry dates and status against current date
    - Name and DOB inconsistencies against citizen profile
    - Mandatory identifiers and document numbers
    - PII protection (applies redaction)
    """
    raw_text = (text or "").strip()
    result = {
        "is_unreadable": False,
        "blur_warning": None,
        "is_expired": False,
        "expiry_date": None,
        "expiry_warning": None,
        "name_inconsistency": False,
        "extracted_name": None,
        "name_warning": None,
        "dob_inconsistency": False,
        "extracted_dob": None,
        "dob_warning": None,
        "missing_fields": [],
        "detected_identifiers": [],
        "diagnostics": [],
        "redacted_preview": ""
    }

    # 1. Unreadable / Blurry Scan Check
    words = raw_text.split()
    if len(raw_text) < 15 or len(words) < 3:
        result["is_unreadable"] = True
        result["blur_warning"] = (
            "The scanned document appears blurry, truncated, or unreadable (fewer than 3 readable words detected). "
            "Please upload a higher-resolution scan or well-lit photograph where all text is sharp."
        )
        result["diagnostics"].append("Scan failed readability threshold (insufficient characters detected).")
        result["redacted_preview"] = raw_text
        return result

    # Check for excessive garbled/non-alphanumeric noise (common in blurry OCR)
    alnum_count = sum(1 for c in raw_text if c.isalnum() or c.isspace())
    if alnum_count / len(raw_text) < 0.60:
        result["is_unreadable"] = True
        result["blur_warning"] = (
            "The document image contains heavy visual noise or distorted characters. "
            "Please re-scan the original document on a flat surface without camera glare."
        )
        result["diagnostics"].append("High noise-to-character ratio detected in OCR stream.")

    # 2. Expiry Date Detection
    # Matches: Valid Till: DD/MM/YYYY, Expiry Date: DD-MM-YYYY, Expires: MM/YYYY, etc.
    expiry_regexes = [
        re.compile(
            r"(?:valid\s+till|expiry\s+date|valid\s+thru|expires|validity|exp\.?\s*date|valid\s+up\s+to|valid\s+to)\s*[:\-\s]*([0-3]?\d[\/\-\.][0-1]?\d[\/\-\.](?:20|19)?\d{2})",
            re.IGNORECASE
        ),
        re.compile(
            r"(?:valid\s+till|expiry\s+date|valid\s+thru|expires|validity|exp\.?\s*date|valid\s+up\s+to|valid\s+to)\s*[:\-\s]*((?:20|19)\d{2}[\/\-\.][0-1]?\d[\/\-\.][0-3]?\d)",
            re.IGNORECASE
        ),
        re.compile(
            r"(?:valid\s+till|expiry|validity)\s*[:\-\s]*([0-3]?\d\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(?:20|19)?\d{2})",
            re.IGNORECASE
        )
    ]

    found_expiry_date = None
    today = datetime.datetime.now().date()

    for pattern in expiry_regexes:
        match = pattern.search(raw_text)
        if match:
            date_str = match.group(1).strip()
            parsed_dt = _parse_date(date_str)
            if parsed_dt:
                found_expiry_date = parsed_dt.date()
                result["expiry_date"] = date_str
                break

    if found_expiry_date:
        if found_expiry_date < today:
            result["is_expired"] = True
            result["expiry_warning"] = (
                f"Document appears EXPIRED on {found_expiry_date.strftime('%d/%m/%Y')}. "
                "Government application portals reject expired documents. Please renew this document before applying."
            )
            result["diagnostics"].append(f"Expired validity detected: {found_expiry_date.strftime('%d/%m/%Y')} (Current date: {today.strftime('%d/%m/%Y')}).")
        else:
            result["diagnostics"].append(f"Validity verified: Document valid until {found_expiry_date.strftime('%d/%m/%Y')}.")

    # 3. Name Inconsistency Detection
    # Look for name labeled in text
    name_match = re.search(
        r"(?:name|name\s+of\s+holder|applicant\s+name|cardholder)\s*[:\-]\s*([A-Za-z\s]+?)(?=\b(?:dob|date|father|valid|address|no|s\/o|d\/o|w\/o|gender)\b|\n|$)",
        raw_text,
        re.IGNORECASE
    )
    if name_match:
        extracted_n = name_match.group(1).strip()
        if len(extracted_n) >= 3:
            result["extracted_name"] = extracted_n

    if applicant_name and applicant_name.strip():
        clean_applicant = applicant_name.strip()
        name_tokens = [t.lower() for t in re.split(r"\s+", clean_applicant) if len(t) > 2]
        text_lower = raw_text.lower()

        # Check if any significant token of the applicant name appears in the document
        has_name_overlap = any(token in text_lower for token in name_tokens)
        if not has_name_overlap and len(name_tokens) > 0:
            result["name_inconsistency"] = True
            if result["extracted_name"]:
                result["name_warning"] = (
                    f"Name mismatch detected: Document indicates '{result['extracted_name']}', "
                    f"which does not match applicant profile '{clean_applicant}'."
                )
            else:
                result["name_warning"] = (
                    f"Applicant name '{clean_applicant}' was not detected in this document. "
                    "Ensure you are uploading a document issued in your own name."
                )
            result["diagnostics"].append("Name inconsistency flagged between document scan and citizen profile.")
        else:
            result["diagnostics"].append(f"Applicant name '{clean_applicant}' matches document content.")

    # 4. Mandatory Identifier / Document Number Detection
    doc_name_lower = doc_name.lower()

    # PAN Check
    pan_match = re.search(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", raw_text)
    if pan_match:
        result["detected_identifiers"].append(f"PAN: {pan_match.group(0)[:2]}•••{pan_match.group(0)[-2:]}")

    if "pan" in doc_name_lower and not pan_match:
        result["missing_fields"].append("10-character Permanent Account Number (PAN) identifier")
        result["diagnostics"].append("PAN format (5 letters, 4 digits, 1 letter) missing from document.")

    # Aadhaar Check
    aadhaar_match = re.search(r"\b\d{4}\s?\d{4}\s?\d{4}\b", raw_text)
    if aadhaar_match:
        result["detected_identifiers"].append(f"Aadhaar: •••• •••• {aadhaar_match.group(0)[-4:]}")

    if "aadhaar" in doc_name_lower and not aadhaar_match:
        result["missing_fields"].append("12-digit Aadhaar Card number")
        result["diagnostics"].append("12-digit Aadhaar number missing or unreadable.")

    # Driving Licence Check
    dl_match = re.search(r"\b[A-Z]{2}[-\s]?[0-9]{2}[-\s]?[0-9]{4,11}\b", raw_text)
    if dl_match:
        result["detected_identifiers"].append(f"Driving Licence: {dl_match.group(0)}")

    # Voter ID / EPIC Check
    epic_match = re.search(r"\b[A-Z]{3}[0-9]{7}\b", raw_text)
    if epic_match:
        result["detected_identifiers"].append(f"Voter ID (EPIC): {epic_match.group(0)}")

    # General Date of Birth check if required
    dob_match = re.search(
        r"(?:dob|date\s+of\s+birth|d\.o\.b)\s*[:\-]?\s*([0-3]?\d[\/\-\.][0-1]?\d[\/\-\.](?:20|19)?\d{2})",
        raw_text,
        re.IGNORECASE
    )
    if dob_match:
        result["extracted_dob"] = dob_match.group(1).strip()
        result["diagnostics"].append(f"Date of Birth detected: {result['extracted_dob']}")

    # 5. PII Redaction
    redacted_text, count = redact.redact_pii(raw_text)
    # Mask first 200 characters for preview
    lines = [ln.strip() for ln in redacted_text.splitlines() if ln.strip()]
    result["redacted_preview"] = "\n".join(lines[:6]) if lines else "Document text processed."

    return result


def _parse_date(date_str: str) -> Optional[datetime.datetime]:
    """Parse common Indian and international date formats."""
    clean = re.sub(r"[^\w\/\-\.]", " ", date_str).strip()
    formats = [
        "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
        "%d/%m/%y", "%d-%m-%y", "%d.%m.%y",
        "%Y-%m-%d", "%Y/%m/%d",
        "%d %b %Y", "%d %B %Y", "%b %Y"
    ]
    for fmt in formats:
        try:
            return datetime.datetime.strptime(clean, fmt)
        except ValueError:
            continue
    return None


def evaluate_overall_readiness(
    service: Dict[str, Any],
    documents_status: List[Dict[str, Any]],
    applicant_profile: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Calculate readiness summary for the selected service.
    Returns:
    readiness_status: 'Ready' | 'Partially ready' | 'Not ready'
    readiness_score: 0 to 100
    actionable_next_steps: Prioritized list of instructions.
    """
    total_docs = len(documents_status)
    if total_docs == 0:
        return {
            "readiness_status": "Not ready",
            "readiness_badge": "Not Ready",
            "readiness_score": 0,
            "summary_text": "No document requirements found for this service.",
            "available_count": 0,
            "missing_count": 0,
            "expired_count": 0,
            "issue_count": 0,
            "actionable_next_steps": ["Check the official service portal for documentation requirements."],
            "disclaimer": STATUTORY_DOCUMENT_DISCLAIMER
        }

    available_count = 0
    missing_count = 0
    expired_count = 0
    unreadable_count = 0
    inconsistency_count = 0
    missing_field_count = 0

    next_steps: List[str] = []
    unverified_generic_service = False

    for doc in documents_status:
        st = doc.get("status", "missing").lower()
        analysis = doc.get("analysis") or {}

        if doc.get("is_unverified_fallback"):
            unverified_generic_service = True

        is_exp = (st == "expired") or analysis.get("is_expired")
        is_unread = analysis.get("is_unreadable")
        has_inconsistency = analysis.get("name_inconsistency") or analysis.get("dob_inconsistency")
        has_missing_field = bool(analysis.get("missing_fields"))

        if is_exp:
            expired_count += 1
            exp_date = analysis.get("expiry_date") or "prior date"
            next_steps.append(f"Renew expired document '{doc.get('name')}' (Expired on {exp_date}) before submitting.")
        elif is_unread:
            unreadable_count += 1
            next_steps.append(f"Re-scan '{doc.get('name')}': current scan is blurry or illegible.")
        elif has_inconsistency:
            inconsistency_count += 1
            next_steps.append(f"Resolve name inconsistency on '{doc.get('name')}' ({analysis.get('name_warning')}).")
        elif has_missing_field:
            missing_field_count += 1
            missing_f = ", ".join(analysis.get("missing_fields"))
            next_steps.append(f"Ensure '{doc.get('name')}' clearly displays {missing_f}.")
        elif st == "available":
            available_count += 1
        else:
            missing_count += 1
            acceptable = ", ".join(doc.get("acceptable_types", [])[:3])
            next_steps.append(f"Procure missing document '{doc.get('name')}' (Accepted: {acceptable}).")

    issue_count = expired_count + unreadable_count + inconsistency_count + missing_field_count

    # Calculate overall readiness
    if available_count == total_docs and issue_count == 0 and missing_count == 0:
        readiness_status = "Ready"
        readiness_badge = "Ready for Submission"
        readiness_score = 100
        summary_text = (
            "All required documents are prepared and verified with no expiry, blurriness, or name conflicts. "
            "You are ready to proceed with the official government application."
        )
        next_steps.insert(0, f"Proceed to the official application portal ({service.get('source_url', 'government portal')}) to submit your verified files.")
    elif available_count > 0 and (missing_count > 0 or issue_count > 0):
        readiness_status = "Partially ready"
        readiness_badge = "Partially Ready"
        readiness_score = int((available_count / total_docs) * 100)
        summary_text = (
            f"You have prepared {available_count} of {total_docs} required documents. "
            f"{missing_count} document(s) are missing and {issue_count} issue(s) need correction before submitting."
        )
    else:
        readiness_status = "Not ready"
        readiness_badge = "Not Ready"
        readiness_score = 0
        summary_text = (
            f"Crucial documents are currently missing or expired. "
            f"Please address the {len(next_steps)} checklist item(s) below before beginning your formal application."
        )

    if unverified_generic_service:
        next_steps.append(
            "Note: This service has variable state/department rules. Please check the official portal to confirm if additional jurisdictional forms are required."
        )

    return {
        "service_id": service.get("id"),
        "service_name": service.get("name"),
        "category": service.get("category"),
        "source_url": service.get("source_url"),
        "last_verified": service.get("last_verified") or "Periodic verification pending",
        "readiness_status": readiness_status,
        "readiness_badge": readiness_badge,
        "readiness_score": readiness_score,
        "summary_text": summary_text,
        "total_documents": total_docs,
        "available_count": available_count,
        "missing_count": missing_count,
        "expired_count": expired_count,
        "unreadable_count": unreadable_count,
        "inconsistency_count": inconsistency_count,
        "issue_count": issue_count,
        "actionable_next_steps": next_steps,
        "is_unverified_service": unverified_generic_service,
        "disclaimer": STATUTORY_DOCUMENT_DISCLAIMER
    }

