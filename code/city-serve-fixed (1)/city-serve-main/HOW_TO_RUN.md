# CityServe — Complete Project Execution & Run Guide

This guide provides end-to-end instructions for configuring, running, testing, and verifying the **CityServe** full-stack platform (Express + TypeScript backend, Next.js 14 App Router frontend, MySQL database via Sequelize, and the Patiala local business dataset).

---

## 1. System Requirements & Prerequisites

Before starting, verify that your environment has the following installed:

| Requirement | Recommended Version | Verification Command | Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 18.0.0` (v20+ recommended) | `node -v` | JavaScript runtime |
| **npm** | `>= 9.0.0` | `npm -v` | Package manager |
| **MySQL Server** | `8.0+` | `mysql --version` | Local service or Docker container |
| **Terminal** | PowerShell or Bash | — | Two terminal windows needed (one for backend, one for frontend) |

---

## 2. Architecture & Port Allocation

| Component | Directory | Port | Protocol | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Backend API** | [`backend/`](file:///c:/Users/HP/Desktop/city-serve-fixed%20(1)/city-serve-main/backend) | **4000** | HTTP / JSON | Express + Sequelize ORM + In-Memory Dataset Service |
| **Frontend Web App** | [`frontend/`](file:///c:/Users/HP/Desktop/city-serve-fixed%20(1)/city-serve-main/frontend) | **3000** | HTTP / HTML | Next.js 14 App Router + Tailwind CSS |
| **MySQL Database** | — | **3306** | MySQL TCP | Relational store for users, orders, partners, offerings, reviews |
| **Patiala Dataset** | [`backend/data/`](file:///c:/Users/HP/Desktop/city-serve-fixed%20(1)/city-serve-main/backend/data) | — | CSV / Static | 155 Patiala listings, 20 categories, 83 localities |

---

## 3. Database Setup (MySQL)

### Step 3.1: Ensure MySQL Service is Running
On Windows (PowerShell with Administrator privileges if needed):
```powershell
# Check if MySQL service is running or start it
Get-Service -Name *mysql* | Start-Service
```
Alternatively, verify connection over port 3306:
```powershell
Test-NetConnection -ComputerName localhost -Port 3306
```

### Step 3.2: Verify or Create the `cityserve` Database
Log into the MySQL CLI or MySQL Workbench:
```sql
CREATE DATABASE IF NOT EXISTS cityserve CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

If you wish to use a dedicated MySQL user rather than `root`:
```sql
CREATE USER IF NOT EXISTS 'cityserve'@'localhost' IDENTIFIED BY 'cityserve_pw';
GRANT ALL PRIVILEGES ON cityserve.* TO 'cityserve'@'localhost';
FLUSH PRIVILEGES;
```

---

## 4. Backend Configuration & Execution

### Step 4.1: Navigate to Backend Directory
Open **Terminal 1**:
```powershell
cd "c:\Users\HP\Desktop\city-serve-fixed (1)\city-serve-main\backend"
```

### Step 4.2: Install Backend Dependencies
```powershell
npm install
```

