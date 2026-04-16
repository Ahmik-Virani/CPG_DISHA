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

# Load Testing Overview

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

## Backend Preparation and Execution

The load test is supported by a processor script that prepares the system before traffic is applied.

### Setup Steps

- Creates or logs in:
  - System head (admin)
  - User account  
- Generates authentication tokens  
- Creates a test event  
- Fetches available bank options  
- Creates a one-time payment request  

---

## Execution Model

- Concurrent workers simulate multiple users  
- Requests are randomly selected based on scenario weights  
- Execution continues until:
  - Total request limit is reached, or  
  - Time duration expires  

### Metrics Collected

- Total requests  
- Successful responses (2xx)  
- Failed responses  
- HTTP status distribution  
- Network errors (with abort threshold)  

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

## Limitations

- No write-heavy operations during main load (only in setup phase)  
- Static tokens in YAML (less realistic than dynamic auth)  
- No latency percentiles or detailed timing breakdown  
- Limited failure scenario injection  

---

## Summary

This load test simulates a realistic mix of traffic across public, user, and admin endpoints under increasing load. It is designed to expose:

- Performance bottlenecks  
- Authentication overhead  
- Role-based access behavior  
- System stability under stress  

The staged phases combined with weighted scenarios provide a controlled yet representative evaluation of backend performance.