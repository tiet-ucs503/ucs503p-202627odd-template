# Week 4: Heatmap and Analytics Page Structure

Dates: 2 November 2026 – 8 November 2026

# Planning the Heatmap and Analytics Pages

## Objective

The main objective of the fourth week was to work on the structure of the Heatmap and Analytics pages of Algo Recall. After completing the basic question management and revision features, I wanted to focus on how users could see their overall progress and understand their DSA practice habits.

## Relevant Context

During this week, I mainly worked on deciding what information should be available on these two pages and how it should be presented.

The two main areas I focused on were:

- Heatmap Page: I wanted to create a calendar-style heatmap that would show the user's daily DSA activity using different shades based on the amount of activity.
- Analytics Page: I started deciding which statistics would be useful for users to understand their overall performance and revision progress.

## Planning the Analytics

For the Analytics page, I considered including the following information:

- Total questions added and revised.
- Topic-wise distribution of questions.
- Difficulty-wise distribution (Easy, Medium, Hard).
- Confidence-level analysis.
- Revision activity over time.

I wanted these statistics to be presented through charts and other visual elements so that users could understand their progress more easily.

## Frontend Component Structure

I also worked on deciding how the Analytics page should be divided into different sections. Instead of putting everything into one large component, I planned separate components for different purposes, such as:

- **Analytics Overview:** To display important statistics.
- **Topic Distribution:** To show questions across different DSA topics.
- **Difficulty Distribution:** To show the number of Easy, Medium and Hard questions.
- **Confidence Analysis:** To understand the confidence levels of users.
- **Revision Activity:** To show how regularly users revise their questions.

This gave me a clearer idea of how the frontend would be organized when I started developing these pages.

## Key Observations

While planning these pages, I realized that simply showing numbers would not be very useful. The statistics needed to be presented in a way that actually helped users understand their strengths, weaker topics and consistency. I also understood the importance of dividing a page into smaller reusable components to keep the code organized.

## Outcome

By the end of the fourth week, I had decided the basic structure of the Heatmap and Analytics pages, identified the important statistics to be included, and planned the frontend components required for them. This gave me a clear direction for working on these pages in the later stages of the project.