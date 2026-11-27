# Week 3: Implementation of Core Question Management and Dashboard Features

# Question Management and Revision Functionality

## Objective

The main objective of the third week was to move from the initial React setup to implementing the actual functionality of Algo Recall. After setting up the project structure and routing in the previous week, I started working on the main user interactions, including adding questions through a form, displaying them on the dashboard, revising previously solved questions, and tracking the user's daily revision progress.

## Relevant Context

Algo Recall is intended to help students manage their solved Data Structures and Algorithms (DSA) questions and revise them regularly. For this, the application needed a way to store question details, display them in an organized manner, and allow users to update their confidence after revisiting a question.

During this week, I focused on connecting these different parts of the frontend so that the application could support a basic question revision workflow.

The main areas of work were:

- **Question Entry:** Developing a form to enter the details of individual questions.
- **Question Display:** Showing the saved questions on the dashboard using separate question cards.
- **Revision Functionality:** Allowing users to revise a question and update their confidence and notes.
- **Progress Tracking:** Updating the dashboard's completion status and progress indicator after a revision.
- **Frontend Data Management:** Using React state and browser storage to manage question data and revision-related updates during frontend development.

## Implementation of the Add Question Form

I started by developing the Add Question form, which allows users to enter the details of a question they have already solved. The form includes fields such as question title, topic, subtopic, difficulty, coding platform, question link, initial confidence, date solved, and notes or mistakes.

I used React's `useState` hook to maintain the form values in a single state object. A common change handler updates the appropriate field whenever the user enters or changes information. This approach avoids maintaining a separate state variable for every input and makes the form easier to manage.

When the form is submitted, the default browser submission is prevented, and a new question object is created using the entered data. A unique ID is generated for the question, the confidence value is converted into a number, and a creation timestamp is added. The new question is then stored along with the previously saved questions.

The main reason for using this approach was to make sure that adding a new question would not overwrite the existing questions.

A simplified example of the saving logic is shown below:

```jsx
const savedQuestions = JSON.parse(
    localStorage.getItem("algoRecallQuestions") || "[]"
);

const newQuestion = {
    ...formData,
    id: crypto.randomUUID(),
    confidence: Number(formData.confidence),
    createdAt: new Date().toISOString(),
};

localStorage.setItem(
    "algoRecallQuestions",
    JSON.stringify([...savedQuestions, newQuestion])
);
```

After a successful submission, the form fields are reset to their initial values, and a success message is displayed. If saving fails, an error message is shown instead. This makes the form easier to use and provides feedback about whether the operation was successful.

## Displaying Questions on the Dashboard

After implementing question entry, the next step was to display the questions in a way that users could easily understand and interact with.

I worked on the dashboard and the `QuestionCard` component. Each question card displays the question title, topic, optional subtopic, difficulty, platform, and current confidence level. If a question link is available, the title can also be used to open the question on its original platform.

Keeping the question card in a separate component helps avoid placing all the display logic inside the dashboard page. It also makes the card reusable wherever question details need to be displayed.

The dashboard was intended to act as the main working area of the application, where users could view their questions and perform revision-related actions without navigating through multiple pages.

## Implementing the Revision Functionality

An important feature of Algo Recall is that users should be able to update their understanding of a question after revisiting it. For this purpose, I implemented the Revise button on the question card.

When the user clicks the button, a revision form opens. It allows the user to update the confidence level on a scale of 1 to 5 and add notes about mistakes, difficulties, or concepts that need further revision.

I used local component state to manage the editing form and its input values. The revision is submitted through a callback passed to the question card by its parent component. This keeps the question card responsible for collecting the updated information, while the parent handles the revision operation.

After submission, the editing form closes, and the updated information is passed to the relevant revision handler.

This approach separates the user interface from the data-handling logic and makes the revision process easier to maintain.

## Progress Tracking and Revision Updates

Along with allowing users to revise questions, I also worked on connecting revision actions with the dashboard's completion status and progress indicator.

The dashboard tracks which questions have been revised on the current day. When a revision is saved, the question is marked as completed, and the progress indicator is updated accordingly.

The progress percentage is calculated using the number of completed questions and the number of questions allocated to the revision queue:

\[
\text{Progress} =
\frac{\text{Completed Questions}}{\text{Allocated Questions}}
\times 100
\]

A small part of the implementation is shown below:

```jsx
const allocated = questions.length;

const completed = questions.filter(
    (question) => completedIds.includes(question.id)
).length;

const progress = allocated === 0
    ? 0
    : Math.round((completed / allocated) * 100);
```

The check for zero allocated questions prevents division by zero. The resulting percentage is used to update the dashboard's progress indicator, allowing users to see how much of their revision queue they have completed.

This feature was important because the dashboard needed to reflect the user's actual revision activity instead of simply displaying a list of questions.

## Key Observations and Implementation Decisions

While working on these features, I understood that implementing individual components is only one part of frontend development. The different components also need to communicate properly and maintain consistent data.

Some of the important observations from this week's work were:

- **Managing Form Data:** Keeping all the form values in one state object made it easier to handle input changes and reset the form after submission.
- **Separating Components:** Creating a reusable question card helped keep the dashboard code organized and made it easier to add revision-related interactions.
- **Maintaining Question Data:** Using `localStorage` provided a simple way to retain question data in the browser during the initial frontend development, without depending on a completed backend.
- **Keeping Progress Synchronized:** The revision operation needed to update both the question's information and its completion status so that the progress indicator remained consistent with the user's actions.
- **Handling Empty and Error States:** The form included success and error messages, while the dashboard displayed an appropriate message when no questions were available.

These decisions helped me understand how form handling, component state, browser storage, and UI updates work together in a React application.

## Outcome

By the end of the third week, I had worked on the main question-entry and revision workflow of Algo Recall. Users could enter question details through a form, view question cards on the dashboard, update confidence and notes through the revision interface, and see the dashboard's progress change as questions were completed.

The work completed during this week established the basic interaction between question management, revision actions, and progress tracking. It also provided a foundation for further development, including bulk question import, login functionality, and a dedicated revision history page, which were planned for the following week.