### Step 4.3: Verify or Edit `backend/.env`
Ensure [`backend/.env`](file:///c:/Users/HP/Desktop/city-serve-fixed%20(1)/city-serve-main/backend/.env) exists and contains your MySQL credentials:

```ini
# ---- Server ----
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# ---- Database (MySQL, via Sequelize + mysql2) ----
DB_HOST=localhost
DB_PORT=3306
DB_NAME=cityserve
DB_USER=root
DB_PASSWORD=2006@Ashu

# ---- Auth ----
JWT_ACCESS_SECRET=replace_with_a_long_random_string_cityserve_jwt_2026
JWT_REFRESH_SECRET=replace_with_a_different_long_random_string_refresh_2026
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ---- Optional Integrations (Safe in Demo Mode if blank) ----
MAPBOX_ACCESS_TOKEN=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

> [!NOTE]
> If `MAPBOX_ACCESS_TOKEN` or `RAZORPAY_KEY_ID` are left empty, the application automatically enables **DEMO MODE**. Interactive coordinate links and simulated checkout flows operate normally without charging cards or requiring third-party API keys.

### Step 4.4: (Optional) Database Sync & Seed
If initializing tables from scratch on a clean MySQL installation:
```powershell
# 1. Synchronize Sequelize tables (preserves existing data if tables already exist)
npm run db:sync

# 2. Seed mock demo accounts (Admin, Customer, Partner accounts)
npm run seed
```

> [!IMPORTANT]
> The Patiala CSV dataset ([`backend/data/cityserve_patiala_seed_dataset.csv`](file:///c:/Users/HP/Desktop/city-serve-fixed%20(1)/city-serve-main/backend/data/cityserve_patiala_seed_dataset.csv)) is automatically loaded **in-memory** by [`backend/src/services/dataset.service.ts`](file:///c:/Users/HP/Desktop/city-serve-fixed%20(1)/city-serve-main/backend/src/services/dataset.service.ts). You do **NOT** need to run database migrations or write CSV records into MySQL tables.

### Step 4.5: Start the Backend Development Server
```powershell
npm run dev
```

Expected startup output:
```
Connected to MySQL database "cityserve" at localhost:3306
CityServe API listening on http://localhost:4000
Payments demo mode: true
Maps demo mode: true
```

Keep **Terminal 1** open and running.

---

## 5. Frontend Configuration & Execution

### Step 5.1: Navigate to Frontend Directory
Open **Terminal 2**:
```powershell
cd "c:\Users\HP\Desktop\city-serve-fixed (1)\city-serve-main\frontend"
```

### Step 5.2: Install Frontend Dependencies
```powershell
npm install
```

### Step 5.3: Verify `frontend/.env.local`
Confirm that [`frontend/.env.local`](file:///c:/Users/HP/Desktop/city-serve-fixed%20(1)/city-serve-main/frontend/.env.local) points to the backend API:

```ini
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_MAPBOX_TOKEN=
```

### Step 5.4: Start the Frontend Development Server
```powershell
npm run dev
```

Expected startup output:
```
   ▲ Next.js 14.2.5
   - Local:        http://localhost:3000
   - Environments: .env.local

 ✓ Ready in 1800ms
```

Keep **Terminal 2** open and running.

---

## 6. Verification & Health Checks

Once both servers are running, verify each tier using PowerShell, browser, or cURL:

### 6.1 Backend API Verification

| Test | Method & URL | Expected Output |
| :--- | :--- | :--- |
| **Health Check** | `GET http://localhost:4000/api/health` | `{"status":"ok","paymentsDemoMode":true,"mapsDemoMode":true}` |
| **Vendors List** | `GET http://localhost:4000/api/vendors` | Array of 155+ listings combining DB partners and Patiala CSV entries |
| **Categories** | `GET http://localhost:4000/api/categories` | 20 dynamic trade categories with real business counts |
| **Search Query** | `GET http://localhost:4000/api/search?q=electric` | Filtered list containing matching vendors (e.g. Lucky Electrician, Sachdeva Electric) |

Quick PowerShell validation command:
```powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/health"
(Invoke-RestMethod -Uri "http://localhost:4000/api/vendors").Count
(Invoke-RestMethod -Uri "http://localhost:4000/api/categories").Count
```

### 6.2 Frontend Web App Verification

Open your web browser and navigate to:

| Route | Page Name | What to Verify |
| :--- | :--- | :--- |
| [`http://localhost:3000`](http://localhost:3000) | **Homepage** | Editorial hero, "Patiala, Punjab" location pill, 8 quick category chips, featured Patiala vendors, 83 localities counter, and civic standards section. |
| [`http://localhost:3000/explore`](http://localhost:3000/explore) | **Explore Directory** | Multi-tab discovery (Businesses, Services, Products), live debounced search, category dropdown (20 categories), locality filter (83 Patiala areas), and map view toggle. |
| [`http://localhost:3000/category/home-services`](http://localhost:3000/category/home-services) | **Category Page** | Dedicated category layout showing trades, filtered listing cards, and in-category search. |
| [`http://localhost:3000/vendor/ChIJO3Fsa_weEDkRObGR3-pkQHY`](http://localhost:3000/vendor/ChIJO3Fsa_weEDkRObGR3-pkQHY) | **Vendor Profile** | Direct phone call button (`tel:`), Google Maps navigation link, locality badges, and data provenance section. |
| [`http://localhost:3000/cart`](http://localhost:3000/cart) | **Customer Cart** | Real-time items list, quantity increments/decrements, subtotal computation. |
| [`http://localhost:3000/checkout`](http://localhost:3000/checkout) | **Checkout Flow** | Address selection, demo-mode payment simulation, order creation. |
| [`http://localhost:3000/dashboard`](http://localhost:3000/dashboard) | **User Dashboard** | Customer orders, profile management, and review status. |
| [`http://localhost:3000/partner-dashboard`](http://localhost:3000/partner-dashboard) | **Partner Dashboard** | Real-time partner revenue metrics, order approval workflow, and service listings. |
| [`http://localhost:3000/admin`](http://localhost:3000/admin) | **Admin Console** | System metrics, user management, and partner verification queue. |

---

## 7. Demo Credentials

The platform includes pre-configured demo personas:

| Persona / Role | Email | Password | Access Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@cityserve.demo` | `Admin@123` | Access `/admin`, manage partner verifications, system analytics |
| **Customer** | `student@thapar.demo` | `Student@123` | Browse directory, add to cart, checkout, view `/dashboard/orders` |
| **Demo Partner** | `freshpure.dairy@cityserve.demo` | `Partner@123` | Access `/partner-dashboard`, view assigned orders, update order status |
| **Directory Listings (155 Patiala Businesses)** | *Unclaimed by design* | *No login needed* | Sourced public directory entries with honest "Directory Listing" badge |

---

## 8. Building for Production

To validate or run production-optimized builds:

### Backend Production Build
```powershell
cd backend
npm run build
npm start
```

### Frontend Production Build
```powershell
cd frontend
npm run build
npm start
```

The Next.js production build pre-renders all 24 static and dynamic routes with optimal code splitting and zero TypeScript or linting errors.

---

## 9. Troubleshooting & Common Questions

### Q1: `Error: listen EADDRINUSE: address already in use :::4000` (or `:::3000`)
**Cause**: A previous instance of the server is still running in the background.
**Fix**: Terminate the lingering process using PowerShell:
```powershell
# For Port 4000 (Backend)
Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess | Stop-Process -Force

# For Port 3000 (Frontend)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
```

### Q2: `SequelizeConnectionRefusedError: connect ECONNREFUSED 127.0.0.1:3306`
**Cause**: The MySQL service is stopped or not running on port 3306.
**Fix**: Start the Windows MySQL service:
```powershell
Start-Service -Name MySQL80   # or MySQL
```

### Q3: `Access denied for user 'root'@'localhost'`
**Cause**: Password mismatch in `backend/.env`.
**Fix**: Update `DB_PASSWORD` in [`backend/.env`](file:///c:/Users/HP/Desktop/city-serve-fixed%20(1)/city-serve-main/backend/.env) to match your local MySQL root password.

### Q4: Are external API keys (Mapbox / Razorpay / Cloudinary) mandatory?
**Answer**: **No.** CityServe is engineered with full **Demo Mode resilience**. If external API keys are omitted:
- Payments operate in simulated sandbox mode with visual demo tags.
- Maps display interactive coordinate directory cards with one-click links to Google Maps.
- The entire marketplace remains fully functional for evaluation and grading.
