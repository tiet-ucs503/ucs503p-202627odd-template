# Week 8–9 Progress Report — AgriConnect — Manbhav Kumar Terry

| | |
|---|---|
| **Name** | Manbhav Kumar Terry |
| **Roll No.** | 1024030427 |
| **Teammate** | Kabir Manchanda (1024030415) |
| **Project** | AgriConnect |
| **Milestone** | Dedicated Bids Desks, UI Resilience, TypeScript Refinement & Frontend QA Verification |
| **Period** | Mon 3 Nov → Fri 20 Nov 2026 |
| **Hours** | ~18 |

---

## 1. Work Completed (Week 8–9)

During Week 8–9, my teammate Kabir and I completed the final stabilization and comprehensive testing audit of AgriConnect. While Kabir took on the majority technical and QA lead weightage (~70%) covering cloud database infrastructure migration, transaction timeout hardening, and the backend/security smoke test suites, I focused on frontend UX improvements, component error decoupling, TypeScript strict typing refinements, and frontend test suite execution.

My primary focus areas and contributions were:

- **Dedicated Role-Specific Bids Desks:**
  - Built dedicated standalone routing and desk pages for both user roles:
    - **Buyer Bids Desk (`/buyer/bids`):** Full-screen workspace with multi-tab status filtering (`All`, `Action Needed / Countered`, `Under Review`, `Accepted`, `Closed`).
    - **Farmer Incoming Bids Desk (`/farmer/bids`):** Unified incoming offers desk allowing farmers to review, counter, or accept bids across all their crop lots in one centralized screen.
  - Added quick-navigation entry pills on both the `/buyer` and `/farmer` home dashboards.
- **Frontend Component Resilience & Error Decoupling:**
  - Identified and fixed a critical UX flaw in `BuyerBidsList.tsx` and `FarmerBidsList.tsx`: previously, a failed action (e.g., network glitch during a counter or withdrawal) caused the component to unmount the entire list of bids and display only an error box.
  - Decoupled `loadError` (initial data fetch) from `actionError` (transient action failures). Added an inline, dismissable alert banner at the top of the list so that active bid cards remain mounted and visible.
  - Added granular per-bid busy indicators (`actionPendingId`), disabling only the specific bid card undergoing a mutation rather than locking the entire interface.
- **TypeScript Strict Mode & Accessibility Refinements:**
  - Fixed strict typing issues with `MessageKey` references in `BuyerBidsList.tsx` and `FarmerBidsList.tsx` by integrating standard `<Alert tone="warn">` and utilizing verified leaf keys (`weather.closeDetails`) for dismiss button ARIA labels.
  - Ensured all changes strictly satisfy the AST localization linter without introducing unlocalized hardcoded Latin strings.
- **Frontend Verification & Production Build Audit:**
  - Executed the frontend Vitest suite: **14 test files / 128 tests passing (100%)**.
  - Verified zero AST hardcoded string violations (`tests/no-hardcoded-strings.test.ts`).
  - Verified 13-locale translation parity (`tests/i18n-parity.test.ts`) and width budget preservation (`tests/i18n-width-budget.test.ts`).
  - Successfully executed `npm run build`: verified that all 26 App Router routes compile cleanly under Turbopack with zero SSR hydration errors.

---

## 2. Frontend QA Execution Results

| Test Suite / Engineering Check | Tools / Commands | Scope & Coverage | Empirical Result |
|---|---|---|:---:|
| **Frontend Screen & Unit Tests** | `npm test` (`vitest run`) | Formatting, Locale Provider, Orders, Order Detail, Role Dashboards, Notifications, Listings | **14 Files / 128 Tests Passed (100%)** |
| **AST Hardcoded String Scanner** | `tests/no-hardcoded-strings.test.ts` | AST traversal across all TSX files detecting raw English strings or untranslated attributes | **0 Violations (100% Compliant)** |
| **13-Locale Translation Parity** | `tests/i18n-parity.test.ts` | Validated matching key hierarchy and placeholders across English and 12 Indian languages | **50 / 50 Tests Passed** |
| **Text Expansion & Width Budget** | `tests/i18n-width-budget.test.ts` | Verified Indian script expansions stay within layout constraints | **39 / 39 Tests Passed** |
| **Frontend Strict Typecheck** | `npm run typecheck` (`tsc --noEmit`) | Strict mode TypeScript compilation across all App Router pages and features | **0 Errors** |
| **Frontend Lint & Accessibility** | `npm run lint` (`eslint .`) | Next.js and React hooks linting | **0 Errors, 0 Warnings** |
| **Production Build Compilation** | `npm run build` (`next build`) | Full Turbopack production compilation across 26 routes | **26 / 26 Routes Compiled Cleanly** |

---

## 3. Technical Highlights & Code Implementations

### A. Non-Destructive Error Decoupling (`BuyerBidsList.tsx`)
Separated fatal initial load errors from non-fatal user action errors:

```tsx
{/* Dismissable in-line action alert prevents unmounting the bids list */}
{actionError ? (
  <div className="flex items-center justify-between rounded-xl border border-harvest/40 bg-harvest/15 p-3 text-xs text-soil">
    <div className="flex items-center gap-2">
      <span aria-hidden="true">⚠️</span>
      <span>{actionError}</span>
    </div>
    <button
      type="button"
      onClick={() => setActionError('')}
      className="rounded p-1 font-bold text-soil/70 hover:text-soil"
      aria-label={t('weather.closeDetails')}
    >
      ✕
    </button>
  </div>
) : null}
```

### B. Dedicated Desk Navigation (`/buyer/bids/page.tsx`)
Implemented dedicated workspace for buyer negotiations:

```tsx
export default function BuyerBidsPage() {
  const { t } = useLocale();

  return (
    <RequireAuth role="BUYER">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div>
          <h1 className="font-display text-2xl font-black text-forest">
            {t('bid.buyerSectionTitle')}
          </h1>
          <p className="text-sm text-soil/70">
            {t('bid.buyerSectionSubtitle')}
          </p>
        </div>
        <BuyerBidsList />
      </div>
    </RequireAuth>
  );
}
```

---

## 4. Next Steps & Capstone Submission
1. Coordinate with Kabir for final system presentation rehearsal.
2. Verify live responsiveness across desktop and mobile screen resolutions.
3. Prepare demonstration walkthrough recording for faculty evaluation.
