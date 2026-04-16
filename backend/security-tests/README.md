# Backend Transaction Security and Lost Tests

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

# Transaction Securities - Taken care of:

* create/login user
* create/login system head
* verify system head profile
* verify user profile
* health endpoint is reachable
* invalid login is rejected
* missing token is rejected
* invalid token is rejected
* user role is forbidden from system head route
* fetch bank options
* create test events
* reject unsupported payment request type
* reject invalid one-time payment request
* create one-time payment request
* pending payments include one-time request
* create fixed payment request
* create recurring payment request: System head should create recurring payment request
* verify-status rejects missing payment ids
* verify-status rejects missing payment record
* system head cannot verify user payment
* initiate sale rejects unknown bank
* initiate sale requires returnURL
* initiate sale creates pending payment
* pending payments still include initiated payment
* verify-status returns valid status: Pending payments should no longer show successful/failed transactions
* other user cannot verify someone else's payment
* system head event details endpoint returns expected event
* latest payment request is one-time
* system head transaction history returns array
* different system head cannot delete other's payment request
* optional payments endpoint returns requests array


# Load Testing 

This configuration defines a staged load test for a backend service running at `http://localhost:4000`. The goal is to evaluate availability, scalability, and behavior under varying traffic conditions using a mix of public, user, and admin endpoints.

---

## Test Phases

The load test progresses through four phases to simulate realistic traffic patterns:

| Phase       | Duration | Arrival Rate | Description |
|------------|---------|-------------|------------|
| Warm up    | 30s     | 10 req/sec  | Initializes system state, warms caches, stabilizes connections |
| Ramp up    | 60s     | 50 req/sec  | Gradually increases load to observe scaling behavior |
| Stress     | 60s     | 100 req/sec | Applies peak load to identify bottlenecks and failure thresholds |
| Cool down  | 30s     | 10 req/sec  | Reduces load to evaluate recovery and stability |

---

## Scenarios

Traffic is distributed across multiple API scenarios using weighted probabilities to simulate real-world usage patterns.

### 1. Health Check (20%)

- **Endpoint:** `GET /health`  
- **Authentication:** None  

**Purpose:**
- Verifies service availability under load  
- Measures baseline latency and uptime  
- Acts as a control signal for system health  

---

### 2. User Payment Flow (30%)

- **Endpoint:** `GET /user-payments`  
- **Authentication:** Bearer token (user)  

**Purpose:**
- Tests user-facing payment retrieval  
- Evaluates authentication overhead  
- Measures performance of payment-related queries  

---

### 3. Events Endpoint (25%)

- **Endpoint:** `GET /events`  
- **Authentication:** Bearer token  

**Purpose:**
- Tests event listing functionality under load  
- Evaluates database read performance  
- Validates access control behavior  

---

### 4. Admin Check (25%)

- **Endpoint:** `GET /admin`  
- **Authentication:** Bearer token (admin)  

**Purpose:**
- Tests admin-restricted routes  
- Verifies role-based access control  
- Evaluates system stability for privileged operations  

---

## Traffic Distribution

Requests are probabilistically distributed based on scenario weights:

- Health Check → 20%  
- User Payment Flow → 30%  
- Events Endpoint → 25%  
- Admin Check → 25%  

This creates a mixed workload combining:
- Public endpoints  
- Authenticated user operations  
- Admin-level access  

---

## What This Test Covers

| Area                          | Coverage |
|------------------------------|---------|
| Service availability          | High |
| Read-heavy workloads          | High |
| Authentication                | Moderate |
| Authorization (roles)         | Moderate |
| Database read performance     | High |
| Traffic distribution realism  | High |

---


The staged phases combined with weighted scenarios provide a controlled yet representative evaluation of backend performance.
