# Weekly Progress Journal — Amish Kapoor (Roll No: 1024160005)

**Project Name:** PRISM (Poverty Risk Identification through Statistical Mapping)
**Role:** Contributor — Data Engineering, Modeling \& Documentation

\---

## Week 1 (Aug 3 - Aug 9): Data Sources \& Scope

* Surveyed candidate government data sources — Census 2011, NITI Aayog's National Multidimensional Poverty Index (MPI) 2023, and NFHS-5 — and checked their district-level granularity and public availability.
* Helped scope the project around a validated, explainable classification of district-level need during the team's ideation sessions.
* Researched the government's Aspirational Districts Programme (ADP) to understand how it could serve as a ground-truth validation source for the project.

## Week 2 (Aug 10 - Aug 16): Indicator Review \& Evaluation Metrics

* Explored the NITI Aayog's National Multidimensional Poverty Index (MPI) 2023 to identify which columns would feed into the fusion layer.
* Drafted the secondary evaluation metrics — silhouette score for clustering quality, F1-score across classifiers, and explainability coverage.
* Began designing the project pitch slide deck layout and visual theme.

## Week 3 (Aug 17 - Aug 23): Tech Stack \& Workflow Diagram

* Helped finalize the technology stack (Pandas, scikit-learn, Matplotlib/Seaborn) and the operational constraints for a reproducible, laptop-friendly pipeline.
* Worked with the team to finalize the core workflow diagram (raw data → cleaning/matching → clustering → classification → explainability layer).

## Week 4 (Aug 24 - Aug 30): NFHS \& SDG Data Collection

* Collected and compiled the raw NFHS-5 district-level data table for the fusion prototype.
* Collected and compiled the raw NITI Aayog's National Multidimensional Poverty Index (MPI) 2023 data table for the fusion prototype.
* Studied the SDG India index data and realized that it's format wasn't compatible with other datasets and it did not cover all districts (only covered 400) ,
  so researched for a more compatible and better data set and found the NITI Aayog's National Multidimensional Poverty Index (MPI) 2023 data set .
  
## Week 5 (Aug 31 - Sept 6):Started With Merging The Data Set
* Studied our four datasets to have an overview of all the important features of our dataset and select the feature on which merging of datasets should be performed .
* Concluded that the district name can be used to perform merging . so started with the merging and performed normalization to remove differences in the district names in different dataset and used these normalized names to make a new   column dkey which will be column merging will be done on .
* then merged all the datasets and started with the process of analyzing the merged dataset to look for issues such as missing data , duplicate data etc , which could become big problem in the future.

## Week 6 (Sept 7 - Sept 13):Analyzing the merged dataset to find issues
* Realized that there are multiple districts with the same name in different states . Thus realizing that district name alone is not enough as dkey to merge the dataset , so decided to change to district name + state name as the d key .
* performed major analysis on the missing and duplicate data , our merged dataset performed really well on missing data as for 95% columns only 0-5% data was missing and for 4% there was 23% which was due to missing data in our MPI dataset and there were very few duplicate rows which were removed .
* Then started working on filling the missing data using data science techniques , used median of the column to fill the missing data in most of the columns .
* then performed the outlier analysis , and started working on finding what problems these will cause and what solutions can we use .

## Week 7 (Sept 14 - Sept 20): Handling Missing Data and Feature Engineering
* Continued working on missing-value analysis and identified the columns with the highest percentage of missing data in the merged dataset.
* Used the median imputation technique to fill missing values in numerical columns, as it is less affected by extreme values than the mean.
* Checked the dataset after imputation to verify that missing numerical feature values had been handled properly.
* Reviewed the dataset columns and removed an unnecessary column with high missingness to improve the quality of the dataset.

## Week 8 (Oct 5 - Oct 11): Outlier Analysis and Feature Selection Preparation
* Performed outlier analysis on the numerical columns using the Interquartile Range (IQR) method, calculating Q1, Q3, and the lower and upper bounds for each feature.
* Generated an outlier summary to identify the features containing the highest number of potential outliers.
* Started examining whether the detected outliers represented genuine differences between districts or possible data-quality issues.
* Considered the importance of retaining meaningful demographic extremes rather than automatically removing all outliers.

## Week 9 (Oct 12 - Oct 18): District Clustering and Model Evaluation
* Selected a set of 12 relevant demographic, household, and MPI-related features for district clustering.
* Applied feature scaling and used K-Means clustering to group districts according to similarities in their selected characteristics.
* Compared K-Means results with Agglomerative Clustering to examine whether different clustering approaches produced similar district groupings.
* Calculated the Adjusted Rand Index (ARI) to measure the agreement between the two clustering methods.

