# ServeConnect: Advanced 10-Week Sprint Plan
*Including In-App Bookings, Stripe Payments, and Real-Time Chat*

**Team:** 
- **Keshav:** Frontend (React)
- **Vijay:** Backend & Database (Node.js, Express, MongoDB)
- **Pratham:** Team Lead, Admin Module, Integration & Testing

---

## The 10-Week Roadmap

| Week | Phase | Keshav (Frontend) | Vijay (Backend) | Pratham (Integration/Lead) |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Setup & Foundation** | React + Vite Setup, Routing | Node + Express + MongoDB Setup | Project Architecture, Git Strategy |
| **2** | **Advanced DB & Design** | UI/Wireframes for all flows | DB Schemas (Users, Workers, Bookings, Messages) | System Workflows, API Requirements |
| **3** | **Authentication** | Login/Register UI, Protected Routes | JWT Auth APIs, Role Middleware | Auth Flow Testing, Edge Cases |
| **4** | **Registration & Admin** | Worker Registration Form, Admin UI | Worker APIs, Admin Approval APIs | Admin Workflow, Status Validations |
| **5** | **Customer Search** | Search Bar, Filters, Worker Cards | Search, Filtering, and Sorting APIs | Ranking Logic, Search Endpoints Test |
| **6** | **Scheduling & Bookings** | Booking UI, Date/Time Picker | Booking CRUD APIs, Status Updates | E2E Booking Flow Testing |
| **7** | **Real-Time Chat** | Chat Interface, Socket.io Client | Socket.io Server, Message History | Real-time Edge Case Testing |
| **8** | **In-App Payments** | Stripe Checkout UI | Stripe Payment Intents, Webhooks | Payment Verification Flow |
| **9** | **Trust Features & Test** | Ratings UI, Cloudinary Uploads | Reviews APIs, Cloudinary Config | System Integration Testing (Jest) |
| **10** | **Deployment & Demo** | UI Polish, Responsive Fixes | Backend Polish, Cloud Deployment | Final Report, Demo Prep, Viva |

---

## Detailed Weekly Breakdown

### Week 1 — Project Setup (Completed)
- **Goal:** Initialize repositories and environments.
- **Backend (Vijay):** Server running, MongoDB connected, folder structure created.

### Week 2 — Database & UI Design (In Progress)
- **Goal:** Lay the data foundation for the entire advanced application.
- **Backend (Vijay):** Design schemas for `User`, `Worker`, `Review`, `Booking`, and `Message`.

### Week 3 — Authentication (In Progress)
- **Goal:** Secure the application.
- **Backend (Vijay):** Passwords hashed via `bcryptjs`, stateless auth via `jsonwebtoken`.

### Week 4 — Worker Registration & Admin Approval
- **Goal:** Allow workers to apply, and admins to approve them.
- **Backend (Vijay):** `POST /api/workers` (Registration). `PUT /api/admin/workers/:id/approve` (Admin verification). 

### Week 5 — Customer Search & Discovery
- **Goal:** Customers can find approved workers.
- **Backend (Vijay):** `GET /api/workers?category=plumber&location=delhi`. Implement indexing for fast queries.

### Week 6 — Scheduling & Bookings *(Advanced Feature)*
- **Goal:** Customers book specific time slots instead of just calling.
- **Backend (Vijay):** Create Booking APIs. Handle logic so a worker cannot be double-booked for the same time slot.
- **Pratham:** Test the "Customer requests booking -> Worker accepts/rejects" workflow.

### Week 7 — Real-Time Live Chat *(Advanced Feature)*
- **Goal:** Customers and workers can chat in real-time.
- **Backend (Vijay):** Attach `Socket.io` to the Express server. Create events for `join_room`, `send_message`, and `receive_message`. Persist messages to MongoDB.

### Week 8 — In-App Payments *(Advanced Feature)*
- **Goal:** Securely process payments once a booking is complete.
- **Backend (Vijay):** Integrate Stripe Node SDK. Create a payment intent endpoint. Set up Stripe Webhooks to listen for `payment_intent.succeeded` to mark bookings as paid.

### Week 9 — Trust Features & Testing
- **Goal:** Add ratings, certificates, and test the whole app.
- **Backend (Vijay):** Cloudinary API integration for profile pictures/certificates. Add Ratings logic. Write Jest unit tests.

### Week 10 — Finalization, Deployment + Demo
- **Goal:** Launch the MVP.
- **Backend (Vijay):** Host the database on Atlas (production mode), deploy Node server to Render or Heroku. Lock down CORS and environment variables.

