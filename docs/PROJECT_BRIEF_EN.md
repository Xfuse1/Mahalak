# Mahalak (محلك) — Project Brief

> Paste this at the start of a new chat so the assistant understands the whole project — technical and non-technical. Last updated: 2026-06-23.

---

## 1. What it is (non-technical)
- **Mahalak** is a **local commerce platform for Egyptian neighborhoods** — a hyper-local marketplace connecting nearby **stores**, **buyers**, and **delivery drivers**.
- **Positioning / differentiator:** owns the gap between pure delivery apps, supply-chain digitization, and POS. The core defensive moat is **proximity** ("the store next to you"), Cash-on-Delivery trust, and serving small local merchants.
- **Language:** Arabic-first (RTL), with English fallback throughout (bilingual UI).
- **Sides of the marketplace:**
  - **Buyers** — browse nearby stores/products, order with Cash-on-Delivery (COD).
  - **Sellers / stores** — manage products, offers, orders, a debt ledger; require admin approval + KYC.
  - **Drivers** — accept multi-store orders, pick up per store, deliver with a proof-of-delivery code; have a cash/earnings wallet.
  - **Admin** — approve/reject stores, handle complaints/support.

---

## 2. Tech stack
- **Framework:** Next.js 16 (App Router, React Server Components, **webpack** build) + **React 19** + **TypeScript**.
- **Styling:** Tailwind CSS v4 + Radix UI / shadcn components. Design tokens in `oklch` (brand **Egyptian green** `--primary`, **gold** `--accent`, cream surfaces, blue confined to `--info`). Font: **Cairo** via `next/font`.
- **Backend:** **Firebase** — Firestore (database) + Firebase Admin SDK (server-side only) + session cookies (`__session`). **No client-side DB writes** (Firestore rules are deny-all for clients; all writes go through server actions).
- **File storage:** **Supabase Storage** — `product-images` bucket (**public**, for product/store images) and `kyc-documents` bucket (**private**, for ID/KYC docs, served via short-lived signed URLs).
- **Hosting:** **Vercel** (web app) + Firebase (data) + Supabase (images). Repo: GitHub **Xfuse1/Mahalak**, branch `main` (deploy directly to main, no feature branches per owner preference).
- **AI/assistant:** built with Claude Code (Opus). Use the latest Claude models for any AI features.

---

## 3. Architecture & conventions
- **Server actions pattern** (`"use server"` files in `lib/actions/`): every mutation is an async function that
  - derives identity from the **session** (`getCurrentUid()` / `getCurrentUser()` / driver session), never trusts client-passed IDs,
  - checks ownership (`getCurrentUid() === store_id`) or role (admin),
  - returns `{ success, error?, data? }`,
  - uses `cleanUndefined`, `revalidatePath`, and atomic `db.runTransaction` where needed.
  - ⚠️ A `"use server"` file can **only export async functions** (export `type`s are fine; exporting `const`/objects breaks the build).
- **Auth/roles:** users have `role` = `buyer | seller | admin`. Admin is set manually (`users/{uid}.role = "admin"` in Firestore — no UI). Drivers authenticate via a **PIN-based driver session** (separate from the user session).
- **i18n:** components call `t("عربي", "English")`; infrastructure utilities don't call `t()`.
- **Build/verify:** `npm run build` (must exit 0) + `npx eslint`. **Never judge build success through `| tail`/`| head`** — the pipe masks the real exit code (this hid a broken `main` for several commits). Capture `$?` from a redirected log or use `${PIPESTATUS[0]}`. ESLint does **not** catch TS type errors or `"use server"` violations — only the build does.

---

