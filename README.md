# PRISM

**Poverty Risk Identification through Statistical Mapping**

A fused, validated, and explainable machine learning pipeline for identifying poverty and development zones across Indian districts.

Project for UCS503 (Software Engineering), Thapar Institute of Engineering and Technology
Submitted to: Dr. Jeelani Asif

\---

## Team

|Name|Roll No.|
|-|-|
|Amish Kapoor|1024160005|
|Aryan Chaturvedi|1024160009|
|Kushal|1024160003|

\---

## Overview

India's largest anti-poverty programmes still lean heavily on outdated, single-source indicators — mainly Census 2011 — while richer, newer data streams like the MPI and NFHS remain siloed and underused. PRISM closes this gap by translating scattered, unvalidated development data into a **measurable, explainable, and policy-actionable classification of district-level need**.

### Problem

* **Outdated snapshots** — major assessments still lean on Census 2011, over a decade old.
* **Fragmented indicators** — health, income, and infrastructure data live in separate government sources.
* **No ground-truth check** — classifications are rarely validated against a real outcome.
* **No explanation, only a label** — models flag districts as at-risk without saying why.

\---

## Solution

PRISM merges three data sources and runs them through a clustering → classification → explainability pipeline, validated against the government's own Aspirational Districts Programme (ADP) list.

```
Raw data sources          MPI, Census 2011, NFHS-5
        │
Data quality assurance    Normalize, fuzzy-match, flag low-confidence
        │
Data layer                Cleaned, fused district-level dataset
        │
Model layer               Clustering, classification, feature importance
        │
Presentation layer        Dashboard: clusters, classification, explanations
```

### Components

* **Data fusion layer** — merges SDG India Index, Census 2011, and NFHS-5 into a single district-level dataset using cleaned state/district keys.
* **Clustering module** — groups districts by development level using K-Means (primary) and hierarchical clustering (cross-check).
* **Classification module** — predicts Aspirational-District status using Random Forest (primary, for explainability), Logistic Regression (interpretable baseline), and SVM (benchmark).
* **Explainability layer** — surfaces feature importance via Random Forest so each classification comes with a reason, not just a label.
* **Validation check** — compares model output against the real ADP list.

\---

## Evaluation Criteria

|Metric|Target|
|-|-|
|Validation agreement with ADP (overlap)|≥ 75%|
|Clustering quality|Silhouette score|
|Classification robustness|F1-score across classifiers|
|Explainability coverage|% of flagged districts with a top-3 feature explanation|
|Data completeness|% of districts matched across all fused sources|

Validation plan: test on 2–3 mixed-development states before scaling nationally; compare model-flagged districts against the ADP list and log mismatches for review.

\---

## Tech Stack

* **Data manipulation:** Pandas
* **Modeling:** scikit-learn (K-Means, hierarchical clustering, Logistic Regression, Random Forest, SVM)
* **Visualization:** Matplotlib / Seaborn
* **Name matching:** fuzzy string-matching library
* **Presentation:** Notebook or lightweight dashboard
* **Version control:** Git

No proprietary tools, satellite imagery, or deep learning pipelines — kept reproducible on standard laptops, matching syllabus scope.

\---

## Repository Structure

```
├── data/           # Raw and fused district-level datasets (MPI, Census, NFHS, ADP)
├── notebooks/       # Clustering, classification, and evaluation notebooks
├── proposal/        # Project proposal (LaTeX/PDF) and pitch deck
├── journals/         # Weekly progress journals, one folder per member
│   ├── 1024160005-amish/
│   ├── 1024160009-aryan/
│   └── 1024160003-kushal/
└── README.md
```

\---

## Getting Started

```bash
git clone <repo-url>
cd prism
pip install -r requirements.txt
```

Requirements (indicative): `pandas`, `scikit-learn`, `matplotlib`, `seaborn`, `fuzzywuzzy` (or `rapidfuzz`)

1. Place raw MPI, Census 2011, and NFHS-5 files in `data/raw/`.
2. Run the data fusion script to produce the cleaned, merged district table.
3. Run the clustering notebook to generate development-tier groupings.
4. Run the classification notebook to benchmark models against the ADP list.
5. View results in the dashboard/notebook output.

\---

## Roadmap

**Initial deliverable**

* Data fusion script
* District name matching (cleaned/validated state-district keys)
* K-Means clustering baseline
* Basic evaluation against ADP list
* CI: data-merge correctness tests + linting

**Subsequent deliverables**

* Additional classifiers (Random Forest, SVM, Naïve Bayes) with performance comparison
* Feature-importance / explainability layer
* Hierarchical clustering cross-check
* Dashboard for district-level exploration
* Expanded validation across more states

\---

## Risks \& Mitigations

|Risk|Mitigation|
|-|-|
|District name mismatch across sources|Rule-based cleaning + manual review of low-confidence matches|
|ADP list uses undisclosed criteria|Treated as a directional check, not an exact target|
|Flagged districts are a minority class|Evaluate with precision/recall, not raw accuracy|
|Too many algorithms stall progress|Lock a baseline model early, add others incrementally|

\---

## License

Academic project for UCS503, Thapar Institute of Engineering and Technology. Not licensed for external redistribution unless stated otherwise by the authors.

