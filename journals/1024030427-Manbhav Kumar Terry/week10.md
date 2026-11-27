# Week 10 Progress Report — AgriConnect — Manbhav Kumar Terry

| | |
|---|---|
| **Name** | Manbhav Kumar Terry |
| **Roll No.** | 1024030427 |
| **Teammate** | Kabir Manchanda (1024030415) |
| **Project** | AgriConnect |
| **Milestone** | Vercel Edge Frontend Deployment, Next.js Standalone Optimization, Font Pipeline Refactoring & Cross-Origin Integration |
| **Period** | Mon 23 Nov → Fri 27 Nov 2026 |
| **Hours** | ~16 |

---

## 1. Work Completed (Week 10)

During Week 10, my teammate Kabir and I accomplished the full production deployment and live cloud launch of AgriConnect. While Kabir took on the senior technical and DevOps weightage (~70%) covering multi-stage backend containerization, Render deployment triage, and Supabase IPv4 database networking, I focused on frontend edge deployment, Next.js standalone container optimization, font compilation pipeline refactoring, and live cross-origin integration.

My primary focus areas and contributions were:

- **Vercel Edge CDN Frontend Deployment:**
  - Configured and executed the frontend deployment on Vercel's global edge network, pointing project root directory to `code/AgriConnect/frontend`.
  - Configured `NEXT_PUBLIC_API_BASE_URL` to point securely to our live backend API (`https://ucs503p-agriconnect.onrender.com`).
  - Added `code/AgriConnect/frontend/vercel.json` to ensure clean framework detection and edge route resolution.
  - Enabled Next.js standalone output (`output: 'standalone'`) in `next.config.ts`, minimizing deployment artifacts and reducing the frontend Docker image footprint from ~1.2GB down to ~160MB.
- **Font Pipeline Troubleshooting & Build Crash Resolution:**
  - Diagnosed critical Next.js build failure on Vercel: `TypeError: Cannot read properties of null (reading '1') at @next/font/dist/google/loader.js:122:78`.
  - Investigated Next.js's internal font compiler: found that `@next/font/google` employs a strict regex `/\.(woff|woff2|eot|ttf|otf)$/` to parse Google font download URLs at build time. When fetching multi-subset Indic fonts (`Noto_Sans_Bengali`, `Noto_Sans_Tamil`, `Noto_Nastaliq_Urdu`, etc.), Google Fonts' CDN returned URLs containing query parameters or quotes, causing the regex to return `null` and crash the build.
  - Re-architected typography delivery in `code/AgriConnect/frontend/src/app/globals.css` and `code/AgriConnect/frontend/src/app/layout.tsx` (`1ea6884`):
    - Retained primary brand typography (`Nunito` and `Fraunces`) within Next.js `next/font/google`.
    - Migrated the 10 regional Indian language fonts to high-performance Google Fonts CDN `@import` with `display=swap`, binding directly to the exact same CSS custom properties (`--font-noto-deva`, `--font-noto-beng`, etc.).
  - **Results:** Dropped production build compilation time from ~2.5 minutes down to **3.7 seconds**, eliminated 10 heavy build-time server font downloads, and maintained 100% typographic fidelity across all 13 Indian languages with zero layout shifts or tofu boxes.
- **Production Cross-Origin (CORS) Integration & Verification:**
  - Coordinated with Kabir to configure cross-origin resource sharing headers in the Render backend environment (`CLIENT_URL` and `CORS_ORIGINS`).
  - Verified live CORS preflight handshakes (`OPTIONS /api/v1/listings`) returning `HTTP 204 No Content` with `access-control-allow-origin: https://ucs503p-agri-connect-dusky.vercel.app` and `access-control-allow-credentials: true`.
  - Tested live end-to-end authentication on the live site: verified login flows for farmer and buyer personas, issuing signed JWT access tokens and secure `HttpOnly` refresh token cookies (`SameSite=Strict`).
- **Comprehensive Quality Assurance & Readme Documentation:**
  - Executed frontend Vitest suite: **14 test files / 128 tests passing (100%)**.
  - Verified zero AST hardcoded string violations (`tests/no-hardcoded-strings.test.ts`).
  - Verified 13-locale translation parity (`tests/i18n-parity.test.ts`) and width budget preservation (`tests/i18n-width-budget.test.ts`).
  - Updated the project `README.md` (`c2ce627`) with live production badges, direct links to the Vercel web app, Render API probes, and demo test credentials.

---

## 2. Frontend QA & Live Verification Results

The table below summarizes the live production status and test execution results for the frontend:

