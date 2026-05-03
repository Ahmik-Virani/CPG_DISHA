# AGENTS.md

This file is the working map for Codex when changing this repository. Keep it current when architecture, flows, or conventions change.

## Project Summary

CPG_DISHA is an IIT Hyderabad payment gateway application. It has:

- A React/Vite frontend in `frontend/`
- An Express/MongoDB backend in `backend/`
- REST APIs between frontend and backend
- JWT auth with three roles: `admin`, `system_head`, and `user`
- ICICI payment integration with HMAC signing, status checks, refunds, and settlement sync

There are no root-level app scripts. Run backend and frontend from their own directories.

## Development Commands

Backend, from `backend/`:

```bash
npm run dev      # Start Express server on PORT, default 4000
npm start        # Same as dev
```

Frontend, from `frontend/`:

```bash
npm run dev      # Start Vite dev server, default 5173
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

Run backend and frontend in separate terminals.

## Backend Architecture

Backend entrypoint is `backend/main.js`.

It:

- Creates the Express app
- Enables CORS and JSON body parsing
- Mounts routes under `/health`, `/auth`, `/events`, `/admin`, `/user-payments`, and `/external-links`
- Connects to MongoDB with retry
- Starts the daily scheduler

Important backend files:

- `config.js`: reads env vars and constants
- `db.js`: owns MongoDB connection, collection handles, indexes, bootstrap admin, and all DB helper functions
- `utils.js`: common normalization, token signing, and safe user helpers
- `middleware/auth.js`: JWT verification and role guards
- `scheduler.js`: recurring payment generation, payment reconciliation, hash retry, duplicate refund handling, settlement sync
- `settlement.js`: ICICI settlement summary/status sync and `Settlement_History` writes
- `routes/bank-payment/icici.js`: ICICI sale initiation, status check, refund, request signing, response hash verification

Backend route modules:

- `routes/auth.js`: login, self-signup for users, password change, current user
- `routes/admin.js`: system head management, bank management, system head payment history, ICICI settlement history/sync
- `routes/events.js`: system head event CRUD, bank options, transaction history
- `routes/create-payment-request.js`: fixed, one-time, and recurring payment request creation
- `routes/delete-payment-request.js`: delete fixed/one-time payment requests
- `routes/user-payments.js`: user pending/optional payments, payment initiation, status verification, history
- `routes/external-links.js`: public external payment links, external payment initiation, public verification, public receipts
- `routes/health.js`: health/database availability check

## Backend Data Model

Collections are initialized in `db.js`. Core collections:

- `Users`: admins, system heads, users
- `Events`: events created by system heads
- `Fixed_Payment_Request`: fixed or variable amount requests available to users
- `One_Time_Payment_Request`: per-roll-number payment rows, usually created as a batch
- `Recurring_Payment_Request`: recurring templates that generate new one-time payment rows
- `Payment_Processed`: every payment attempt, including pending, success, and failed attempts
- `Banks`: admin-configured bank integrations and enabled/disabled status
- `External_Links`: public payment link per system head
- `Refunds`: duplicate-payment refund attempts
- `Settlement_History`: ICICI settlement sync results

Most records use UUID string `id` fields instead of Mongo `_id` in API payloads.

## Auth And Roles

JWTs are signed in `utils.js` and validated by `requireAuth`.

Role order in `middleware/auth.js` is:

```text
user < system_head < admin
```

`requireRole("system_head")` also allows admins because the middleware uses this hierarchy. Frontend route guards use exact allowed-role arrays, so backend and frontend authorization behavior are not identical.

Self-signup only allows `user`. Admin creates system heads. The bootstrap admin is created from env vars during DB startup.

Frontend stores auth in localStorage:

- `cpg_token`
- `cpg_user`

The API client dispatches `cpg:auth-expired` on 401 responses so the auth context can log out.

## Payment Request Types

There are two immediate payment request types and one recurring template type:

- `fixed`: one request for an event, optionally fixed amount or variable amount entered by the payer
- `one_time`: per-roll-number entries with per-user amounts and a TTL
- `recurring`: template for one-time entries; scheduler creates fresh one-time rows on an interval

Only one latest payment request is allowed per event by `create-payment-request.js`.

One-time requests are stored as one DB document per roll number, sharing a `batchId`. The frontend edits them as a table/CSV-like set of entries.

Fixed requests can be amount-fixed or variable:

- `isAmountFixed: true`: `amount` must be positive
- `isAmountFixed: false`: user supplies `customAmount` when initiating payment

## Payment Lifecycle

For logged-in users:

1. User views pending one-time payments from `GET /user-payments/pending`.
2. User views optional/fixed payments from `GET /user-payments/optional`.
3. User starts ICICI payment with `POST /user-payments/initiate-sale`.
4. Backend creates a `Payment_Processed` record with `status: "pending"`.
5. Frontend redirects user to ICICI using `paymentURL`.
6. After return, frontend calls `POST /user-payments/verify-status`.
7. Backend calls ICICI status check and updates `Payment_Processed` plus the source payment request status.

For public external links:

1. System head creates/uses their link through `/external-links/me`.
2. Public user opens `/pay/external/:linkId?amount=...`.
3. Public user starts ICICI payment with `POST /external-links/:linkId/initiate`.
4. Backend creates a `Payment_Processed` record with `source: "external_link"` and `paymentRequestId: null`.
5. Frontend calls `POST /external-links/verify-status` after return.
6. Public receipt is available only after success via `/external-links/receipt/:paymentRecordId`.

`Payment_Processed` records are one-per-attempt. The code does not deduplicate attempts at creation time.

## ICICI Integration

Only ICICI is implemented. Other bank choices generally return "Yet to be added".

ICICI behavior lives in `routes/bank-payment/icici.js`:

- `initiateIciciSale`: builds signed initiate-sale packet, calls ICICI, extracts `tranCtx`, returns redirect URL
- `checkIciciSaleStatus`: builds signed `STATUS` packet, calls ICICI status API, verifies response hash
- `initiateIciciRefund`: builds signed refund packet, calls ICICI refund API, verifies response hash

Hash behavior:

- Request hash uses sorted packet keys and concatenated values with HMAC.
- Response hash verification excludes `secureHash` and `oth_charge`.
- Several response-hash fallbacks are attempted because ICICI response ordering can vary.

Current status mapping is strict: `checkIciciSaleStatus` treats `txnRespDescription === "transaction successful"` as success; otherwise a verified response maps to failed.

## Reconciliation Logic

Reconciliation is polling/status-check based. There is no bank webhook/callback route.

Daily scheduler is started by `main.js` and runs at midnight Asia/Kolkata:

```js
executeRecurringTemplates();
retryPendingHashVerifications();
reconcilePendingAndFailedTransactions();
runIciciSettlementSync();
```

`retryPendingHashVerifications()`:

- Finds `Payment_Processed` records with `status: "pending"` and `pendingHashVerificationRetry: true`
- Calls ICICI status again
- If hash verifies, updates payment to `success` or `failed`
- Updates the payment request status for normal payments

`reconcilePendingAndFailedTransactions()`:

- Finds internal, non-external-link `Payment_Processed` records with status `pending` or `failed`
- Calls ICICI status for each record
- Keeps status unchanged if response hash cannot be verified
- Increments `reconciliation.pendingStatusChecks` for still-pending payments
- Marks pending payments failed after 5 daily pending checks
- Rechecks failed payments for up to 2 days
- Moves failed payments back to success if ICICI later reports success and adds an alert
- Updates the linked payment request status

Duplicate successful payment handling:

- Runs when reconciliation turns a payment successful
- Looks for another successful payment for the same event and normalized roll number
- Creates a `Refunds` record
- Calls ICICI refund API
- Stores refund request/response and status
- Adds an alert if duplicate refund succeeds

Settlement sync:

- `runIciciSettlementSync()` syncs previous IST day into `Settlement_History`
- Admin can read with `GET /admin/settlements/icici`
- Admin can manually sync with `POST /admin/settlements/icici/sync` using `settlementDate` in `YYYYMMDD`
- `settlement.js` first tries ICICI settlement summary
- If summary fails, it falls back to checking settlement status for local successful ICICI transactions from that IST day

## Frontend Architecture

Frontend entrypoint is `frontend/src/main.jsx`. It wraps the app in:

- `BrowserRouter`
- `AuthProvider`

Routing is in `frontend/src/App.jsx`.

Important frontend files:

- `context/AuthContext.jsx`: auth state, localStorage persistence, login/signup/logout/change-password/refresh-me
- `lib/api.js`: all API wrappers and 401 handling
- `components/Header.jsx`: shared modern sticky IITH nav
- `components/ProtectedRoute.jsx`: authenticated route guard
- `components/PublicOnlyRoute.jsx`: login/signup guard
- `auth/roleHome.js`: role-based landing helpers

Frontend page areas:

- `pages/login`: login, signup, change password
- `pages/admin`: admin dashboard, banks, system heads, fraud rule placeholder, payment history
- `pages/system_head`: event list, event management, payment request creation/details
- `pages/user`: user payment dashboard, payment details, receipts, external payment landing/receipt

API wrapper exports:

- `authApi`
- `adminApi`
- `eventApi`
- `userPaymentApi`
- `externalLinkApi`

## UI Conventions

The app uses an IITH-branded Tailwind style.

Follow existing visual patterns:

- Tailwind utility classes in JSX
- No separate CSS files for new page/component styling unless absolutely necessary
- Orange primary accents, especially `orange-400`
- `orange-50` or background image based page backgrounds
- White cards with light gray borders
- Shared `<Header variant="modern" />`
- Centered pill tab bars for dashboard sections
- `lucide-react` icons where existing components use icons

The current background image is in `frontend/public/orangegrid.jpg`.

## Environment

Backend expects `.env` in `backend/`. Important env vars:

- `PORT`
- `JWT_SECRET`
- `MONGODB_CONNECTION_STRING`
- `MONGODB_USER_ID`
- `MONGODB_PWD`
- `MONGODB_DB_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ICICI_HMAC_SECRET`
- `ICICI_HMAC_ALGO`
- `ICICI_INITIATE_SALE_URL`
- `ICICI_STATUS_CHECK_URL`
- `ICICI_AUTH_REDIRECT_URL`
- `ICICI_REFUND_URL`
- `ICICI_SETTLEMENT_URL`

Frontend API base URL:

- `VITE_API_BASE_URL`, default `http://localhost:4000`

## Working Conventions

- Prefer adding DB behavior through `db.js` helpers instead of direct collection access in routes, unless the file already does direct access nearby.
- Preserve UUID string `id` API shape and omit Mongo `_id` from API responses.
- When changing payment status logic, check all affected paths: user verification, external verification, scheduler reconciliation, history views, and receipts.
- When changing bank/payment fields, update both backend packet construction and frontend API/UI assumptions.
- When touching payment request creation, remember that one-time requests are batch rows and recurring templates clone those rows later.
- Keep scheduler behavior idempotent where possible because it runs daily and may retry partially completed work.
- Be careful with `.env`, HMAC secrets, and logged ICICI packets. Do not commit secrets.
- This repo currently has no dedicated automated backend test suite. Frontend lint/build are the main available checks.
