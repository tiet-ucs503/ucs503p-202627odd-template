# Week 2 : Database + UI Design

# Designing MongoDB Schemas

## Goal:

Design the User, Worker, and Review models as per the sprint requirements.

## Relevant Context

We needed collections to represent the core application entities for ServeConnect:
- **User**: Basic authentication fields (name, email, password) and role management.
- **Worker**: Extended profile for workers (category, experience, charges, location, approval status).
- **Review**: Ratings and comments for workers left by customers.
- **Booking**: Scheduling system managing date, time, and booking status.
- **Message**: Real-time chat integration linking messages to a specific booking.

## Key Observation

Mongoose provides robust schema validation. The Worker and Review schemas must reference the User schema via `ObjectId`. Workers require a default status of 'pending' until an admin approves them. The Booking and Message schemas prepare us for the advanced features in the sprint plan.

## Solution

- Created `models/User.js` with predefined roles (`customer`, `worker`, `admin`).
- Created `models/Worker.js` with a reference to `User` and defined the `status` enum for the admin approval workflow.
- Created `models/Review.js` with references to `User` (customerId) and `Worker` (workerId).
- Created `models/Booking.js` for time-slot reservations and status tracking.
- Created `models/Message.js` for in-app chat functionalities.

