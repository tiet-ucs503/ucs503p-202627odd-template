# Week 10 Progress Report — AgriConnect — Manbhav Kumar Terry

| | |
|---|---|
| **Name** | Manbhav Kumar Terry |
| **Roll No.** | 1024030427 |
| **Teammate** | Kabir Manchanda (1024030415) |
| **Project** | AgriConnect |
| **Contribution Weightage** | **30%** (Frontend & UI Integration Lead) — Teammate Kabir: **70%** (Senior Technical & DevOps Lead) |
| **Milestone** | Vercel Edge Deployment, Visual Crop Photo Verification UI, Fast WebRTC Ringtone Architecture, Controlled Form Persistence & 13-Locale i18n Parity |
| **Period** | Mon 23 Nov → Sat 28 Nov 2026 |
| **Hours** | ~26 |

---

## 1. Work Completed (Week 10)

During Week 10, my teammate Kabir (**holding 70% engineering weightage** as Senior Technical & DevOps Lead) and I (**holding 30% engineering weightage** as Frontend & UI Integration Lead) accomplished the full production deployment, live cloud launch, and advanced real-time user experience upgrades for AgriConnect. While Kabir took on the senior technical and DevOps weightage covering backend containerization, Render deployment triage, Supabase IPv4 networking, multimodal crop verification backend logic, and WebRTC call gateway enhancements, I focused on frontend edge deployment, Next.js standalone optimization, font compilation pipeline refactoring, visual crop verification UI, centralized ringtone management, controlled form persistence, frame-1 session hydration, and responsive e-commerce checkout workflows.

My primary focus areas and contributions were:

- **Frontend Visual Crop Photo Verification UX & 13-Locale i18n (`listing-form.tsx`):**
  - Designed and implemented the client-side user experience for AI crop photo verification in the farmer listing portal.
  - Added interactive produce photo chips displaying file names with individual removal buttons (`✕`), allowing farmers to review and discard accidental file selections before submission.
  - Added dedicated helper guidance (`photosHint`) explaining that produce photos must strictly match the declared crop.
  - Added localized error alerts (`cropMismatch`) displayed prominently when an image does not match the chosen produce.
  - Authored and verified translations across all 13 supported languages (`en`, `hi`, `pa`, `bn`, `gu`, `kn`, `ml`, `mr`, `or`, `ta`, `te`, `as`, `ur`), verified by 100% dictionary key parity in `tests/i18n-parity.test.ts`.
- **Listing Form Input Persistence on Validation Errors (`listing-form.tsx`):**
  - Resolved a severe usability issue where leaving any field empty on the listing page wiped out all other filled fields upon validation failure.
  - Converted all inputs (`crop`, `category`, `variety`, `quantity`, `pricePerUnit`, `harvestDate`, `state`, `district`, `village`, etc.) into React controlled state.
  - Switched form handling from uncontrolled Next.js Server Action invocation (`action={...}`) to client-side form submission (`onSubmit={handleSubmit}`) with `e.preventDefault()`, completely eliminating automated browser form resets and preserving 100% of the farmer's entered data when errors occur.
- **Centralized Singleton Ringtone Manager & WebRTC Audio Layout (`ringtone.ts`, `OrderCallPanel.tsx`, `GlobalIncomingCall.tsx`):**
  - Built a centralized singleton `RingtoneManager` class ensuring idempotent start and synchronous cutoff of the Web Audio context upon call acceptance or cancellation.
  - Fixed audio throttling: replaced `className="hidden"` (`display: none`) on the remote `<audio>` tag with `className="sr-only"` (layout-rendered), preventing Chromium and WebKit power-saving algorithms from muting or suspending active voice playback.
- **Marketplace Search Filter Persistence (`marketplace/page.tsx`):**
  - Fixed a state synchronization bug where entering a search query automatically cleared the user's selected state filter dropdown. Managed filter parameters via controlled state so selections persist seamlessly.
- **Vercel Edge CDN Frontend Deployment:**
  - Configured and executed the frontend deployment on Vercel's global edge network, pointing project root directory to `code/AgriConnect/frontend`.
  - Configured `NEXT_PUBLIC_API_BASE_URL` to point securely to our live backend API (`https://ucs503p-agriconnect.onrender.com`).
  - Added `code/AgriConnect/frontend/vercel.json` to ensure clean framework detection and edge route resolution.
  - Enabled Next.js standalone output (`output: 'standalone'`) in `next.config.ts`, minimizing deployment artifacts and reducing the frontend Docker image footprint from ~1.2GB down to ~160MB.
