"""
Seed BharatAssist government services and build the RAG index.

Run:
    python seed_data.py
"""

import os
import sqlite3

from utils.rag import (
    add_service_to_index,
    init_vector_store,
)


# ============================================================
# DATABASE
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DB_PATH = os.path.join(
    BASE_DIR,
    "bharatassist.db"
)


# ============================================================
# SERVICES
# ============================================================

SAMPLE_SERVICES = [

    {
        "name": "PAN Card Application",
        "category": "Identity Document",
        "state": "All India",
        "eligibility": "Any Indian citizen, including minors through a guardian",
        "documents_required": "Proof of identity, proof of address, proof of date of birth and photograph",
        "steps": "1. Apply through the official PAN service. 2. Fill in the required application details. 3. Submit supporting documents. 4. Pay the applicable fee. 5. Complete verification or e-sign where required. 6. Track the application.",
        "fees": "Depends on application type and communication address",
        "processing_time": "Usually several working days",
        "source_url": "https://www.incometax.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Passport Application (Fresh)",
        "category": "Travel Document",
        "state": "All India",
        "eligibility": "Indian citizens meeting the requirements for obtaining a passport",
        "documents_required": "Proof of address, proof of date of birth, identity documents and other documents as applicable",
        "steps": "1. Register on Passport Seva. 2. Fill the passport application. 3. Pay the applicable fee. 4. Book an appointment. 5. Visit the Passport Seva Kendra. 6. Complete verification. 7. Track passport dispatch.",
        "fees": "Depends on passport type and normal or Tatkal service",
        "processing_time": "Varies depending on verification and application type",
        "source_url": "https://www.passportindia.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Ration Card (New Application)",
        "category": "Welfare / Food Security",
        "state": "All India",
        "eligibility": "Eligible households meeting the applicable state food security requirements",
        "documents_required": "Identity proof, address proof, family details and income-related documents where applicable",
        "steps": "1. Apply through the state food and civil supplies department. 2. Submit required documents. 3. Complete verification if required. 4. Ration card is issued after approval.",
        "fees": "Varies by state",
        "processing_time": "Varies by state",
        "source_url": "https://nfsa.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Income Certificate",
        "category": "Certificate",
        "state": "All India",
        "eligibility": "Residents applying for an official income certificate for eligible purposes",
        "documents_required": "Identity proof, address proof, income proof and self-declaration where required",
        "steps": "1. Apply through the relevant state e-District portal or local authority. 2. Submit documents. 3. Complete verification. 4. Download or collect the certificate.",
        "fees": "Varies by state",
        "processing_time": "Usually several working days",
        "source_url": "https://edistrict.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Driving Licence (Learner's)",
        "category": "Transport",
        "state": "All India",
        "eligibility": "Applicants meeting the applicable age and licensing requirements",
        "documents_required": "Age proof, address proof, photograph and medical certificate where applicable",
        "steps": "1. Apply through Parivahan. 2. Submit the required information. 3. Book a learner licence test. 4. Take the required test. 5. Receive the learner licence after approval.",
        "fees": "Varies according to licence type and applicable state charges",
        "processing_time": "Usually shortly after successful test and verification",
        "source_url": "https://parivahan.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Driving Licence (Permanent)",
        "category": "Transport",
        "state": "All India",
        "eligibility": "Learner licence holders who satisfy the requirements for a permanent driving licence",
        "documents_required": "Learner licence, identity proof, address proof and other required documents",
        "steps": "1. Apply through Parivahan. 2. Book a driving test. 3. Attend the test with required documents and vehicle. 4. Pass the driving test. 5. Licence is issued after approval.",
        "fees": "Varies according to licence type and state charges",
        "processing_time": "Varies by state and appointment availability",
        "source_url": "https://parivahan.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Voter ID Registration",
        "category": "Identity Document",
        "state": "All India",
        "eligibility": "Eligible Indian citizens who meet the applicable voter registration requirements",
        "documents_required": "Age proof, address proof and recent photograph",
        "steps": "1. Visit the official voter services portal. 2. Select new voter registration. 3. Fill the application. 4. Upload supporting documents. 5. Submit the application. 6. Track verification and application status.",
        "fees": "No application fee",
        "processing_time": "Varies according to verification and electoral roll processing",
        "source_url": "https://voters.eci.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Aadhaar Update",
        "category": "Identity Document",
        "state": "All India",
        "eligibility": "Aadhaar holders who need to update eligible demographic or biometric information",
        "documents_required": "Aadhaar number and supporting documents depending on the information being updated",
        "steps": "1. Identify the information that needs updating. 2. Use an available UIDAI online service or visit an Aadhaar centre. 3. Submit supporting documents. 4. Complete biometric verification if required. 5. Track the update request.",
        "fees": "Depends on the type of update",
        "processing_time": "Varies depending on the update request",
        "source_url": "https://uidai.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Birth Certificate",
        "category": "Civil Certificate",
        "state": "All India",
        "eligibility": "Parents, guardians or authorized applicants registering a birth",
        "documents_required": "Birth details, hospital record where applicable, identity proof and address proof",
        "steps": "1. Report the birth to the appropriate authority. 2. Submit the required information and documents. 3. Complete verification. 4. Obtain the birth certificate.",
        "fees": "Varies by local authority",
        "processing_time": "Varies by local authority",
        "source_url": "https://crsorgi.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Death Certificate",
        "category": "Civil Certificate",
        "state": "All India",
        "eligibility": "Family member, relative or authorized person registering a death",
        "documents_required": "Death details, medical or institutional record where applicable, identity proof and address proof",
        "steps": "1. Report the death to the appropriate authority. 2. Submit required documents. 3. Complete verification. 4. Obtain the death certificate.",
        "fees": "Varies by local authority",
        "processing_time": "Varies by local authority",
        "source_url": "https://crsorgi.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Caste Certificate",
        "category": "Certificate",
        "state": "All India",
        "eligibility": "Eligible applicants belonging to communities recognized under applicable government rules",
        "documents_required": "Identity proof, address proof and documents supporting caste or community status",
        "steps": "1. Apply through the relevant state portal or authority. 2. Submit supporting documents. 3. Complete verification. 4. Receive the certificate.",
        "fees": "Varies by state",
        "processing_time": "Varies by state and verification requirements",
        "source_url": "https://services.india.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Domicile Certificate",
        "category": "Certificate",
        "state": "All India",
        "eligibility": "Residents satisfying the domicile requirements of the relevant state or union territory",
        "documents_required": "Identity proof, residence proof and other state-specific supporting documents",
        "steps": "1. Apply through the relevant state portal or local authority. 2. Submit documents. 3. Complete verification. 4. Receive the certificate.",
        "fees": "Varies by state",
        "processing_time": "Varies by state",
        "source_url": "https://services.india.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Ayushman Bharat PM-JAY",
        "category": "Health Welfare Scheme",
        "state": "All India",
        "eligibility": "Eligible families identified under the applicable PM-JAY eligibility criteria",
        "documents_required": "Identity documents and information required for beneficiary verification",
        "steps": "1. Check eligibility. 2. Complete beneficiary verification. 3. Obtain beneficiary identification details. 4. Use the scheme at an empanelled hospital.",
        "fees": "No premium for eligible beneficiaries under the scheme",
        "processing_time": "Depends on beneficiary verification",
        "source_url": "https://pmjay.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "PM-KISAN Registration",
        "category": "Agriculture Welfare",
        "state": "All India",
        "eligibility": "Eligible farmer families meeting the applicable PM-KISAN requirements",
        "documents_required": "Aadhaar details, land-related information and bank account details where applicable",
        "steps": "1. Visit the PM-KISAN portal. 2. Complete farmer registration. 3. Provide required details. 4. Complete verification. 5. Track beneficiary status.",
        "fees": "No application fee",
        "processing_time": "Depends on verification and approval",
        "source_url": "https://pmkisan.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "e-Shram Registration",
        "category": "Employment / Social Security",
        "state": "All India",
        "eligibility": "Eligible unorganised workers meeting the applicable e-Shram criteria",
        "documents_required": "Aadhaar number, mobile number and bank account details where applicable",
        "steps": "1. Visit the e-Shram portal. 2. Complete registration. 3. Verify required details. 4. Enter worker information. 5. Generate the e-Shram card.",
        "fees": "No registration fee",
        "processing_time": "Usually immediate after successful registration",
        "source_url": "https://eshram.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "National Scholarship Portal Application",
        "category": "Education",
        "state": "All India",
        "eligibility": "Students meeting the eligibility requirements of the selected scholarship scheme",
        "documents_required": "Student identity details, educational records, bank information and scheme-specific documents",
        "steps": "1. Register on the National Scholarship Portal. 2. Select the applicable scholarship. 3. Complete the application. 4. Upload documents. 5. Submit and track verification.",
        "fees": "Usually no application fee",
        "processing_time": "Varies by scholarship and verification",
        "source_url": "https://scholarships.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Employment Exchange Registration",
        "category": "Employment",
        "state": "All India",
        "eligibility": "Job seekers eligible to register with the relevant state employment service",
        "documents_required": "Identity proof, address proof, educational certificates and employment-related details",
        "steps": "1. Visit the relevant employment exchange service. 2. Register as a job seeker. 3. Enter personal and educational details. 4. Upload documents where required. 5. Save registration details.",
        "fees": "Usually no registration fee",
        "processing_time": "Varies by state",
        "source_url": "https://services.india.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Marriage Certificate",
        "category": "Civil Service",
        "state": "All India",
        "eligibility": "Couples meeting the applicable marriage registration requirements",
        "documents_required": "Identity proof, address proof, photographs, marriage-related documents and witness information where required",
        "steps": "1. Apply to the appropriate marriage registration authority. 2. Submit documents. 3. Attend verification or appointment if required. 4. Complete registration. 5. Receive the certificate.",
        "fees": "Varies by state and registration type",
        "processing_time": "Varies by registering authority",
        "source_url": "https://services.india.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Vehicle Registration",
        "category": "Transport",
        "state": "All India",
        "eligibility": "Vehicle owners required to register vehicles under applicable motor vehicle rules",
        "documents_required": "Sale certificate, insurance, address proof, vehicle documents and applicable tax or fee documents",
        "steps": "1. Submit the vehicle registration application. 2. Provide vehicle and owner documents. 3. Complete inspection where required. 4. Pay applicable fees and taxes. 5. Receive the registration certificate.",
        "fees": "Depends on vehicle type and applicable state charges",
        "processing_time": "Varies by registering authority",
        "source_url": "https://parivahan.gov.in/",
        "last_verified": "2026-08-16",
    },

    {
        "name": "Skill Development Registration",
        "category": "Skill Development",
        "state": "All India",
        "eligibility": "Individuals interested in eligible government skill development and training programmes",
        "documents_required": "Identity proof, educational information and programme-specific documents",
        "steps": "1. Find an eligible training programme. 2. Register through the relevant government skill portal. 3. Submit personal and educational details. 4. Select training where available. 5. Complete enrolment.",
        "fees": "Depends on the selected programme",
        "processing_time": "Varies by programme and training provider",
        "source_url": "https://www.skillindia.gov.in/",
        "last_verified": "2026-08-16",
    },

]


