# Backend Transaction Security Tests

This folder contains a simple Node.js script to exercise transaction security-related behavior in the backend.

## What it checks

- missing and invalid authentication
- role-based access control for system head routes
- input validation for one-time payment requests
- IDOR protection when deleting another system head's payment request

## Requirements

- Node.js 18+ (for the built-in `fetch` API)
- Backend running locally (default `http://localhost:3000`)

## Run the tests

From the backend folder:

```bash
cd backend
node security-tests/transaction-security-test.js
```

and

```bash
artillery run security-tests/load-test.yml
```

## Environment variables

Optionally override defaults:

- `BACKEND_URL` - backend URL to test against
- `SEC_TEST_SYSTEM_HEAD_EMAIL` - system head login email
- `SEC_TEST_SYSTEM_HEAD_PASSWORD` - system head password
- `SEC_TEST_USER_EMAIL` - user login email
- `SEC_TEST_USER_PASSWORD` - user password