| Component / Test Suite | Target / Command | Verification Scope | Production Status |
|---|---|---|:---:|
| **Live Frontend Web App** | `https://ucs503p-agri-connect-dusky.vercel.app` | Next.js 16 App Router on Vercel Global Edge CDN | **LIVE (200 OK)** |
| **Frontend Screen & Unit Tests** | `npm test` (`vitest run`) | 14 test files: formatting, locale, orders, role dashboards, listings | **128 / 128 Passed (100%)** |
| **AST Hardcoded String Scanner** | `tests/no-hardcoded-strings.test.ts` | AST traversal across all TSX files detecting raw English strings | **0 Violations (100% Compliant)** |
| **13-Locale Translation Parity** | `tests/i18n-parity.test.ts` | Validated matching key hierarchy and placeholders across 13 locales | **50 / 50 Tests Passed** |
| **Text Expansion & Width Budget** | `tests/i18n-width-budget.test.ts` | Verified Indian script expansions stay within layout constraints | **39 / 39 Tests Passed** |
| **Production Build Compilation** | `npm run build` (`next build --webpack`) | Full production compilation across 26 routes (completed in 3.7s) | **26 / 26 Routes Compiled Cleanly** |
| **Frontend Strict Typecheck** | `npm run typecheck` (`tsc --noEmit`) | Strict mode TypeScript compilation across all App Router pages | **0 Errors** |
| **Frontend Lint & Accessibility** | `npm run lint` (`eslint .`) | Next.js and React hooks linting | **0 Errors, 0 Warnings** |

---

## 3. Technical Highlights & Code Implementations

### A. Streamlined Regional Typography Pipeline (`globals.css`)
Migrated regional Indian font faces to Google Fonts CDN `@import` while preserving identical CSS custom property variables:

```css
@import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;600;700&family=Noto+Sans+Bengali:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;600;700&family=Noto+Sans+Gujarati:wght@400;600;700&family=Noto+Sans+Gurmukhi:wght@400;600;700&family=Noto+Sans+Kannada:wght@400;600;700&family=Noto+Sans+Malayalam:wght@400;600;700&family=Noto+Sans+Oriya:wght@400;600;700&family=Noto+Sans+Tamil:wght@400;600;700&family=Noto+Sans+Telugu:wght@400;600;700&display=swap');
@import "tailwindcss";

:root {
  --field: #f6f8f5;
  --paper: #ffffff;
  --forest: #0c2d1c;
  --leaf: #15803d;
  --harvest: #d97706;
  --soil: #475569;
  --ink: #0f172a;
  --clay: #dc2626;
  --font-noto-deva: 'Noto Sans Devanagari';
  --font-noto-gur: 'Noto Sans Gurmukhi';
  --font-noto-beng: 'Noto Sans Bengali';
  --font-noto-taml: 'Noto Sans Tamil';
  --font-noto-telu: 'Noto Sans Telugu';
  --font-noto-gujr: 'Noto Sans Gujarati';
  --font-noto-knda: 'Noto Sans Kannada';
  --font-noto-mlym: 'Noto Sans Malayalam';
  --font-noto-orya: 'Noto Sans Oriya';
  --font-noto-urdu: 'Noto Nastaliq Urdu';
}
```

### B. Next.js Standalone Runner Output (`next.config.ts`)
Enabled lightweight Docker containerization:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
```

---

## 4. Key Learnings & Engineering Reflections

1. **Build-Time vs. Client-Time Asset Optimization:** While `next/font/google` is convenient for standard Latin fonts, downloading 10 complex multi-weight Indic font families during server-side build steps introduces severe vulnerability to upstream CDN formatting shifts and bloats build times. Offloading non-critical regional script faces to CDN `@import` with `display=swap` drastically accelerated build pipelines while maintaining visual parity.
2. **Cross-Origin Security & State Alignment:** Ensuring that the frontend on Vercel communicates securely with the backend on Render required meticulous alignment of CORS origins, credentials policies, and cookie domains to guarantee that `HttpOnly` refresh tokens persist across sessions without security compromise.
3. **Multi-Platform Integration:** Deploying a micro-architecture where static and edge compute reside on Vercel while persistent WebSocket connections and background jobs reside on Render demonstrated the value of matching specialized workloads to their optimal cloud infrastructure.

---

## 5. Next Steps for Project Defense & Evaluation

1. Prepare presentation walk-throughs covering user registration, multilingual switching, marketplace search, B2B price negotiations, and payment settlement on the live production URL.
2. Conduct final rehearsed demonstrations for the course evaluation committee and Mr. Hardik.
