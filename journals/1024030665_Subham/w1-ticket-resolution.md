# Week 1 : CPRecal Extension Development

## W1 : Identifying the Correct LeetCode GraphQL Queries

### Error

We were unable to initially identify the exact GraphQL queries required to collect the necessary LeetCode problem and submission data.

### Relevant Context

The CPRecal extension needs to collect problem metadata and submission information from LeetCode. The extension also needs accepted-submission details such as the submission ID, runtime, memory, language, and code for further processing.

### Key Observation

The required information was not available through a single GraphQL query. Different types of information were provided through different GraphQL operations.

### Solution

We analyzed the available LeetCode GraphQL requests and identified the queries required for problem metadata, submission history, and submission details. These were then implemented separately in the extension.

---

## W1 : Preventing Old Submissions from Being Detected as New Submissions

### Error

The extension could detect submissions that had already been made before the current solving session as new submissions.

### Relevant Context

CPRecal needs to track the submissions made during the current solving session so that the correct number of attempts is recorded.

### Key Observation

The submission list returned by LeetCode also contains previous submissions for the same problem. Therefore, the extension needed a way to distinguish submissions made before the current session from submissions made after it started.

### Solution

When a new session starts, the extension fetches the existing submission list and stores the latest submission ID as `lastSeenTopId`. During subsequent polling, this ID is used as the baseline to identify only newer submissions.

---

## W1 : Resetting Submission Tracking for Continuous Submissions

### Error

The extension was not correctly resetting its submission-tracking state, which caused problems when the user made multiple submissions continuously before reaching an Accepted result.

### Relevant Context

A user can make several submission attempts for the same problem. CPRecal must track these attempts and continue monitoring until an Accepted submission is detected.

### Key Observation

The extension maintains state such as `acceptedDetected`, `submissionHistory`, `pollInterval`, and `lastSeenTopId`. Incorrect state handling could cause later submissions to be ignored or processed incorrectly.

### Solution

The submission-tracking logic was updated to reset the relevant state when a new solving session begins and update `lastSeenTopId` as new submissions are processed. The extension continues polling until an Accepted submission is detected.
