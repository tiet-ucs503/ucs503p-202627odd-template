# Database Design

## Main Entities

The initial database will contain the following entities:

1. User
2. Student
3. Staff
4. Admin
5. Hostel
6. LaundryRequest
7. LaundryItem
8. LaundryStatusHistory
9. PickupToken
10. Complaint
11. Notification
12. AuditLog

## Relationships

- A Student can create multiple LaundryRequests.
- A LaundryRequest can contain multiple LaundryItems.
- A LaundryRequest has multiple status history records.
- A LaundryRequest can have a PickupToken.
- A LaundryRequest can have complaints.
- A Student belongs to a Hostel.
- Staff members process LaundryRequests.
- System activities can be recorded in AuditLog.