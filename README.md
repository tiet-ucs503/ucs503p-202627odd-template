
# CityServe

### Connecting Customers with Local Services

**CityServe** is a full-stack web platform that connects customers with local businesses and service providers through a unified marketplace. Customers can discover local products and services, place orders or service requests, track their status, and review completed orders. Vendors can manage their offerings and process customer orders, while administrators can verify vendors and oversee the platform.

---

## 👥 Team

### Team Cyphers

- Ruhanika
- Ayushi
- Karan Bansal

---

## 🎯 Problem Statement

Local customers often face difficulties when trying to discover reliable businesses and service providers. Information about local offerings is scattered across different platforms, while many small vendors have limited digital visibility.

CityServe addresses these problems by providing a centralized platform where customers can discover local vendors, browse their products and services, and interact with them through a structured ordering workflow.

---

## 💡 Proposed Solution

CityServe provides a unified ecosystem for:

- Local vendor discovery
- Product and service browsing
- Customer-to-vendor interaction
- Product ordering and service requests
- Order status tracking
- Customer reviews
- Vendor verification
- Administrative oversight

The platform supports three primary roles:

**Customer → Vendor → Admin**

---

## ✨ Key Features

### 👤 Customer

- Customer registration and login
- Browse categories and vendors
- Discover products and services
- Place product orders
- Submit service requests
- Track order status
- Cancel pending orders
- Review completed orders

### 🏪 Vendor

- Vendor registration
- Manage business information
- Add and manage products/services
- Receive customer orders
- Approve or reject orders
- Complete orders
- View relevant customer and order information

### 🛡️ Admin

- Manage and oversee users
- View registered vendors
- Verify vendor registrations
- Monitor platform information
- View platform analytics

---

## 🔄 Order Workflow

CityServe uses a unified order workflow for both products and services.

```text
                    ┌───────────┐
                    │  PENDING  │
                    └─────┬─────┘
                          │
             ┌────────────┼────────────┐
             │            │            │
             ▼            ▼            ▼
        APPROVED      REJECTED     CANCELLED
             │
             ▼
        COMPLETED
             │
             ▼
           REVIEW
````

The primary workflow is:

```text
PENDING → APPROVED → COMPLETED
```

Alternative paths:

```text
PENDING → REJECTED
PENDING → CANCELLED
```

Customer cancellation is available while the order is pending.

---

## 🏗️ System Architecture

CityServe follows a layered client-server architecture.

```text
┌──────────────────────────────┐
│       User / Browser         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Next.js + TypeScript         │
│ Tailwind CSS                 │
│ Frontend                     │
└──────────────┬───────────────┘
               │
               │ REST API
               ▼
┌──────────────────────────────┐
│ Express.js + TypeScript      │
│ Backend                      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Sequelize ORM                │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ MySQL Database               │
└──────────────────────────────┘

       External Integrations
       ┌──────────┐  ┌──────────┐
       │ Mapbox   │  │ Razorpay │
       └──────────┘  └──────────┘
```

---

## 🛠️ Technology Stack

| Layer               | Technology           |
| ------------------- | -------------------- |
| Frontend            | Next.js (App Router) |
| Language            | TypeScript           |
| Styling             | Tailwind CSS         |
| Icons               | Lucide React         |
| Backend             | Express.js           |
| API                 | REST API             |
| ORM                 | Sequelize            |
| Database            | MySQL                |
| Authentication      | JWT                  |
| Password Security   | bcrypt               |
| Maps                | Mapbox               |
| Payments            | Razorpay             |
| Frontend Deployment | Vercel               |
| Backend Deployment  | Render               |

---

## 🗄️ Database Design

The final CityServe database consists of **six core tables**:

```text
users
categories
vendors
offerings
orders
reviews
```

### Main Relationships

```text
User ─────────────── Vendor
 │                     │
 │                     │
 │                     └──── Offering
 │                            │
 │                            │
 └──────────── Order ─────────┘
                   │
                   ▼
                 Review

Category ─────── Vendor
Category ─────── Offering
```

### Unified Offerings

Products and services are represented using a single `offerings` table.

The `type` attribute distinguishes between:

```text
PRODUCT
SERVICE
```

### Unified Orders

Product purchases and service requests are represented using the same `orders` model.

Service-specific scheduling is handled through:

```text
scheduledAt
```

This allows both product and service workflows to follow a consistent order architecture.

---

## 🔐 Security

CityServe implements multiple security and validation mechanisms:

* JWT-based authentication
* Access and refresh token architecture
* Refresh tokens stored in HttpOnly cookies
* bcrypt password hashing
* Role-based authorization
* Resource ownership checks
* Server-side order-state validation
* Review restrictions
* One review per completed order
* Passwords are never returned through APIs

---

## 📍 External Integrations

### Mapbox

Mapbox is used for location and map-related functionality.

A demonstration fallback location is available when the required Mapbox API configuration is not present.

### Razorpay

Razorpay is used as the planned payment integration.

A demonstration payment flow is available when the required Razorpay credentials are not configured.

---

## 📊 Dataset

CityServe includes a local vendor dataset containing **155 businesses from Patiala**.

The dataset was sourced using the Google Places API and integrated into the platform to provide a realistic local marketplace environment.

Imported vendors can subsequently be managed and verified through the platform's vendor administration workflow.

---

## 🚀 Deployment

The CityServe prototype has been deployed as a live application.

### Frontend

**Vercel**

The Next.js frontend is deployed on Vercel.

### Backend

**Render**

The Express.js backend is deployed on Render.

```text
             LIVE APPLICATION
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
       Vercel               Render
      Frontend              Backend
          │                   │
          └─────────┬─────────┘
                    ▼
                 MySQL
```

---

## 🧪 Testing & Verification

The following verification steps have been completed:

* Frontend TypeScript check completed successfully
* Backend TypeScript check completed successfully
* Next.js production build completed successfully
* Customer workflows tested
* Vendor workflows tested
* Admin workflows tested
* Frontend-backend integration tested
* Core workflows verified in the deployed environment

---

## 📱 Core Application Flow

```text
Register / Login
       ↓
Browse Categories & Vendors
       ↓
Select Product / Service
       ↓
Place Order / Service Request
       ↓
Vendor Approval
       ↓
Order Completion
       ↓
Customer Review
```

---

## 🔮 Future Scope

The following improvements can be added in future versions:

* Pagination for large vendor and offering datasets
* Proper address book management
* Full payment gateway integration
* Image uploads for offerings
* Notification system
* Further scalability and performance improvements

---


## 👨‍💻 Team Cyphers

**CityServe — Connecting Customers with Local Services**

Developed as a full-stack software engineering project by **Team Cyphers**.