## 4. Data model (Firestore)
- **`users`** — one doc per user; **a seller's store is embedded inside the user doc** (`users/{uid}.store`, with `role == "seller"`), and **store id = owner uid** (there is no separate `stores` collection yet — see TD-01 in roadmap). KYC fields (national ID number + ID/commercial-register/tax-card images) live under `store.*` and are hidden from the public via an allow-list (`extractStore`) vs `extractStoreForOwner`.
- **`orders`** — single and `multi_store` orders. Multi-store orders have `pickup_stops[]` (one per store: `pending → confirmed → picked_up` / `rejected`). Order status: `pending → confirmed → picking_up → on_the_way → delivered` / `cancelled`. All COD (`payment_status: "cod"`). Multi-store orders carry a 4-digit `delivery_code` (proof of delivery) and `cash_collected` on delivery.
- **`order_items`**, **`products`** (with `rating`, `rating_count`, `stock`), **`reviews`** (verified-buyer only — server checks the customer actually purchased), **`debts`** + **`debt_transactions`** (seller debt ledger, atomic balance), **`complaints`** (support system), **`notifications`**, **`pending_registrations`** (pre-auth seller signup data).

---

## 5. Key features built
- **Discovery (IA-01):** "Nearest to you" — captures user location, sorts stores by distance (Haversine) + shows distance badges on home, `/store`, and store cards. Safe fallback when location/coords are missing.
- **Checkout / trust (TRU-01):** prominent Cash-on-Delivery messaging; delivery fee shown at the delivery step.
- **Multi-store orders + driver flow:** driver logs in (ID+PIN), picks up per store, order auto-moves to `on_the_way` when all picked up, then **proof-of-delivery**: driver enters the customer's 4-digit code to complete delivery. **Driver wallet** shows cash collected (COD) + deliveries count.
- **Seller debt ledger (UX-01):** `/seller/ledger`.
- **Admin (ADM-01/02):** `/admin/stores` (approve/reject + notify seller), `/admin/complaints` + `/support` (user submits complaints, admin resolves with a notification reply). Admin guarded by `requireAdmin()`.
- **KYC:** captured during seller registration into the **private** `kyc-documents` bucket; served to owner/admin via short-lived signed URLs.
- **PWA (MOB-09):** `app/manifest.ts` + theme color (installable).
- **Reviews:** verified-buyer-only ratings (server-enforced).

---

## 6. App sections / modules (every route)
Organized by audience (App Router paths).

**Buyer / public**
- `/` — **Home**: hero, categories, "Nearest to you" stores (IA-01), featured products.
- `/store`, `/store/[id]` — **Stores**: browse all stores / single store page (products, offers, WhatsApp + call contact).
- `/category/[name]` — **Category** browse.
- `/product/[id]` — **Product detail** + add-to-cart + verified-buyer star rating.
- `/search` — **Search** stores & products.
- `/cart` — **Cart**.
- `/checkout` → `/checkout/delivery` — **Checkout**: address & customer info (COD highlighted) → driver/delivery-fee selection & order placement.
- `/account` — **Account**: profile, order history & live tracking (shows the delivery confirmation code), rejected orders. `/account/edit-order/[id]` (edit order), `/account/change-driver` (reassign driver).
- `/review/[orderId]` — **Review**: rate the order (products + driver) after delivery.
- `/support` — **Support**: submit & track complaints (ADM-02).
- **3D Supermarket** `/supermarket` — immersive **3D store experience** (react-three, `components/game/3d/Store3D`) — walk a virtual store/aisles.
- Info/legal: `/about`, `/faq`, `/privacy`, `/terms`.