# ============================================================
# DATABASE CLEANUP
# ============================================================

def clear_services():
    """
    Remove old duplicate service records.
    """

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute("DELETE FROM services")

    conn.commit()
    conn.close()

    print("✓ Old service records removed.")


# ============================================================
# RAG CLEANUP
# ============================================================

def clear_rag_index():
    """
    Remove old records from the Chroma collection.
    """

    collection = init_vector_store()

    try:
        existing = collection.get()

        ids = existing.get("ids", [])

        if ids:
            collection.delete(ids=ids)
            print(f"✓ Removed {len(ids)} old RAG records.")
        else:
            print("✓ RAG index was already empty.")

    except Exception as e:
        print("⚠ Could not clear old RAG records:", e)


# ============================================================
# SEED DATABASE
# ============================================================

def run():

    print()
    print("==========================================")
    print("       BharatAssist Database Seeder")
    print("==========================================")
    print()

    # Remove duplicates
    clear_services()

    # Remove old RAG records
    clear_rag_index()

    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print()
    print(
        f"Adding {len(SAMPLE_SERVICES)} government services..."
    )
    print()

    for service in SAMPLE_SERVICES:

        # ------------------------------------------
        # Insert service into SQLite
        # ------------------------------------------

        cur.execute(
            """
            INSERT INTO services
            (
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
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                service["name"],
                service["category"],
                service["state"],
                service["eligibility"],
                service["documents_required"],
                service["steps"],
                service["fees"],
                service["processing_time"],
                service["source_url"],
                service["last_verified"],
            ),
        )

        service_id = cur.lastrowid

        # ------------------------------------------
        # Create RAG document
        # ------------------------------------------

        text_blob = (
            f"Service: {service['name']}. "
            f"Category: {service['category']}. "
            f"State: {service['state']}. "
            f"Eligibility: {service['eligibility']}. "
            f"Documents required: "
            f"{service['documents_required']}. "
            f"Steps: {service['steps']}. "
            f"Fees: {service['fees']}. "
            f"Processing time: "
            f"{service['processing_time']}. "
            f"Official source: "
            f"{service['source_url']}. "
            f"Last verified: "
            f"{service['last_verified']}."
        )

        # ------------------------------------------
        # Add to ChromaDB
        # ------------------------------------------

        add_service_to_index(
            service_id=service_id,
            name=service["name"],
            text_blob=text_blob,
            category=service["category"],
            state=service["state"],
            source_url=service["source_url"],
            last_verified=service["last_verified"],
        )

        print(
            f"✓ {service['name']}"
        )

    # Save database
    conn.commit()
    conn.close()

    print()
    print("==========================================")
    print("              SEEDING COMPLETE")
    print("==========================================")
    print(
        f"Total services added: {len(SAMPLE_SERVICES)}"
    )
    print("SQLite database updated.")
    print("RAG index updated.")
    print("==========================================")
    print()


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    run()