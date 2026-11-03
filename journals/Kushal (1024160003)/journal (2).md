# Weekly Progress Journal — Kushal (Roll No: 1024160003)

**Project Name:** PRISM (Poverty Risk Identification through Statistical Mapping)
**Role:** Contributor — Data Engineering, Modeling \& Documentation

\---

## Week 1 (Aug 3 - Aug 9): Pain Points \& Clustering Research

* Flagged the core pain point we wanted to solve: policy decisions still leaning on outdated Census 2011 data instead of newer, richer survey streams.
* Researched prior work on unsupervised development-tier clustering (K-Means, hierarchical) and classification against the Aspirational Districts Programme (ADP) list.
* Took part in the team's project-selection brainstorming and helped articulate why the topic matters now — outdated Census 2011 reliance vs. richer, siloed newer data.

## Week 2 (Aug 10 - Aug 16): Name Matching \& Proposal Structuring

* Investigated fuzzy-matching approaches for reconciling district names across the three sources and drafted the normalization rules (lowercase, strip "district"/"dist." suffixes).
* Sketched the validation plan of testing on 2-3 mixed-development states before scaling nationally.
* Structured the overall project proposal document around the required sections (higher-order goal, time-to-value, problem statement, solution, evaluation, scalability).

## Week 3 (Aug 17 - Aug 23): Proposal Drafting \& Repository Setup

* Drafted the project proposal document, writing sections (problem statement, solution, evaluation, risks, scalability) before circulating it to the team for review.
* Created the team's GitHub repository and sent it to Mr. Jeelani Asif for review alongside the proposal submission on Aug 21.
* Finalized formatting, author metadata, and proofreading for the full proposal before submission.

## Week 4 (Aug 24 - Aug 30): Census Dataset Collection \& Cleaning

* Collected and compiled the raw Census 2011 district-level dataset for the fusion prototype.
* Flagged a batch of ambiguous Census district-name variants for manual review before the final merge.
* Set up the journals folder structure for weekly progress tracking, following the course's expected format.

## Week 5 (Aug 31 - Sep 6): Merge Validation and Gantt Chart Creation
* Exploratory Data Analysis & Missing-Value Study.
* Validated that the Census dataset merged cleanly into the first fused table and spot-checked a sample of districts for accuracy.
* Created a Gantt chart mapping out the project timeline and milestones through the remaining deliverables, and shared it with the team for planning.

## Week 6 (Sept 7 - Sept 13): ER Diagram & ADP Comparison
* Compared the model-flagged districts against the official ADP list and logged mismatches for the team to review.
* Created an ER diagram outlining the fused district-level data schema (SDG, Census, NFHS, and ADP tables and how they relate) for the data layer documentation.

## Week 7(Sep 14 - Sept 20): Handling Missing Data and Feature Engineering
* Worked on feature engineering by creating additional features from existing census data, including literacy rate, female population rate, SC/ST population rates, and workers rate.
* Assisted in examining missing values and reviewing the quality of the prepared dataset to ensure it was suitable for subsequent machine learning tasks.
* Standardized district identifiers and checked the consistency of the merged Census, NFHS, MPI, and Aspirational Districts datasets.

## Week 8(Oct 5 - Oct 11): Outlier Analysis and Feature Selection Preparation
* Worked on reducing the number of features by reviewing the available columns and identifying relevant variables for further analysis.
* Contributed to reviewing relevant features and understanding the need for standardization before applying distance-based clustering algorithms.
* Applied standardization to the selected numerical features so that variables with larger numerical scales would not dominate distance-based clustering methods.

## Week 9(Oct 12 - Oct 18): District Clustering and Model Evaluation
* Analyzed the relationship between the identified district clusters and the Aspirational District classification.
* Created a contingency table to compare the number and percentage of Aspirational Districts across the clusters.
* Explored feature selection using L1-regularized Logistic Regression (Lasso) and Random Forest feature importance, and began evaluating model performance through stratified five-fold cross-validation using metrics such as F1-score, precision, and recall.



