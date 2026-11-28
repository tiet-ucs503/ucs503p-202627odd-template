"""
utils/eligibility.py - Smart Government Scheme Eligibility Checker Engine

Provides dynamic, rule-governed pre-screening eligibility evaluation across all 226 services
in BharatAssist's catalog.

Key Features:
1. Dynamic questions generator: Asks only questions relevant to the selected domain or scheme.
2. Rule and database matching: Evaluates age, income, state/district, occupation, and scheme-specific constraints.
3. Categorizes status into:
   - 'confirmed_eligible' (Pre-Screening Passed; clearly disclaiming that final statutory sanction rests with authorities)
   - 'potentially_eligible' (Basic criteria match; requires authority/portal document verification)
   - 'insufficient_info' (Follow-up questions returned to clarify status)
   - 'ineligible' (Clear condition failure explained)
4. Multi-scheme comparison helper.
5. Statutory disclaimer enforcement: Never guarantees government approval.
"""

import re
import sqlite3
from typing import Dict, List, Any, Optional

# Major thematic categories for citizens
CATEGORY_GROUPS = {
    "all": {
        "name": "All Government Schemes",
        "description": "Evaluate your eligibility across all 226 Central and State schemes in the directory.",
        "icon": "fa-layer-group",
        "db_categories": []  # Matches all
    },
    "agriculture": {
        "name": "Agriculture & Farmers",
        "description": "Schemes for small/marginal farmers, crop insurance, Kisan Credit, subsidies and agricultural welfare.",
        "icon": "fa-seedling",
        "db_categories": [
            "Agriculture Welfare", "Agriculture", "Agriculture/Social Security",
            "Agriculture/Insurance", "Agriculture/Finance", "Agriculture/Welfare"
        ]
    },
    "education": {
        "name": "Students, Education & Scholarships",
        "description": "Scholarships, fee concessions, student loans, skill training, and digital student services.",
        "icon": "fa-graduation-cap",
        "db_categories": [
            "Education", "Skill Development", "Skills/Education", "Education/Scholarship",
            "Education/Digital Government", "Education/Welfare"
        ]
    },
    "pension_senior": {
        "name": "Senior Citizens & Pensions",
        "description": "Old age pensions, Atal Pension Yojana, senior citizen concessions, and social security pensions.",
        "icon": "fa-person-cane",
        "db_categories": [
            "Pension", "Pension/Finance", "Pension/Social Security", "Pension/Welfare",
            "Welfare / Social Security"
        ]
    },
    "health": {
        "name": "Healthcare & Disability Assistance",
        "description": "Ayushman Bharat PM-JAY, health accounts (ABHA), UDID disability cards and health insurance.",
        "icon": "fa-heart-pulse",
        "db_categories": [
            "Health Welfare Scheme", "Health/Disability", "Health/Social Security",
            "Health/Digital Health", "Health", "Health/Welfare", "Health / Social Security"
        ]
    },
    "women_child": {
        "name": "Women & Child Welfare",
        "description": "Maternity benefits (PMMVY), savings schemes (Mahila Samman), women empowerment and nutrition.",
        "icon": "fa-person-breastfeeding",
        "db_categories": [
            "Women/Child Welfare", "Women/Grievance"
        ]
    },
    "housing": {
        "name": "Housing & Rural/Urban Welfare",
        "description": "Pradhan Mantri Awas Yojana (PMAY), rural/urban housing grants, electricity, and clean energy.",
        "icon": "fa-house-chimney",
        "db_categories": [
            "Housing", "Housing/Welfare", "Energy/Welfare", "Utilities/Municipal"
        ]
    },
    "employment_labour": {
        "name": "Employment, Workers & Labour",
        "description": "e-Shram unorganised workers, PM Shram Yogi Maan-dhan, NCS job exchange, and apprentice programmes.",
        "icon": "fa-briefcase",
        "db_categories": [
            "Employment / Social Security", "Employment", "Skills/Employment",
            "Labour/Welfare", "Labour", "Examinations/Employment"
        ]
    },
    "business": {
        "name": "Business, MSME & Artisans",
        "description": "Udyam registration, PM Vishwakarma for artisans, Startup India, Stand-Up India and licences.",
        "icon": "fa-store",
        "db_categories": [
            "Business Licence", "Business Registration", "Business/Startup",
            "Business/Government Procurement", "Business/IP", "Business/Trade",
            "Business Compliance", "Business/Environment", "Banking/Business",
            "Business/Building Safety", "Business/Compliance", "Welfare/Skills"
        ]
    },
    "identity_civil": {
        "name": "Certificates, Identity & Transport",
        "description": "Aadhaar, Voter ID, PAN card, Passport, Driving Licences, Income, Caste and Domicile certificates.",
        "icon": "fa-id-card",
        "db_categories": [
            "Identity Document", "Travel Document", "Civil Certificate", "Certificate",
            "Transport", "Civil Service", "Civil Registration", "Civil/Revenue Service",
            "Election Service", "Certificates", "Citizen / Event Licence", "Citizen Licence"
        ]
    }
}

# Grounded verified scheme benefits
VERIFIED_BENEFITS = {
    "pm-kisan": "Direct income support of ₹6,000 per year transferred in 3 equal four-monthly instalments of ₹2,000 directly into the bank accounts of eligible landholding farmer families.",
    "ayushman bharat": "Cashless health cover up to ₹5,00,000 per family per year for secondary and tertiary care hospitalization across empanelled public and private hospitals nationwide.",
    "atal pension": "Guaranteed minimum monthly pension of ₹1,000 to ₹5,000 from age 60, depending on subscriber contributions between age 18 and 40.",
    "shram yogi": "Assured monthly pension of ₹3,000 after reaching age 60 for unorganised workers with matching monthly government contribution.",
    "pm awas": "Financial assistance / interest subsidy up to ₹2.67 Lakhs for the construction or purchase of a permanent pucca house with basic civic amenities.",
    "e-shram": "National Universal Account Number (UAN) card, accidental death/permanent disability cover of ₹2,00,000, partial disability cover of ₹1,00,000 under PMSBY, and direct social security portal integration.",
    "national scholarship": "Direct Benefit Transfer (DBT) of post-matric, pre-matric, or merit-cum-means scholarship grant for tuition fees, living maintenance allowance and academic expenses.",
    "senior citizen": "Statutory proof of senior age (60+) enabling priority public transport, railway/airline concessions, dedicated hospital queues, and preferential interest rates on bank deposits.",
    "udid": "Single universal government disability identity card conferring nationwide healthcare concessions, travel discounts, scholarship quotas, and assistive device distributions.",
    "pm vishwakarma": "Collateral-free enterprise credit up to ₹3,00,000 at 5% subsidized interest rate, ₹15,000 toolkit grant, skill training stipend of ₹500/day, and national market linkages.",
    "ration card": "Subsidized or free essential foodgrains (rice, wheat, coarse grains) under the National Food Security Act (NFSA) and access to state public distribution benefits.",
    "pan card": "Permanent 10-digit alphanumeric tax identifier mandatory for opening bank accounts, income tax filing, high-value asset transactions, and formal financial identity.",
    "passport": "Official international travel document issued by the Ministry of External Affairs, certifying Indian citizenship and identity across all foreign jurisdictions.",
    "driving licence": "Statutory motor vehicle driving authorization valid across all Indian states and Union Territories, serving as legal age and address verification.",
    "voter id": "Constitutional elector identity certifying right of adult franchise in General, State and Municipal elections and official government photo ID.",
    "kisan credit card": "Short-term institutional credit at 4% effective interest rate (with prompt repayment incentive) for agricultural inputs, crop harvesting, and allied farm activities.",
    "ews certificate": "10% statutory reservation quota in Central and State government civil posts, examinations, and admissions into government/aided higher educational institutions.",
    "caste certificate": "Constitutional reservation and welfare scheme entitlement for Scheduled Castes (SC), Scheduled Tribes (ST), or Other Backward Classes (OBC).",
    "income certificate": "Statutory certification of annual household income required for availing fee concessions, scholarships, medical grants, and economic welfare schemes.",
    "jeevan pramaan": "Biometric-enabled digital life certificate for Central, State and Armed Forces pensioners submitted from home without physical presence at pension bank.",
    "widow pension": "Monthly social security financial stipend (₹500 to ₹2,500/month depending on state rules) directly credited to widowed women in need.",
    "matru vandana": "Maternity cash incentive of ₹5,000 in DBT instalments for pregnant women and lactating mothers for wage compensation and nutritious food."
}

