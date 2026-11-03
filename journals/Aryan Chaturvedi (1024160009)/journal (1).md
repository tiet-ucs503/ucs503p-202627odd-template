# Weekly Progress Journal — Aryan Chaturvedi (Roll No: 1024160009)

**Project Name:** PRISM (Poverty Risk Identification through Statistical Mapping)
**Role:** Contributor — Data Engineering, Modeling \& Documentation

\---

## Week 1 (Aug 3 - Aug 9): ML Options \& Team Ideation

* Evaluated classical ML options (Logistic Regression, Random Forest, SVM) suited to a tabular, syllabus-scope pipeline, ruling out satellite imagery/deep learning approaches as out of scope.
* Participated in team brainstorming sessions and helped narrow the topic down to district-level poverty classification for UCS503.
* Drafted early notes on the pain points: outdated snapshots, fragmented indicators, no ground-truth check, and "no explanation, only a label."

## Week 2 (Aug 10 - Aug 16): Primary Metric \& Fusion Layer Design

* Defined the primary evaluation metric: percentage overlap between model-flagged under-developed districts and the official 112-district ADP list, with a 75% target.
* Drafted the design for the data fusion layer: how NITI Aayog's National Multidimensional Poverty Index (MPI) 2023, Census, and NFHS records would be merged on cleaned state/district keys.
* Wrote the Time-to-Value and Scalability sections, emphasizing early validation against the ADP list and the modular, decoupled pipeline design.

## Week 3 (Aug 17 - Aug 23): Proposal Feedback \& Cluster Validation

* Reviewed and gave technical feedback on the Evaluation Criterion and Risks \& Mitigations sections of Kushal's proposal draft.
* Designed and built the "Poverty \& Development Zones in India" pitch presentation, translating the proposal's data-fusion pipeline into a clean, presentable slide flow.

## Week 4 (Aug 24 - Aug 30): NITI Aayog ADP List \& Feature Importance

* Collected and compiled the NITI Aayog Aspirational Districts Programme (ADP) list — the ground-truth reference list — for the validation step.
* Cross-checked the ADP dataset's district naming convention against the merged fusion table to flag additional name-matching edge cases.
* Outlined the feature-importance extraction approach that will back the explainability layer in later deliverables.

## Week 5 (Aug 31 – Sep 6): Use Case Diagram & Data Flow Diagrams

* Worked on preparing and refining the PRISM Use Case Diagram to represent the interactions between Government Data Sources, the Data Analyst/Administrator, the Aspirational Districts Programme (ADP), and the Policy Maker/Decision Maker.
* Contributed to designing the Level 0 and Level 1 Data Flow Diagrams (DFDs) to illustrate the overall PRISM system, its major processes, and the flow of data between source datasets, data processing, machine learning, validation, and decision support.
* Worked on Level 2 DFDs to break down the major processes into detailed sub-processes, covering data acquisition and quality assurance, district matching and data fusion, clustering and classification, and validation and explainability.

## Week 6 (Sep 7 – Sep 13): Activity Diagram & Data Integration
* Created the PRISM Activity Diagram to represent the overall system workflow, including data processing, clustering, classification, and model evaluation.
* Helped refine the data integration approach after identifying that districts in different states can share the same name, making district name alone insufficient for accurate merging.
* Contributed to updating the district key (dkey) to combine district name and state name, improving the accuracy of dataset merging.

## Week 7 (Sep 14 – Sep 20): Feature Engineering & Dataset Integration
* Created household-related percentage features and additional demographic indicators from the existing dataset to capture important aspects of household conditions and district-level development, making the data more informative and suitable for further machine learning analysis.
* Contributed to reviewing the merged Census, NFHS, MPI, and Aspirational Districts datasets by checking data consistency, verifying district-level alignment, and identifying potential data integration issues that could affect the reliability of subsequent analysis and model development.

## Week 8 (Oct 5 – Oct 11): Outlier Analysis, PCA & Cluster Evaluation
* Applied Principal Component Analysis (PCA) to examine the variance explained by the dataset's principal components and understand how the dimensionality of the dataset could be reduced while retaining important information.
* Analyzed the relationship between the identified district clusters and the Aspirational District classification to understand how the clustering results corresponded with the existing classification of underdeveloped districts.
* Assisted in analyzing potential outliers in numerical features using the Interquartile Range (IQR) method and reviewing the summary of detected outliers.

## Week 9 (Oct 12 – Oct 18): Sequence Diagram & Class Diagram
* Created the PRISM Sequence Diagram to illustrate the interactions between system components and the flow of operations during data processing, model evaluation, and output generation.
* Designed the PRISM Class Diagram to represent the system's main components, their attributes, operations, and relationships.
* Refined both diagrams to improve clarity and maintain consistency with the proposed system architecture and workflow.