**Auth & onboarding**
- `/auth`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` — buyer auth.
- `/auth/verify-phone` — phone OTP (finalizes seller registration from `pending_registrations`).
- `/auth/seller`, `/auth/seller/login`, `/auth/seller/register` — **seller onboarding** (multi-step; captures KYC docs into the private bucket).

**Seller dashboard**
- `/seller/dashboard` — overview & stats.
- `/seller/products`, `/seller/products/new`, `/seller/products/edit/[id]` — **product catalog** management.
- `/seller/orders` — incoming orders (new-order sound/alert, MOB-04); `/seller/my-orders` — the seller's own placed orders.
- `/seller/offers` — **discounts / special offers**.
- `/seller/ledger` — **debt ledger** (UX-01): customer credit/debt with atomic balances.
- `/seller/settings` — store profile, logo, contact, location.
- `/seller/supermarket-3d` — **3D store builder/preview** for the seller.

**POS / Cashier (QPOS)** — in-store point of sale
- `/pos/qpos` — full **cashier**: **barcode scanner** (camera, html5-qrcode), cart, **shifts** (open/close with opening/closing cash reconciliation), **loyalty program** + gifts, **held/suspended carts**, **in-store customer CRM**, **returns/refunds**, **coupons**, PIN-protected. **Vertical-aware** — tailored flows per store type (`pos-pharmacy`, `pos-clothing`, `pos-online`, plus general supermarket). Functional color-coding intentionally kept.
- `/pos/receipt` — **printable sales receipt**.

**Driver**
- `/driver/orders` — PIN login; active/completed multi-store orders, per-store pickup, **proof-of-delivery code** entry, and the **driver wallet** (cash collected + deliveries) (UX-05; Arabic text fixed in MOB-02).

**Admin**
- `/admin` — admin home; `/admin/stores` — approve/reject stores + KYC review (ADM-01); `/admin/complaints` — review & resolve support tickets (ADM-02). Guarded by `requireAdmin()`.

**Store verticals (categories)**
- Stores/products are typed by vertical, each with category-specific fields and tailored POS flows: **grocery / supermarket**, **pharmacy / health**, **clothing**, **electronics**, **food**, **furniture**, **other services**.

**Platform systems (cross-cutting — `lib/actions/`)**
- **Notifications** (`notifications.ts`) — in-app notifications for orders, pickups, delivery, complaints.
- **Offers / discounts engine** (`offers.ts`) — store offers, applied & locked at order time.
- **Store reviews** (`storeReviews.ts`) — store-level ratings (separate from product reviews).
- **Dashboard / analytics** (`dashboard.ts`) — seller stats & overview.
- **Delivery / drivers** (`delivery.ts`) — driver records, PIN login, assignment.
- **Profiles** (`profile.ts`) + **pending registrations** — user/seller profile data & onboarding handoff.

---

## 7. Security posture
- Hardening done across multiple passes: authorization checks, account-takeover fixes, driver-session hardening, phone-verify, rate limiting, atomic order/stock transactions, discount-locked-at-order, KYC leak fixed (moved to private bucket), negative-quantity guard, and **Firestore + Storage rules** (deny-all client; role writes moved server-side).
- ⚠️ **Rules must be deployed** to take effect: `firebase deploy --only firestore:rules,storage:rules`.

---

## 8. Important gotchas / current state
- ⚠️ **`is_approved` gate is intentionally NOT enabled** in the public store listing (`getStores`). All existing stores are `is_approved:false`. **Do not enable the `is_approved === true` filter before approving existing stores** via `/admin/stores`, or the live site goes empty.
- ⚠️ **Build exit code** — see §3 (`| tail` masking pitfall).
- Stores are embedded in user docs (no separate collection); a legacy dual-schema (`stores` collection + camelCase fields) exists in places.
- Some POS (`qpos`) colors are intentionally kept (functional cashier color-coding — owner decision), not migrated to brand tokens.

---

## 9. Roadmap / open items
- **Owner decisions needed:** commission/subscription model, launch-neighborhood/density gates, digital wallets/BNPL, driver-identity unification, logo/creative assets, real FAQ/Terms/Privacy content.
- **Needs external infra:** WhatsApp/SMS + Web Push notifications, Service Worker, live GPS map.
- **Large buildable features:** TD-01 (split stores into a separate collection — high value but a **risky live-data migration**), TRU-06 (review comments + visible "verified buyer" badge + seller replies), neighborhood-first IA deepening.
- **Smaller polish:** trust badges on cards, favorites/wishlist, bottom mobile nav, image performance/pagination, dark-mode toggle, seller stock/expiry alerts.

---

## 10. How to work on it (preferences)
- Commit and push **directly to `main`** (no branches). Commit messages in Arabic, ending with the Co-Authored-By trailer.
- Always run a real build (exit 0) + lint before committing.
- Choose the **best** solution, not the easiest — depth and correctness over speed.