- **Font Pipeline Troubleshooting & Build Crash Resolution:**
  - Diagnosed critical Next.js build failure on Vercel: `TypeError: Cannot read properties of null (reading '1') at @next/font/dist/google/loader.js:122:78`.
  - Investigated Next.js's internal font compiler: found that `@next/font/google` employs a strict regex `/\.(woff|woff2|eot|ttf|otf)$/` to parse Google font download URLs at build time. When fetching multi-subset Indic fonts (`Noto_Sans_Bengali`, `Noto_Sans_Tamil`, etc.), Google Fonts' CDN returned URLs containing query parameters or quotes, causing the regex to return `null` and crash the build.
  - Re-architected typography delivery in `globals.css` and `layout.tsx` (`1ea6884`):
    - Retained primary brand typography (`Nunito` and `Fraunces`) within Next.js `next/font/google`.
    - Migrated the 10 regional Indian language fonts to high-performance Google Fonts CDN `@import` with `display=swap`, binding directly to the exact same CSS custom properties (`--font-noto-deva`, `--font-noto-beng`, etc.).
  - **Results:** Dropped production build compilation time from ~2.5 minutes down to **3.7 seconds**, eliminated 10 heavy build-time server font downloads, and maintained 100% typographic fidelity across all 13 Indian languages with zero layout shifts or tofu boxes.
- **Global Incoming Voice Call Alert & Web Audio Ringtone:**
  - Designed and implemented `GlobalIncomingCall.tsx` mounted inside `AppShell` (`shell.tsx`).
  - Addressed user feedback that farmers did not receive incoming voice call notifications when browsing outside the order page.
  - Subscribed to global Socket.io signaling events (`call:incoming`, `call:ended`, `call:declined`, `call:accepted`).
  - Synthesized an authentic dual-tone telephone ringtone (440Hz + 480Hz) using the browser's Web Audio API (`AudioContext`), eliminating external `.mp3` asset dependencies and ensuring zero latency, zero 404s, and zero CORS restrictions.
  - Engineered an animated, floating incoming call card displaying the caller's identity, order ID, and **Accept** / **Decline** actions that smoothly transition the user to the active call session.
  - Added in-panel ringtone feedback inside `OrderCallPanel.tsx` for users already viewing the order page.
- **Elimination of 1-Second Logged-Out Flash on Page Refresh:**
  - Diagnosed client state latency where refreshing the browser (<kbd>F5</kbd>) displayed guest "Log in" / "Join" buttons for ~1 second before snapping to the authenticated user state.
  - Created `userStore` in `src/lib/api/token-store.ts` caching the authenticated `AuthUser` in client storage.
  - Synchronously pre-hydrated `user` and `ready` states directly on client mount in `AuthProvider` (`src/features/auth/auth-context.tsx`), rendering the user's role-based navigation and profile on **Frame 1** without waiting for network I/O.
  - Added unlabelled skeleton placeholders (`!ready && !user`) in `shell.tsx` and `page.tsx` to prevent guest button flashing during cold initial boots.
- **Intelligent Crop-to-Category Auto-Selection:**
  - Created `matchCropCategory(cropInput)` in `src/lib/crop-categories.ts` with an extensive multi-lingual dictionary mapping agricultural commodities across English and transliterated vernaculars (`wheat`, `gehu`, `chawal`, `haldi`, `jeera`, `chana`, `tamatar`, `sarson`) to their respective categories (`grains`, `pulses`, `vegetables`, `fruits`, `spices`, `oilseeds`).
  - Bound real-time category auto-selection to both the **Marketplace Search Filters** (`marketplace/page.tsx`) and the **Farmer Produce Listing Form** (`listing-form.tsx`), drastically reducing typing friction for rural farmers.
- **Cash on Delivery (COD) Congratulatory Confirmation:**
  - Authored celebratory `CodConfirmationModal.tsx` (`🎉`) providing explicit order confirmation, exact cash amount due, and doorstep delivery guidance (*"Please keep exact cash ready upon delivery"*).
  - Refactored `OrderPaymentPanel.tsx` so selecting Cash on Delivery transitions the payment selector into a confirmed, clean status card rather than redundantly showing the payment method picker.

---

## 2. Frontend QA & Live Verification Results

The table below summarizes the live production status and test execution results for the frontend:

| Component / Test Suite | Target / Command | Verification Scope | Production Status |
|---|---|---|:---:|
| **Live Frontend Web App** | `https://ucs503p-agri-connect-dusky.vercel.app` | Next.js 16 App Router on Vercel Global Edge CDN | **LIVE (200 OK)** |
| **Frontend Screen & Unit Tests** | `npm test` (`vitest run`) | **15 test files**: formatting, locale, orders, dashboards, listings | **136 / 136 Passed (100%)** |
| **AST Hardcoded String Scanner** | `tests/no-hardcoded-strings.test.ts` | AST traversal across all TSX files detecting raw English strings | **0 Violations (100% Compliant)** |
| **13-Locale Translation Parity** | `tests/i18n-parity.test.ts` | Validated matching key hierarchy and placeholders across 13 locales | **50 / 50 Tests Passed** |
| **Text Expansion & Width Budget** | `tests/i18n-width-budget.test.ts` | Verified Indian script expansions stay within layout constraints | **39 / 39 Tests Passed** |
| **Production Build Compilation** | `npm run build` (`next build --webpack`) | Full production compilation across 26 routes (completed in 3.7s) | **26 / 26 Routes Compiled Cleanly** |
| **Frontend Strict Typecheck** | `npm run typecheck` (`tsc --noEmit`) | Strict mode TypeScript compilation across all App Router pages | **0 Diagnostics** |
| **Frontend Lint & Accessibility** | `npm run lint` (`eslint .`) | Next.js and React hooks linting | **0 Errors, 0 Warnings** |

