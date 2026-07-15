# TestSprite AI Testing Report (MCP) — Mahalak (محلّك)

---

## 1️⃣ Document Metadata
- **Project:** Mahalak — Arabic RTL e-commerce marketplace, Cash on Delivery (COD)
- **Date:** 2026-07-15
- **Test type:** frontend / codebase · **Endpoint:** http://localhost:3000 (Next.js **dev** server) · **Runner:** TestSprite MCP (driven via JSON-RPC), tunnel to localhost
- **Runs:** #1 phone-OTP plan (8 tests) · #2 corrected email/password plan + real assertions (7 tests)

> **Bottom line:** Neither run *genuinely* validated the end-to-end journeys. TestSprite's
> green "Passed" verdicts are **not trustworthy here** — its generator repeatedly fell back to a
> trivial `assert current_url` (passes on any loaded page). Run #2 (with real assertions demanded)
> exposed the truth: the automated browser **could not complete login**, so every authenticated
> journey is unproven. The most concrete signal is a **blocking runtime error on `/auth`**
> ("Unexpected end of JSON input") — likely a tunnel/dev-mode artifact, to be confirmed in a real browser.

---

## 2️⃣ Requirement Validation Summary

### Run #2 (corrected: email/password login `cveeez1@OUTLOOK.COM`, meaningful assertions required)

| ID | Journey | TestSprite verdict | Real outcome | Evidence |
|----|---------|:---:|:---:|----------|
| TC001 | Customer login (email/pw) | ✅ Passed | ⚠️ Not proven | Only `assert current_url` (trivial); no real logged-in assertion |
| TC002 | Browse + open product | ⛔ **BLOCKED** | ⛔ Blocked | Next.js overlay **"Unexpected end of JSON input"** on `/auth` blocked the login form and all UI |
| TC003 | Add to cart → checkout → driver → COD | ✅ Passed | ⚠️ Not proven | Trivial `assert current_url` only |
| TC004 | Order appears in /account | ✅ Passed | ⚠️ Not proven | `/account` is gated (307 → /auth) without a session; trivial assert |
| TC005 | Seller login → dashboard | ❌ **Failed** | ❌ Failed | Never reached `/seller/dashboard` (login/session not established) |
| TC006 | Seller adds product | ✅ Passed | ⚠️ Not proven | Trivial `assert current_url` only |
| TC007 | Product in seller list | ❌ **Failed** | ❌ Failed | `/seller/products` gated (307 → /auth); product not verified |

**TestSprite headline:** 57% passed (4/7). **Reality:** 0/7 journeys proven; 1 blocked, 2 hard-failed, 4 false-passes.

### Run #1 (original phone-OTP plan) — for the record
All 8 reported ✅ but every test had only `assert current_url`. The automation stalled at login because
**the app has no phone-OTP login** (see Root Cause #1). Effective result: 0/8 proven.

---

## 3️⃣ Coverage & Matching Metrics

| Metric | Run #1 | Run #2 |
|--------|:---:|:---:|
| Reported pass rate | 100% (8/8) | 57% (4/7) |
| Journeys actually proven | 0 | 0 |
| Tests with a meaningful assertion | 0 | 1 (TC002 → `assert False` when blocked) |
| Blocked / hard-failed | 0 | 3 (TC002 blocked, TC005/TC007 failed) |

| Requirement group | Tests | Proven pass | Blocked/Failed | False-pass |
|---|:---:|:---:|:---:|:---:|
| Auth (login) | TC001 | 0 | 0 | 1 |
| Customer shopping (browse/cart/COD/account) | TC002–004 | 0 | 1 | 2 |
| Seller (dashboard/add/list) | TC005–007 | 0 | 2 | 1 |

---

## 4️⃣ Key Gaps / Risks

### Root Cause #1 — Test brief mismatch: login is **email + password**, not phone-OTP
- `lib/auth-context.tsx` → `signInWithEmailAndPassword`. There is **no phone-OTP login path**; phone OTP (`RecaptchaVerifier`/`signInWithPhoneNumber` in `lib/firebase/client.ts`) is only for registration/reset **verification** and needs reCAPTCHA (not automatable in a headless cloud browser).
- Fixed in run #2 by logging in with `cveeez1@OUTLOOK.COM` / `CV20259`.

### Root Cause #2 — `/auth` blocked by "Unexpected end of JSON input" (needs confirmation)
- Run #2 TC002 hit a Next.js **dev error overlay** on `/auth` that blocked the login form.
- **Investigation (leans toward environmental, not a static bug):**
  - `/auth` returns **HTTP 200** cleanly server-side; no error markers in the HTML.
  - No unguarded `JSON.parse` on `/auth`. The OTP session/rate-limit parses (`lib/firebase/client.ts`) and location parse (`lib/location/user-location.tsx`) are all `if (!raw) return` + try/catch → safe.
  - The login server actions `createSession` / `ensureUserProfile` (`lib/actions/auth-session.ts`) **catch errors and return serializable results** — they don't throw unserializable payloads.
  - **Both runs logged tunnel instability** (probe timeout 15 s, Yamux "unknown stream", `ETIMEDOUT 3.219.92.174:7400`, disconnects). A **truncated Server-Action/RSC response over the tunnel** produces exactly "Unexpected end of JSON input".
- **Action:** Open `http://localhost:3000/auth` in a real browser, DevTools console open, and log in with `cveeez1`. If the error reproduces for a real user → real bug (inspect the login → `createSession` server-action roundtrip and Firebase Admin env). If it does not → it was a TestSprite tunnel/dev artifact.

### Root Cause #3 — Server-side auth gate means tests MUST fully log in first
- `middleware.ts` gates `/seller/*` and `/account/*` on the **`__session` cookie** (307 → `/auth` otherwise). This is a correct defense-in-depth guard; login sets `__session` via the `createSession` server action and waits for it.
- Consequence: any login hiccup cascades — `/account` (TC004) and `/seller/*` (TC005/TC007) all redirect to `/auth`. This is *why* the seller tests failed, not a bug in those pages.

### Root Cause #4 — TestSprite marks trivial `assert current_url` as PASSED (process risk)
- When the agent can't reach the target state it emits a URL-only assertion and still reports **Passed**. **Do not trust the green summary.** Treat only BLOCKED/FAILED (and tests with real assertions) as signal.

### Environment risk — dev server + tunnel
- Run against a **production build** (`npm run build && npm run start`): no dev error overlay, more stable, and the test cap rises from 15 (dev) to 30.

---

### Recommended next steps
1. **Confirm the `/auth` error in a normal browser** (real bug vs tunnel artifact) — highest priority.
2. **Re-run TestSprite in production mode** for stability and to remove the dev overlay.
3. Keep **email/password login** + **meaningful assertions** (already in the run #2 plan).
4. For registration/OTP journeys, set Firebase **E.164 test numbers** (`+20…`) with reCAPTCHA test bypass, or seed an already-verified account.
5. Treat TestSprite "Passed" as provisional until a non-trivial assertion backs it.