STATUTORY_DISCLAIMER = (
    "Pre-screening eligibility assessment only. BharatAssist does not guarantee government approval. "
    "Official sanction, grant, or certificate issuance is governed strictly by the competent statutory authorities "
    "upon formal application and physical verification of original supporting documents."
)


def get_questions_for_category(category_key: str = "all", service_id: Optional[int] = None, service_data: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Dynamically generate questions based on the selected category or specific service.
    Avoids asking unnecessary questions.
    """
    category_key = (category_key or "all").lower().strip()

    questions: List[Dict[str, Any]] = [
        {
            "id": "state",
            "label": "State / Union Territory",
            "type": "select_state",
            "required": True,
            "help": "Determines scheme jurisdiction (All-India vs. State-specific)."
        },
        {
            "id": "district",
            "label": "District",
            "type": "select_district",
            "required": False,
            "help": "Used for district-level administrative routing where applicable."
        }
    ]

    # If checking a specific service, tailor to that service's content
    if service_data:
        text = f"{service_data.get('name', '')} {service_data.get('category', '')} {service_data.get('eligibility', '')}".lower()
        
        # Age
        questions.append({
            "id": "age",
            "label": "Your Age (in completed years)",
            "type": "number",
            "placeholder": "e.g. 35",
            "min": 1,
            "max": 120,
            "required": True,
            "help": "Many schemes have minimum or maximum age thresholds."
        })

        # Farmer check
        if any(w in text for w in ["farm", "kisan", "crop", "agri", "cultiv"]):
            questions.append({
                "id": "farmer_status",
                "label": "Do you own cultivable agricultural land or work in farming?",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "yes_landowner", "label": "Yes — Agricultural Landowner (Cultivable Land)"},
                    {"value": "yes_tenant", "label": "Yes — Tenant Farmer / Sharecropper"},
                    {"value": "yes_labour", "label": "Yes — Agricultural Labourer"},
                    {"value": "no", "label": "No — Not in Agriculture"}
                ],
                "help": "Central schemes like PM-KISAN require ownership of cultivable land."
            })
            questions.append({
                "id": "land_size_hectares",
                "label": "Total Agricultural Landholding (in Hectares)",
                "type": "select",
                "required": False,
                "options": [
                    {"value": "marginal", "label": "Marginal (Up to 1.0 Hectare / ~2.5 Acres)"},
                    {"value": "small", "label": "Small (1.0 to 2.0 Hectares / ~2.5 to 5.0 Acres)"},
                    {"value": "medium_large", "label": "Medium / Large (Over 2.0 Hectares)"},
                    {"value": "landless", "label": "Landless"}
                ],
                "help": "Small and marginal farmers receive prioritized subsidies."
            })

        # Student check
        if any(w in text for w in ["student", "scholarship", "educat", "school", "colleg", "matric"]):
            questions.append({
                "id": "student_status",
                "label": "Are you currently enrolled as a student in a recognized institution?",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "yes", "label": "Yes — Currently Enrolled Student"},
                    {"value": "no", "label": "No — Not a Student"}
                ]
            })
            questions.append({
                "id": "education_level",
                "label": "Current Education Level",
                "type": "select",
                "required": False,
                "options": [
                    {"value": "school", "label": "School (Classes 1 to 10)"},
                    {"value": "higher_secondary", "label": "Higher Secondary (Classes 11 & 12)"},
                    {"value": "undergraduate", "label": "Undergraduate (BA, BSc, BTech, etc.)"},
                    {"value": "postgraduate", "label": "Postgraduate / PhD / Research"},
                    {"value": "vocational", "label": "Vocational / ITI / Diploma"}
                ]
            })

        # Income check
        questions.append({
            "id": "annual_income",
            "label": "Annual Household Income (₹ INR)",
            "type": "number",
            "placeholder": "e.g. 180000",
            "min": 0,
            "max": 100000000,
            "required": True,
            "help": "Used to check EWS (₹8L), BPL, scholarship and subsidy ceilings."
        })

        # Gender check
        if any(w in text for w in ["woman", "women", "female", "matru", "mahila", "girl", "widow"]):
            questions.append({
                "id": "gender",
                "label": "Gender",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "female", "label": "Female"},
                    {"value": "male", "label": "Male"},
                    {"value": "other", "label": "Other / Prefer not to say"}
                ]
            })

        # Widow check
        if "widow" in text:
            questions.append({
                "id": "marital_status",
                "label": "Marital Status",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "widowed", "label": "Widowed"},
                    {"value": "married", "label": "Married"},
                    {"value": "unmarried", "label": "Unmarried"},
                    {"value": "divorced_separated", "label": "Divorced / Destitute"}
                ]
            })

        # Disability check
        if any(w in text for w in ["disab", "udid", "handicap", "divyang", "pwd"]):
            questions.append({
                "id": "disability_status",
                "label": "Do you have a benchmark disability (40% or more)?",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "yes", "label": "Yes — 40% or more benchmark disability (certified or eligible)"},
                    {"value": "no", "label": "No"}
                ]
            })

        # Housing check
        if any(w in text for w in ["house", "housing", "pmay", "awas"]):
            questions.append({
                "id": "owns_pucca_house",
                "label": "Do you or any member of your family own a permanent (pucca) house in India?",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "no", "label": "No — Living in kutcha house / rented / homeless"},
                    {"value": "yes", "label": "Yes — Own a permanent pucca house"}
                ]
            })

        return questions

    # Domain-specific dynamic questions
    if category_key == "agriculture":
        questions.extend([
            {
                "id": "age",
                "label": "Age of Applicant (in completed years)",
                "type": "number",
                "placeholder": "e.g. 42",
                "min": 18,
                "max": 120,
                "required": True
            },
            {
                "id": "farmer_status",
                "label": "Are you currently an agricultural landowner or cultivator?",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "yes_landowner", "label": "Yes — Agricultural Landowner (Cultivable Land in my/family name)"},
                    {"value": "yes_tenant", "label": "Yes — Tenant Farmer / Sharecropper"},
                    {"value": "yes_labour", "label": "Yes — Agricultural Labourer"},
                    {"value": "no", "label": "No — Not in Agriculture"}
                ]
            },
            {
                "id": "land_size_hectares",
                "label": "Total Agricultural Landholding",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "marginal", "label": "Marginal (< 1.0 Hectare / ~2.5 Acres)"},
                    {"value": "small", "label": "Small (1.0 to 2.0 Hectares)"},
                    {"value": "medium_large", "label": "Medium / Large (> 2.0 Hectares)"},
                    {"value": "landless", "label": "Landless"}
                ]
            },
            {
                "id": "annual_income",
                "label": "Annual Household Income (₹ INR)",
                "type": "number",
                "placeholder": "e.g. 120000",
                "min": 0,
                "max": 100000000,
                "required": True,
                "help": "Excludes institutional landowners or high-bracket tax payees for certain farmer schemes."
            },
            {
                "id": "institutional_taxpayer",
                "label": "Did any family member pay Income Tax or hold constitutional/government post?",
                "type": "select",
                "required": False,
                "options": [
                    {"value": "no", "label": "No (Standard farmer household)"},
                    {"value": "yes", "label": "Yes (Income tax payee / Govt retiree > ₹10k pension)"}
                ],
                "help": "PM-KISAN exclusion criteria."
            }
        ])

    elif category_key == "education":
        questions.extend([
            {
                "id": "age",
                "label": "Student's Age (in completed years)",
                "type": "number",
                "placeholder": "e.g. 19",
                "min": 4,
                "max": 45,
                "required": True
            },
            {
                "id": "student_status",
                "label": "Are you currently enrolled in a school, college, or university?",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "yes", "label": "Yes — Currently Enrolled Student"},
                    {"value": "no", "label": "No — Not Enrolled"}
                ]
            },
            {
                "id": "education_level",
                "label": "Education Level",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "school", "label": "Pre-Matric / Secondary (Class 1-10)"},
                    {"value": "higher_secondary", "label": "Higher Secondary (Class 11-12)"},
                    {"value": "undergraduate", "label": "Undergraduate Degree (BA / BSc / BTech / MBBS / etc.)"},
                    {"value": "postgraduate", "label": "Postgraduate / PhD / Research"},
                    {"value": "vocational", "label": "ITI / Vocational / Polytechnic Diploma"}
                ]
            },
            {
                "id": "social_category",
                "label": "Social Category / Reservation Group",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "general", "label": "General / Unreserved"},
                    {"value": "obc", "label": "Other Backward Classes (OBC)"},
                    {"value": "sc", "label": "Scheduled Caste (SC)"},
                    {"value": "st", "label": "Scheduled Tribe (ST)"},
                    {"value": "ews", "label": "Economically Weaker Section (EWS)"},
                    {"value": "minority", "label": "Religious Minority (Muslim, Christian, Sikh, Buddhist, Jain, Parsi)"}
                ],
                "help": "National Scholarship Portal has distinct tracks for SC, ST, OBC, Minority and EWS students."
            },
            {
                "id": "annual_income",
                "label": "Annual Total Family Income (₹ INR)",
                "type": "number",
                "placeholder": "e.g. 200000",
                "min": 0,
                "max": 100000000,
                "required": True,
                "help": "Most government scholarships have a family income ceiling of ₹2.5 Lakhs or ₹8.0 Lakhs."
            }
        ])

    elif category_key == "pension_senior":
        questions.extend([
            {
                "id": "age",
                "label": "Applicant Age (in completed years)",
                "type": "number",
                "placeholder": "e.g. 62",
                "min": 18,
                "max": 120,
                "required": True,
                "help": "Senior citizen programs require age 60+. APY requires entry between 18 and 40."
            },
            {
                "id": "employment_status",
                "label": "Employment / Retirement Profile",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "senior_retired", "label": "Senior Citizen / Retired (Seeking old age pension/certificate)"},
                    {"value": "pensioner_existing", "label": "Existing Pensioner (Receiving Govt/EPS pension, needs Jeevan Pramaan)"},
                    {"value": "unorganised", "label": "Unorganised Worker (Seeking APY or PM Shram Yogi Maandhan)"},
                    {"value": "working", "label": "Currently Employed / Self-Employed (General NPS subscriber)"},
                    {"value": "homemaker", "label": "Homemaker"}
                ]
            },
            {
                "id": "gender",
                "label": "Gender of Applicant",
                "type": "select",
                "required": False,
                "options": [
                    {"value": "female", "label": "Female"},
                    {"value": "male", "label": "Male"},
                    {"value": "other", "label": "Other"}
                ]
            },
            {
                "id": "marital_status",
                "label": "Marital Status",
                "type": "select",
                "required": False,
                "options": [
                    {"value": "married", "label": "Married"},
                    {"value": "widowed", "label": "Widowed (Eligible for Widow Pension)"},
                    {"value": "unmarried", "label": "Unmarried"},
                    {"value": "divorced_separated", "label": "Divorced / Destitute"}
                ]
            },
            {
                "id": "annual_income",
                "label": "Annual Family Income (₹ INR)",
                "type": "number",
                "placeholder": "e.g. 60000",
                "min": 0,
                "max": 100000000,
                "required": True,
                "help": "National Old Age Pension Scheme (IGNOAPS) requires BPL / low income criteria."
            },
            {
                "id": "disability_status",
                "label": "Do you have a benchmark disability (40% or more)?",
                "type": "select",
                "required": False,
                "options": [
                    {"value": "no", "label": "No"},
                    {"value": "yes", "label": "Yes — 40%+ benchmark disability (Disability Pension eligibility)"}
                ]
            }
        ])

    elif category_key == "health":
        questions.extend([
            {
                "id": "age",
                "label": "Applicant Age (in completed years)",
                "type": "number",
                "placeholder": "e.g. 35",
                "min": 1,
                "max": 120,
                "required": True
            },
            {
                "id": "bpl_ration_card",
                "label": "Do you hold a BPL, Antyodaya (AAY), or Priority Household (PHH) Ration Card?",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "yes", "label": "Yes — Hold BPL / Antyodaya / Priority Ration Card"},
                    {"value": "no", "label": "No — General / APL Ration Card or none"}
                ],
                "help": "Automatic PM-JAY inclusion is grounded in SECC 2011 and State NFSA priority cards."
            },
            {
                "id": "annual_income",
                "label": "Annual Household Income (₹ INR)",
                "type": "number",
                "placeholder": "e.g. 150000",
                "min": 0,
                "max": 100000000,
                "required": True
            },
            {
                "id": "disability_status",
                "label": "Do you or a family member require a Unique Disability ID (UDID)?",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "no", "label": "No disability assistance needed"},
                    {"value": "yes", "label": "Yes — Person with benchmark disability (40%+)"}
                ]
            }
        ])

    elif category_key == "women_child":
        questions.extend([
            {
                "id": "gender",
                "label": "Gender of Applicant",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "female", "label": "Female (Target Beneficiary)"},
                    {"value": "male", "label": "Male"},
                    {"value": "other", "label": "Other"}
                ]
            },
            {
                "id": "age",
                "label": "Age of Applicant (in completed years)",
                "type": "number",
                "placeholder": "e.g. 26",
                "min": 18,
                "max": 100,
                "required": True
            },
            {
                "id": "maternity_status",
                "label": "Maternity / Marital Status",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "pregnant_lactating", "label": "Pregnant Woman or Lactating Mother (PMMVY eligible)"},
                    {"value": "single_widow", "label": "Single Mother, Widow or Divorced"},
                    {"value": "general_woman", "label": "General Adult Woman (Savings / Entrepreneurship)"}
                ]
            },
            {
                "id": "annual_income",
                "label": "Annual Household Income (₹ INR)",
                "type": "number",
                "placeholder": "e.g. 180000",
                "min": 0,
                "max": 100000000,
                "required": True
            }
        ])

    elif category_key == "housing":
        questions.extend([
            {
                "id": "age",
                "label": "Age of Primary Applicant (in completed years)",
                "type": "number",
                "placeholder": "e.g. 38",
                "min": 18,
                "max": 100,
                "required": True
            },
            {
                "id": "owns_pucca_house",
                "label": "Do you or any dependent family member own a permanent (pucca) house anywhere in India?",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "no", "label": "No — We do not own a pucca house (PMAY Eligible)"},
                    {"value": "yes", "label": "Yes — We already own a pucca house"}
                ],
                "help": "Primary disqualifier for Pradhan Mantri Awas Yojana (PMAY)."
            },
            {
                "id": "annual_income",
                "label": "Annual Family Income (₹ INR)",
                "type": "number",
                "placeholder": "e.g. 240000",
                "min": 0,
                "max": 100000000,
                "required": True,
                "help": "PMAY EWS (Up to ₹3L), LIG (₹3L to ₹6L), MIG-I (₹6L to ₹12L)."
            },
            {
                "id": "area_type",
                "label": "Location Type",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "rural", "label": "Rural (PMAY-Gramin)"},
                    {"value": "urban", "label": "Urban / Municipal Area (PMAY-Urban)"}
                ]
            }
        ])

    elif category_key == "employment_labour":
        questions.extend([
            {
                "id": "age",
                "label": "Age of Worker (in completed years)",
                "type": "number",
                "placeholder": "e.g. 29",
                "min": 16,
                "max": 70,
                "required": True,
                "help": "e-Shram eligibility is 16-59 years. PM-SYM pension is 18-40 years."
            },
            {
                "id": "employment_type",
                "label": "Current Employment Profile",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "unorganised", "label": "Unorganised / Daily Wage / Agricultural Worker"},
                    {"value": "construction", "label": "Building / Construction Worker (BOCW)"},
                    {"value": "gig_driver", "label": "Gig / Delivery / Platform Worker or Driver"},
                    {"value": "artisan", "label": "Traditional Artisan / Craftsperson (Vishwakarma)"},
                    {"value": "jobseeker", "label": "Unemployed Jobseeker looking for employment (NCS)"},
                    {"value": "formal_salaried", "label": "Organised Salaried (EPFO / ESIC member)"}
                ]
            },
            {
                "id": "annual_income",
                "label": "Monthly / Annual Earnings",
                "type": "number",
                "placeholder": "e.g. 150000",
                "min": 0,
                "max": 100000000,
                "required": True,
                "help": "PM-SYM requires monthly income ≤ ₹15,000 (Annual ≤ ₹1,80,000)."
            }
        ])

    elif category_key == "business":
        questions.extend([
            {
                "id": "age",
                "label": "Applicant / Entrepreneur Age (in completed years)",
                "type": "number",
                "placeholder": "e.g. 32",
                "min": 18,
                "max": 100,
                "required": True
            },
            {
                "id": "business_status",
                "label": "Business Enterprise Stage",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "aspiring", "label": "Aspiring Entrepreneur / New Business Idea (Stand-Up India / PMEGP)"},
                    {"value": "artisan", "label": "Traditional Artisan / Trade Craftsman (PM Vishwakarma)"},
                    {"value": "existing_msme", "label": "Existing Micro, Small or Medium Enterprise (Udyam)"},
                    {"value": "innovative_startup", "label": "Innovative High-Growth Tech/Product Startup (Startup India)"}
                ]
            },
            {
                "id": "annual_income",
                "label": "Annual Business Turnover or Investment (₹ INR)",
                "type": "number",
                "placeholder": "e.g. 500000",
                "min": 0,
                "max": 1000000000,
                "required": False,
                "help": "Determines Micro (< ₹5 Crore turnover) or Small classification."
            },
            {
                "id": "is_woman_or_sc_st",
                "label": "Are you a Woman, SC, or ST entrepreneur?",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "yes", "label": "Yes — Woman, Scheduled Caste or Scheduled Tribe Entrepreneur"},
                    {"value": "no", "label": "No — General Male Entrepreneur"}
                ],
                "help": "Stand-Up India mandates loans exclusively to SC/ST or Women borrowers."
            }
        ])

    elif category_key == "identity_civil":
        questions.extend([
            {
                "id": "age",
                "label": "Applicant Age (in completed years)",
                "type": "number",
                "placeholder": "e.g. 24",
                "min": 0,
                "max": 120,
                "required": True,
                "help": "Voter ID requires age 18+. Learner driving licence 16+ or 18+. Senior cards 60+."
            },
            {
                "id": "citizenship",
                "label": "Citizenship Status",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "indian_citizen", "label": "Indian Citizen (by birth or naturalisation)"},
                    {"value": "resident_foreigner", "label": "Foreign national resident in India"},
                    {"value": "nri", "label": "Non-Resident Indian (NRI)"}
                ]
            },
            {
                "id": "annual_income",
                "label": "Annual Household Income (₹ INR)",
                "type": "number",
                "placeholder": "e.g. 450000",
                "min": 0,
                "max": 100000000,
                "required": False,
                "help": "Required only when applying for an Income Certificate or EWS Certificate (₹8 Lakh limit)."
            },
            {
                "id": "social_category",
                "label": "Social Category",
                "type": "select",
                "required": False,
                "options": [
                    {"value": "general", "label": "General (Eligible for EWS if income < 8L)"},
                    {"value": "obc", "label": "Other Backward Class (OBC)"},
                    {"value": "sc", "label": "Scheduled Caste (SC)"},
                    {"value": "st", "label": "Scheduled Tribe (ST)"}
                ],
                "help": "Relevant for Caste Certificate or EWS Certificate pre-screening."
            }
        ])

    else:  # 'all'
        questions.extend([
            {
                "id": "age",
                "label": "Your Age (in completed years)",
                "type": "number",
                "placeholder": "e.g. 30",
                "min": 1,
                "max": 120,
                "required": True
            },
            {
                "id": "occupation",
                "label": "Primary Occupation / Profile",
                "type": "select",
                "required": True,
                "options": [
                    {"value": "farmer", "label": "Farmer / Agricultural Cultivator"},
                    {"value": "student", "label": "Student"},
                    {"value": "unorganised_worker", "label": "Unorganised / Daily Wage / Gig Worker"},
                    {"value": "artisan", "label": "Artisan / Craftsman"},
                    {"value": "salaried", "label": "Salaried Employee (Private / Government)"},
                    {"value": "business_owner", "label": "Business Owner / Self-Employed Trader"},
                    {"value": "senior_retired", "label": "Senior Citizen / Retired"},
                    {"value": "homemaker", "label": "Homemaker"},
                    {"value": "unemployed", "label": "Unemployed Jobseeker"}
                ]
            },
            {
                "id": "annual_income",
                "label": "Annual Household Income (₹ INR)",
                "type": "number",
                "placeholder": "e.g. 250000",
                "min": 0,
                "max": 100000000,
                "required": True,
                "help": "Helps match income thresholds across subsidies and welfare schemes."
            },
            {
                "id": "gender",
                "label": "Gender",
                "type": "select",
                "required": False,
                "options": [
                    {"value": "female", "label": "Female"},
                    {"value": "male", "label": "Male"},
                    {"value": "other", "label": "Other"}
                ]
            },
            {
                "id": "social_category",
                "label": "Social Category",
                "type": "select",
                "required": False,
                "options": [
                    {"value": "general", "label": "General"},
                    {"value": "obc", "label": "OBC"},
                    {"value": "sc", "label": "SC"},
                    {"value": "st", "label": "ST"},
                    {"value": "ews", "label": "EWS"},
                    {"value": "minority", "label": "Minority"}
                ]
            },
            {
                "id": "disability_status",
                "label": "Do you have a benchmark disability (40%+)?",
                "type": "select",
                "required": False,
                "options": [
                    {"value": "no", "label": "No"},
                    {"value": "yes", "label": "Yes (40%+ Benchmark Disability)"}
                ]
            }
        ])

    return questions


def _extract_verified_benefits(service_name: str, category: str, steps: str) -> str:
    """Retrieve grounded verified benefits or format accurate statutory entitlement."""
    name_clean = service_name.lower()
    
    for key, benefit in VERIFIED_BENEFITS.items():
        if key in name_clean:
            return benefit

    if "certificate" in category.lower():
        return f"Statutory official certification of {service_name} issued by the competent revenue/civil administration, recognized for government services and legal proof."
    elif "licence" in category.lower() or "permit" in category.lower():
        return f"Legal authority and statutory permit to operate under applicable central and state regulatory acts."
    elif "identity" in category.lower() or "travel" in category.lower():
        return f"Recognized national identity and statutory documentation facilitating seamless public and banking access."
    elif "pension" in category.lower():
        return f"Monthly direct benefit transfer (DBT) social security pension assistance for verified eligible beneficiaries."
    elif "health" in category.lower():
        return f"Direct healthcare coverage, institutional health identifier or access to subsidised medical treatment."
    elif "agriculture" in category.lower():
        return f"Subsidies, institutional credit access, or direct income support for farmers."
    
    return f"Statutory service enablement and official processing under {service_name} rules."


def evaluate_service_eligibility(service: Dict[str, Any], user_profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluate a single service against the user profile.
    Returns detailed match data:
    status: 'confirmed_eligible' | 'potentially_eligible' | 'insufficient_info' | 'ineligible'
    """
    service_id = service.get("id")
    name = service.get("name", "")
    category = service.get("category", "")
    eligibility_text = service.get("eligibility", "") or ""
    state_scope = service.get("state", "All India")
    source_url = service.get("source_url", "")
    last_verified = service.get("last_verified") or "Periodic verification pending"

    user_state = (user_profile.get("state") or "").strip()
    user_district = (user_profile.get("district") or "").strip()
    user_age = user_profile.get("age")
    try:
        user_age = int(user_age) if user_age not in [None, ""] else None
    except (ValueError, TypeError):
        user_age = None

    user_income = user_profile.get("annual_income")
    try:
        user_income = float(user_income) if user_income not in [None, ""] else None
    except (ValueError, TypeError):
        user_income = None

    occupation = (user_profile.get("occupation") or "").lower().strip()
    farmer_status = (user_profile.get("farmer_status") or "").lower().strip()
    student_status = (user_profile.get("student_status") or "").lower().strip()
    gender = (user_profile.get("gender") or "").lower().strip()
    marital_status = (user_profile.get("marital_status") or "").lower().strip()
    maternity_status = (user_profile.get("maternity_status") or "").lower().strip()
    employment_status = (user_profile.get("employment_status") or "").lower().strip()
    disability_status = (user_profile.get("disability_status") or "").lower().strip()
    owns_pucca_house = (user_profile.get("owns_pucca_house") or "").lower().strip()
    bpl_card = (user_profile.get("bpl_ration_card") or "").lower().strip()
    business_status = (user_profile.get("business_status") or "").lower().strip()
    is_woman_or_sc_st = (user_profile.get("is_woman_or_sc_st") or "").lower().strip()
    institutional_taxpayer = (user_profile.get("institutional_taxpayer") or "").lower().strip()
    citizenship = (user_profile.get("citizenship") or "").lower().strip()
    social_category = (user_profile.get("social_category") or "").lower().strip()

    name_lower = name.lower()
    cat_lower = category.lower()
    elig_lower = eligibility_text.lower()
    all_text = f"{name_lower} {cat_lower} {elig_lower}"

    conditions_met: List[str] = []
    conditions_failed: List[str] = []
    missing_info: List[Dict[str, str]] = []

    # 1. State / Jurisdiction Check
    if "state-specific" in state_scope.lower() or "jurisdiction" in state_scope.lower():
        if user_state:
            conditions_met.append(f"Residing in {user_state} (State authority jurisdiction satisfied)")
        else:
            missing_info.append({"field": "state", "question": "What is your State of residence to verify state jurisdiction?"})
    else:
        if user_state:
            conditions_met.append(f"Applicable nationwide across {user_state}")
        else:
            conditions_met.append("Applicable nationwide (All India service)")

    # 2. Citizenship / Elector check
    if any(k in all_text for k in ["passport", "voter id", "electoral", "pan card"]):
        if citizenship == "resident_foreigner" and "passport" in name_lower:
            conditions_failed.append("Indian Passport Seva is exclusively for Indian citizens.")
        elif citizenship == "resident_foreigner" and "voter" in name_lower:
            conditions_failed.append("Voter ID / Electoral Roll inclusion is constitutionally restricted to Indian citizens.")
        else:
            conditions_met.append("Citizenship / resident eligibility criteria satisfied.")

    # 3. Pension & Senior Citizen Specific Schemes
    if "widow pension" in name_lower:
        if gender == "male":
            conditions_failed.append("Widow Pension is reserved exclusively for female applicants.")
        elif marital_status in ["married", "unmarried"]:
            conditions_failed.append("Applicant is not widowed or legally destitute as required for Widow Pension.")
        elif marital_status == "widowed" or maternity_status == "single_widow":
            conditions_met.append("Widowed marital status verified for social assistance pension")
        else:
            missing_info.append({"field": "marital_status", "question": "Please confirm your marital status (Widow Pension requires widowed status)."})

    elif "jeevan pramaan" in name_lower or "life certificate" in name_lower or "central pension accounting" in name_lower:
        if employment_status == "pensioner_existing" or occupation == "senior_retired":
            conditions_met.append("Existing pensioner status confirmed for digital life certificate processing")
        elif employment_status in ["working", "unorganised"] or occupation in ["student", "farmer", "unorganised_worker"]:
            conditions_failed.append("Jeevan Pramaan is exclusively for existing pensioners already receiving Central/State/Defence pensions.")
        else:
            missing_info.append({"field": "employment_status", "question": "Are you currently an existing government / EPFO pensioner?"})

    elif "shram yogi" in name_lower:
        # PM-SYM requires unorganised worker, age 18-40, monthly income <= 15000
        if user_age is not None:
            if 18 <= user_age <= 40:
                conditions_met.append(f"Age {user_age} falls within PM-SYM entry bracket (18-40 years)")
            else:
                conditions_failed.append(f"Age {user_age} is outside the PM-SYM entry window (18 to 40 years).")
        else:
            missing_info.append({"field": "age", "question": "Please specify your age (PM-SYM entry bracket is 18-40 years)."})

        if employment_status == "unorganised" or occupation == "unorganised_worker":
            conditions_met.append("Unorganised sector worker confirmed (not covered under EPFO/ESIC/NPS)")
        elif employment_status in ["retired_govt", "pensioner_existing"] or occupation in ["salaried"]:
            conditions_failed.append("Organised sector employees covered under EPFO/ESIC are excluded from PM-SYM.")
        else:
            missing_info.append({"field": "employment_status", "question": "Are you an unorganised sector worker (not enrolled in EPFO/ESIC)?"})

        if user_income is not None:
            if user_income <= 180000:
                conditions_met.append(f"Income ₹{user_income:,.0f} satisfies PM-SYM wage limit (≤ ₹15,000/month)")
            else:
                conditions_failed.append(f"Annual income ₹{user_income:,.0f} exceeds PM-SYM threshold (≤ ₹1,80,000/year).")

    elif "senior citizen" in name_lower or "old age pension" in name_lower:
        if user_age is not None:
            if user_age >= 60:
                conditions_met.append(f"Age {user_age} meets senior citizen threshold (60+ years)")
            else:
                conditions_failed.append(f"Applicant is {user_age} years old; this scheme requires minimum 60 years.")
        else:
            missing_info.append({"field": "age", "question": "What is your age? Senior citizen schemes require age 60+."})

    elif "atal pension" in name_lower:
        if user_age is not None:
            if 18 <= user_age <= 40:
                conditions_met.append(f"Age {user_age} falls within Atal Pension Yojana subscription bracket (18-40 years)")
            else:
                conditions_failed.append(f"Age {user_age} is outside the APY eligibility entry window (18 to 40 years).")
        else:
            missing_info.append({"field": "age", "question": "Please provide your age (APY entry window is 18 to 40 years)."})

    elif "e-shram" in name_lower:
        if user_age is not None:
            if 16 <= user_age <= 59:
                conditions_met.append(f"Age {user_age} is within e-Shram worker bracket (16-59 years)")
            else:
                conditions_failed.append(f"Age {user_age} is outside e-Shram worker limit (16 to 59 years).")
        else:
            missing_info.append({"field": "age", "question": "Please specify your age (e-Shram eligibility is 16-59 years)."})

    elif "voter id" in name_lower or "elector" in name_lower:
        if user_age is not None:
            if user_age >= 18:
                conditions_met.append(f"Age {user_age} meets adult franchise requirement (18+ years)")
            else:
                conditions_failed.append(f"Applicant is {user_age} years old; voter registration requires minimum 18 years.")
        else:
            missing_info.append({"field": "age", "question": "Are you 18 years of age or older?"})

    elif "driving licence (permanent)" in name_lower or "permanent driving" in name_lower:
        if user_age is not None:
            if user_age >= 18:
                conditions_met.append(f"Age {user_age} meets legal driving age requirement (18+ years)")
            else:
                conditions_failed.append(f"Age {user_age} is below permanent driving licence threshold (18+ years).")
        else:
            missing_info.append({"field": "age", "question": "What is your age? Permanent driving licence requires age 18+."})

    elif "learner" in name_lower and "licence" in name_lower:
        if user_age is not None:
            if user_age >= 16:
                conditions_met.append(f"Age {user_age} meets learner driving licence criteria (16+ for gearless 50cc, 18+ for LMV)")
            else:
                conditions_failed.append(f"Age {user_age} is below minimum learner licence age (16 years).")
        else:
            missing_info.append({"field": "age", "question": "What is your age? (Learner licence requires minimum 16 years)."})

    elif "liquor" in name_lower:
        if user_age is not None:
            if user_age >= 21:
                conditions_met.append(f"Age {user_age} satisfies legal excise age requirement (21/25+)")
            else:
                conditions_failed.append(f"Applicant is {user_age} years old; liquor permits require legal drinking age (21 or 25 depending on state).")
        else:
            missing_info.append({"field": "age", "question": "What is your age? (Excise permits require minimum 21/25 years)."})

    elif "arms" in name_lower or "gun licence" in name_lower:
        if user_age is not None:
            if user_age >= 21:
                conditions_met.append(f"Age {user_age} satisfies NDAL-ALIS statutory age requirement (21+ years)")
            else:
                conditions_failed.append(f"Applicant is {user_age}; Arms Act requires minimum 21 years of age.")
        else:
            missing_info.append({"field": "age", "question": "What is your age? (Arms Act requires minimum 21 years)."})

    else:
        # General age check if specified in eligibility string
        age_match = re.search(r"age\s*(\d{1,2})\+", elig_lower)
        if age_match:
            min_a = int(age_match.group(1))
            if user_age is not None:
                if user_age >= min_a:
                    conditions_met.append(f"Age {user_age} satisfies requirement of {min_a}+ years")
                else:
                    conditions_failed.append(f"Age {user_age} does not satisfy {min_a}+ years requirement.")
            else:
                missing_info.append({"field": "age", "question": f"Please verify if your age is at least {min_a} years."})
        elif user_age is not None:
            conditions_met.append(f"Age {user_age} is valid for standard citizen services")

    # 4. Farmer & Agriculture Checks
    if any(k in all_text for k in ["pm-kisan", "kisan credit", "farmer", "agriculture welfare", "fasal bima", "soil health"]):
        is_farmer = (farmer_status.startswith("yes") or occupation == "farmer")
        if farmer_status == "no" or (occupation and occupation not in ["farmer"] and not farmer_status):
            conditions_failed.append("Scheme is reserved for farmers / agricultural landholders.")
        elif is_farmer:
            if "pm-kisan" in name_lower:
                if farmer_status == "yes_landowner" or occupation == "farmer":
                    if institutional_taxpayer == "yes":
                        conditions_failed.append("Excluded under PM-KISAN guidelines (Income Tax payee or constitutional post).")
                    else:
                        conditions_met.append("Eligible landholding farmer household (Cultivable land in records)")
                else:
                    conditions_failed.append("PM-KISAN specifically requires ownership of cultivable land (tenant/labourers excluded).")
            else:
                conditions_met.append("Active farmer / cultivator status confirmed")
        else:
            missing_info.append({"field": "farmer_status", "question": "Do you own cultivable agricultural land or work in agriculture?"})

    # 5. Student & Scholarship Checks
    if any(k in all_text for k in ["scholarship", "national scholarship", "student", "education loan", "digilocker student"]):
        is_student = (student_status == "yes" or occupation == "student")
        if student_status == "no" or (occupation and occupation != "student" and not student_status):
            conditions_failed.append("Scheme is reserved for enrolled students pursuing formal education.")
        elif is_student:
            conditions_met.append("Currently enrolled student status confirmed")
            if user_income is not None:
                if user_income <= 250000:
                    conditions_met.append(f"Family income ₹{user_income:,.0f} meets standard scholarship ceiling (≤ ₹2.5 Lakhs)")
                elif user_income <= 800000:
                    conditions_met.append(f"Family income ₹{user_income:,.0f} eligible for higher education / merit-cum-means brackets (≤ ₹8 Lakhs)")
                else:
                    conditions_failed.append(f"Family income ₹{user_income:,.0f} exceeds typical scholarship ceiling of ₹8 Lakhs.")
        else:
            missing_info.append({"field": "student_status", "question": "Are you currently enrolled as a student in a recognized institution?"})

    # 6. EWS / Income Ceiling Checks
    if "ews certificate" in name_lower or "economically weaker section" in name_lower:
        if user_income is not None:
            if user_income <= 800000:
                conditions_met.append(f"Family income ₹{user_income:,.0f} is within Central EWS ceiling (≤ ₹8,00,000)")
            else:
                conditions_failed.append(f"Annual income ₹{user_income:,.0f} exceeds EWS ceiling of ₹8,00,000.")
        else:
            missing_info.append({"field": "annual_income", "question": "What is your annual family income? (EWS threshold is ≤ ₹8 Lakhs)."})

        if social_category in ["sc", "st", "obc"]:
            conditions_failed.append("EWS reservation is exclusively for General Category citizens not covered under SC/ST/OBC reservation.")
        elif social_category in ["general", "ews"]:
            conditions_met.append("General unreserved category candidate eligible for EWS evaluation")

    # 7. Housing / PMAY Checks
    if "pm awas" in name_lower or "pmay" in name_lower or ("housing" in cat_lower and "discovery" not in name_lower):
        if owns_pucca_house == "yes":
            conditions_failed.append("Ineligible under PMAY: Applicant or family member already owns a permanent (pucca) house in India.")
        elif owns_pucca_house == "no":
            conditions_met.append("Does not own a permanent pucca house (Satisfies primary PMAY housing criterion)")
        else:
            missing_info.append({"field": "owns_pucca_house", "question": "Do you or your family own a permanent (pucca) house in India?"})

        if user_income is not None:
            if user_income <= 300000:
                conditions_met.append(f"Income ₹{user_income:,.0f} qualifies for PMAY EWS tier (Direct financial assistance & highest subsidy)")
            elif user_income <= 600000:
                conditions_met.append(f"Income ₹{user_income:,.0f} qualifies for PMAY LIG tier (Subsidized home loan interest)")
            elif user_income <= 1800000:
                conditions_met.append(f"Income ₹{user_income:,.0f} qualifies for PMAY MIG subsidy tier")

    # 8. Disability Checks (UDID / Disability Pension)
    if any(k in all_text for k in ["udid", "unique disability", "disability pension", "disability"]):
        if disability_status == "yes":
            conditions_met.append("Applicant has benchmark disability (40%+ as defined in RPwD Act 2016)")
        elif disability_status == "no":
            conditions_failed.append("Scheme requires a certified benchmark disability of 40% or more.")
        else:
            missing_info.append({"field": "disability_status", "question": "Do you or the applicant have a 40%+ certified benchmark disability?"})

    # 9. Women Specific Schemes
    if any(k in all_text for k in ["matru vandana", "mahila", "women", "girl child"]) and "discovery" not in name_lower:
        if gender == "male":
            conditions_failed.append("Scheme is reserved specifically for women / female beneficiaries.")
        elif gender == "female":
            conditions_met.append("Female citizen applicant meets gender requirement")
            if "matru vandana" in name_lower:
                if maternity_status == "pregnant_lactating":
                    conditions_met.append("Pregnant woman / lactating mother verified for PMMVY cash incentive")
                elif maternity_status in ["single_widow", "general_woman"]:
                    conditions_failed.append("PMMVY requires the applicant to be currently pregnant or a lactating mother for first/second child.")
                else:
                    missing_info.append({"field": "maternity_status", "question": "Are you currently pregnant or a lactating mother?"})
        else:
            missing_info.append({"field": "gender", "question": "Is the applicant a female citizen?"})

    # 10. Business & Artisans
    if "vishwakarma" in name_lower:
        if business_status == "artisan" or occupation == "artisan":
            conditions_met.append("Traditional artisan / craftsperson profile confirmed")
        elif business_status and business_status != "artisan":
            conditions_failed.append("PM Vishwakarma is restricted to 18 traditional trade artisans and craftsmen.")
        else:
            missing_info.append({"field": "business_status", "question": "Do you practice one of the 18 traditional artisan trades?"})

    if "stand-up india" in name_lower:
        if is_woman_or_sc_st == "yes" or gender == "female" or social_category in ["sc", "st"]:
            conditions_met.append("Borrower is a Woman or SC/ST entrepreneur (Mandated for Stand-Up India)")
        elif is_woman_or_sc_st == "no" and gender == "male" and social_category not in ["sc", "st"]:
            conditions_failed.append("Stand-Up India mandates that loans be granted exclusively to SC/ST or Woman borrowers.")
        else:
            missing_info.append({"field": "is_woman_or_sc_st", "question": "Are you a Woman, SC, or ST entrepreneur?"})

    # 11. General Citizen Services (PAN, Aadhaar, Voter, Passport, Birth/Death, Domicile, etc.)
    if not conditions_failed and not conditions_met:
        conditions_met.append("Standard citizen application criteria applicable")

    # -------------------------------------------------------------
    # Determine Final Status
    # -------------------------------------------------------------
    if conditions_failed:
        status = "ineligible"
        status_badge = "Not Eligible"
        why_qualified = f"Condition not met: {conditions_failed[0]}"
    elif missing_info:
        status = "insufficient_info"
        status_badge = "Follow-up Needed"
        why_qualified = f"Profile satisfies initial criteria, but {len(missing_info)} follow-up question(s) are required to confirm eligibility."
    else:
        if len(conditions_met) >= 2 or any(k in name_lower for k in ["pm-kisan", "atal", "senior", "ews", "udid", "pan", "passport", "voter"]):
            status = "confirmed_eligible"
            status_badge = "Confirmed Eligible (Pre-Screening)"
            why_qualified = f"All pre-screening conditions verified: {'; '.join(conditions_met[:3])}."
        else:
            status = "potentially_eligible"
            status_badge = "Potentially Eligible"
            why_qualified = f"Your profile aligns with scheme requirements ({'; '.join(conditions_met[:2])}). Official portal verification required."

    benefits = _extract_verified_benefits(name, category, service.get("steps", ""))

    docs_raw = service.get("documents_required", "") or ""
    docs_list = [d.strip() for d in re.split(r";|\n|\d+[\.\)]", docs_raw) if d.strip() and len(d.strip()) > 3]
    if not docs_list:
        docs_list = ["Official identity proof (Aadhaar / Voter ID)", "Address proof", "Supporting service documents as specified on portal"]

    return {
        "service_id": service_id,
        "name": name,
        "category": category,
        "state": state_scope,
        "status": status,
        "status_badge": status_badge,
        "why_qualified": why_qualified,
        "conditions_met": conditions_met,
        "conditions_failed": conditions_failed,
        "missing_info": missing_info,
        "follow_up_questions": [m["question"] for m in missing_info],
        "benefits": benefits,
        "eligibility_text": eligibility_text,
        "documents_required": docs_raw,
        "documents_list": docs_list,
        "steps": service.get("steps", ""),
        "fees": service.get("fees", "Check official portal"),
        "processing_time": service.get("processing_time", "Varies by jurisdiction"),
        "source_url": source_url,
        "last_verified": last_verified,
        "verification_status": "Source verified on official portal" if last_verified != "Periodic verification pending" else "Official government directory entry",
        "disclaimer": STATUTORY_DISCLAIMER
    }


def match_schemes(user_profile: Dict[str, Any], category_key: str = "all", service_id: Optional[int] = None, db_path: str = "code/BHARATASSIST/bharatassist.db") -> Dict[str, Any]:
    """
    Search and evaluate all catalog services against user profile.
    Returns structured results separated into confirmed, potentially eligible, follow-up needed, and ineligible.
    """
    category_key = (category_key or "all").lower().strip()
    target_categories = CATEGORY_GROUPS.get(category_key, {}).get("db_categories", [])

    results = {
        "summary": {
            "total_evaluated": 0,
            "confirmed_eligible_count": 0,
            "potentially_eligible_count": 0,
            "insufficient_info_count": 0,
            "ineligible_count": 0,
            "category_key": category_key,
            "category_name": CATEGORY_GROUPS.get(category_key, {}).get("name", "All Government Schemes")
        },
        "confirmed_eligible": [],
        "potentially_eligible": [],
        "insufficient_info": [],
        "ineligible": [],
        "no_match_explanation": None,
        "disclaimer": STATUTORY_DISCLAIMER
    }

    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            if service_id:
                cursor.execute("""
                    SELECT id, name, category, state, eligibility, documents_required, steps, fees, processing_time, source_url, last_verified
                    FROM services WHERE id = ?
                """, (service_id,))
                rows = cursor.fetchall()
            elif target_categories:
                placeholders = ",".join("?" for _ in target_categories)
                query = f"""
                    SELECT id, name, category, state, eligibility, documents_required, steps, fees, processing_time, source_url, last_verified
                    FROM services WHERE category IN ({placeholders})
                    ORDER BY id ASC
                """
                cursor.execute(query, target_categories)
                rows = cursor.fetchall()
            else:
                cursor.execute("""
                    SELECT id, name, category, state, eligibility, documents_required, steps, fees, processing_time, source_url, last_verified
                    FROM services
                    ORDER BY id ASC
                """)
                rows = cursor.fetchall()

            for row in rows:
                svc = dict(row)
                eval_res = evaluate_service_eligibility(svc, user_profile)
                results["summary"]["total_evaluated"] += 1

                st = eval_res["status"]
                if st == "confirmed_eligible":
                    results["confirmed_eligible"].append(eval_res)
                    results["summary"]["confirmed_eligible_count"] += 1
                elif st == "potentially_eligible":
                    results["potentially_eligible"].append(eval_res)
                    results["summary"]["potentially_eligible_count"] += 1
                elif st == "insufficient_info":
                    results["insufficient_info"].append(eval_res)
                    results["summary"]["insufficient_info_count"] += 1
                else:
                    results["ineligible"].append(eval_res)
                    results["summary"]["ineligible_count"] += 1

    except Exception as e:
        results["error"] = str(e)
        return results

    # Generate explanation if no schemes match
    total_eligible = results["summary"]["confirmed_eligible_count"] + results["summary"]["potentially_eligible_count"]
    if total_eligible == 0:
        age_str = f"age {user_profile.get('age')}" if user_profile.get('age') else "provided age"
        inc_str = f"income ₹{float(user_profile.get('annual_income', 0)):,.0f}" if user_profile.get('annual_income') else "stated income"
        failed_reasons = []
        for inel in results["ineligible"][:3]:
            for r in inel["conditions_failed"]:
                if r not in failed_reasons:
                    failed_reasons.append(r)

        reason_summary = "; ".join(failed_reasons) if failed_reasons else f"Parameters ({age_str}, {inc_str}) do not fall within the eligibility parameters of schemes in '{results['summary']['category_name']}'."

        results["no_match_explanation"] = {
            "title": f"No Matching Schemes Found in {results['summary']['category_name']}",
            "reason": reason_summary,
            "remediation": [
                "Verify your annual income and age inputs to ensure there are no typographical errors.",
                "If you are seeking general citizen services (e.g., PAN, Passport, Aadhaar, Voter ID), select the 'All Government Schemes' or 'Certificates, Identity & Transport' category.",
                "Review the follow-up items under 'Follow-up Needed' to provide missing information that could qualify you for additional schemes.",
                "Use the AI Civic Assistant for tailored guidance on alternative state-level social security programmes."
            ]
        }

    return results


def build_comparison_matrix(service_ids: List[int], db_path: str = "code/BHARATASSIST/bharatassist.db") -> Dict[str, Any]:
    """
    Build a side-by-side comparison matrix for 2 to 4 selected schemes.
    Returns structured data for responsive table rendering.
    """
    clean_ids = [int(i) for i in service_ids if str(i).isdigit()][:4]
    if not clean_ids:
        return {"error": "No valid scheme IDs provided for comparison."}

    schemes_data = []
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            placeholders = ",".join("?" for _ in clean_ids)
            cursor.execute(f"""
                SELECT id, name, category, state, eligibility, documents_required, steps, fees, processing_time, source_url, last_verified
                FROM services WHERE id IN ({placeholders})
            """, clean_ids)
            for row in cursor.fetchall():
                svc = dict(row)
                svc["benefits"] = _extract_verified_benefits(svc["name"], svc["category"], svc.get("steps", ""))
                schemes_data.append(svc)
    except Exception as e:
        return {"error": f"Failed to retrieve schemes for comparison: {str(e)}"}

    if not schemes_data:
        return {"error": "Selected schemes could not be found in the database."}

    comparison_fields = [
        {"key": "name", "label": "Scheme / Service Name"},
        {"key": "category", "label": "Category & Domain"},
        {"key": "state", "label": "Jurisdiction / Scope"},
        {"key": "eligibility", "label": "Eligibility Conditions"},
        {"key": "benefits", "label": "Key Benefits & Entitlements"},
        {"key": "documents_required", "label": "Required Documents"},
        {"key": "fees", "label": "Official Fees & Charges"},
        {"key": "processing_time", "label": "Estimated Processing Time"},
        {"key": "source_url", "label": "Official Application Portal"},
        {"key": "last_verified", "label": "Last Verified Date"}
    ]

    return {
        "schemes": schemes_data,
        "fields": comparison_fields,
        "disclaimer": STATUTORY_DISCLAIMER
    }
