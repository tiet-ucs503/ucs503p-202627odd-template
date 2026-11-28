# Week 2 -Lehar Arora

## Week 2 Focus

This week, I focused on improving the BharatAssist AI Assistant by making it more conversational and context-aware. The main work involved implementing follow-up questioning, maintaining service context, adding a clear conversation option, improving service matching, and testing the updated assistant flow.

---

## Tasks Completed

### 1. Implemented Follow-Up Questioning

Improved the AI Assistant to support follow-up questions based on the government service discussed in the previous conversation.

Previously, users had to mention the service again in every question. The assistant was updated to maintain the currently selected service as conversation context.

For example:

> User: Tell me about PM-KISAN  
> Assistant: Provides PM-KISAN information  
>
> User: What documents are required?  
> Assistant: Answers using the PM-KISAN context  
>
> User: What are the eligibility criteria?  
> Assistant: Continues using the PM-KISAN context

This makes the assistant more natural and reduces repetition for the user.

---

### 2. Added Service Context Tracking

Added service context handling to the assistant backend.

The current service is stored during the conversation so that follow-up questions can refer to the previously discussed service.

The assistant API response was also updated to return the current service context through:

```text
context_service