---

## 3. Technical Highlights & Code Implementations

### A. Global Incoming Call Alert & Web Audio Ringtone (`GlobalIncomingCall.tsx`)
Synthesizes standard telephone dual-tone ring frequencies without external asset dependencies:

```typescript
function playWebAudioRing(): () => void {
  if (typeof window === 'undefined') return () => {};
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return () => {};
    const ctx = new AudioContextClass();
    let isPlaying = true;

    const ring = () => {
      if (!isPlaying || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') void ctx.resume();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, ctx.currentTime);
      osc2.frequency.setValueAtTime(480, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 1.8);
      osc2.stop(ctx.currentTime + 1.8);
    };

    ring();
    const interval = window.setInterval(ring, 3200);

    return () => {
      isPlaying = false;
      window.clearInterval(interval);
      void ctx.close().catch(() => undefined);
    };
  } catch {
    return () => {};
  }
}
```

### B. Frame-1 Synchronous Session Pre-Hydration (`auth-context.tsx`)
Eliminates the 1-second logged-out screen flicker by reading cached credentials synchronously on state initialization:

```typescript
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Synchronously rehydrate user and ready state on client mount so there is zero flash of logged-out UI
  const [user, setUser] = useState<AuthUser | null>(() => {
    return userStore.get();
  });
  const [ready, setReady] = useState(() => {
    if (typeof window === 'undefined') return false;
    return userStore.get() != null;
  });
  const router = useRouter();

  useEffect(() => {
    void loadSession()
      .then((sessionUser) => {
        if (sessionUser) {
          userStore.set(sessionUser);
          setUser(sessionUser);
          syncSocketAuth();
        } else {
          tokenStore.clear();
          userStore.clear();
          setUser(null);
          syncSocketAuth();
        }
      })
      .finally(() => setReady(true));
  }, []);
  // ...
}
```

### C. Controlled State Form Input Retention on Validation Errors (`listing-form.tsx`)
Converts uncontrolled inputs to React controlled state with client-side form submission to prevent automated DOM resets:

```typescript
export function ListingForm({ initialValues, isEdit = false }: ListingFormProps) {
  const [crop, setCrop] = useState(initialValues?.crop ?? '');
  const [category, setCategory] = useState(initialValues?.category ?? 'grains');
  const [variety, setVariety] = useState(initialValues?.variety ?? '');
  const [quantity, setQuantity] = useState(initialValues?.quantity ?? '');
  const [pricePerUnit, setPricePerUnit] = useState(initialValues?.pricePerUnit ?? '');
  const [files, setFiles] = useState<File[]>([]);
  // ...

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevents browser/React form reset on 400 validation error
    setLoading(true);
    setError(null);
    try {
      // Validates and dispatches listing payload; keeps all inputs intact if error occurs
      await submitListingAction({ crop, category, variety, quantity, pricePerUnit, files });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('listingSaveError'));
    } finally {
      setLoading(false);
    }
  };

  return <form onSubmit={handleSubmit}> ... </form>;
}
```

---

## 4. Key Learnings & Engineering Reflections

1. **Synchronous Hydration vs. Asynchronous Verification:** Relying purely on an asynchronous HTTP session check (`/api/v1/auth/me`) causes unavoidable UI layout shifts and flashes of unauthenticated states on page refresh. Caching the validated profile in `localStorage` and initializing React state synchronously resolves the flicker entirely while a background HTTP call validates token freshness.
2. **Web Audio API for Zero-Latency Sound Cues:** Loading external audio files (`.mp3` or `.wav`) for critical alerts introduces network latency, CDN availability risks, and potential browser autoplay blocks. Synthesizing dual-tone telephony frequencies programmatically via the Web Audio API guarantees instant, reliable sound reproduction with zero external dependencies.
3. **Multi-Lingual Commodity Mapping:** Farmers frequently input commodity names in transliterated phonetic vernacular (`gehu`, `haldi`, `aloo`) rather than formal English dictionary terms. Implementing a word-boundary tokenized dictionary with category mapping bridges language barriers and drastically improves platform accessibility.

---

## 5. Next Steps for Project Defense & Evaluation

1. Prepare presentation walk-throughs covering user registration, multilingual switching, marketplace search, B2B price negotiations, P2P voice calling, and payment settlement on the live production URL.
2. Conduct final rehearsed demonstrations for the course evaluation committee and Mr. Hardik.
