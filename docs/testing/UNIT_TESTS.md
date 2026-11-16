# CSMQP Unit Test Specification

**Purpose:** Verify isolated backend functions/middleware and frontend components/services with controlled inputs. API/database workflow tests are identified as integration tests even when stored beside unit tests.

## Latest execution results

**Build tested:** `2946902` (`main`)

**Executed:** 2026-11-16

| Package / scope | Passed |
|---|---:|
| Backend unit and API integration suites | 100% |
| Executed frontend component/service tests | 100% |

## Execution

```sh
# Backend, including unit and API/database integration suites
cd server && npm test

# Frontend component/service tests
cd client && npm test
```

The backend uses Jest with an in-memory MongoDB setup and Supertest; the client uses Vitest, jsdom, and Testing Library. Keep test records isolated and restore mocks/timers/storage after each test.

## Backend unit test cases

| Case | Module | Inputs / condition | Expected assertion | Existing suite |
|---|---|---|---|---|
| UNIT-BE-01 | JWT helper | Sign and verify subject/role; wrong secret; `alg=none` | Claims round-trip and expiry exists; invalid signatures/algorithms reject. | `server/tests/jwt.unit.test.js` |
| UNIT-BE-02 | Password policy | Valid Unicode, non-string, each violated rule, 72-byte bcrypt boundary | Accept/reject and report all applicable policy failures consistently. | `server/tests/jwt.unit.test.js` |
| UNIT-BE-03 | Sanitizer | HTML, dangling tag, comparisons, nested operator/dotted keys, primitive, password field | Strip unsafe markup and keys recursively; preserve benign text/primitives/password; no mutation beyond policy. | `server/tests/sanitize.unit.test.js` |
| UNIT-BE-04 | Authorization middleware | listed role, unlisted role, absent user | Continue for allowed role; return 403 or 401 for rejected cases. | `server/tests/sanitize.unit.test.js` |
| UNIT-BE-05 | Rate limiter | below/at/over limit, elapsed window, reset, independent route budget | Allow only within budget; then 429 with retry metadata; reset/route isolation work. | `server/tests/rateLimit.test.js` |
| UNIT-BE-06 | Login lockout | failed credentials, success, malformed input, distinct IP, expired window | Threshold blocks only the relevant client; success/window expiry resets; malformed input does not consume credential budget. | `server/tests/loginLockout.test.js` |

## Backend integration suites (related, but not unit tests)

These exercise Express routes, middleware, Mongo persistence, and HTTP serialization together. Retain them as integration/API evidence rather than describing them as isolated unit tests.

| Area | Existing suite | Main assertions |
|---|---|---|
| Registration/login/session | `auth.test.js`, `security.test.js` | Validation, duplicate email, token issuance, blocked user, password hash secrecy, token rejection, role authorization, injection/sanitization. |
| CORS | `cors.test.js` | Exact-origin allow-list, no-origin behavior, preflight, empty configuration. |
| Materials | `materials.test.js`, `materials.security.test.js` | Upload types/content/size, metadata, search/download bytes, access control, deletion/moderation, unsafe text. |
| Question bank | `questionbank.test.js` | MCQ/T-F validation, tags/filter, edit/delete, owner rules, published-quiz deletion conflict. |
| Quiz | `quiz.test.js` | Create/publish, attempt deadline/resume, answer secrecy, scoring/result snapshot, access, duplicate/late submissions. |
| Analytics | `analytics.test.js` | Student-scoped aggregation, weak topics, role/auth restrictions. |
| Administration/reports | `admin.test.js`, `reports.test.js` | User block/delete, report lifecycle, moderation, role/ownership and error statuses. |
| Complete API workflow | `e2e.integration.test.js` | Register → question/material → quiz/publish → search/download → attempt/result. |

## Frontend unit/component cases

| Case group | Existing test files | Behaviors to assert |
|---|---|---|
| API service | `client/src/services/api.test.js` | Bearer token and JSON body, multipart handling, API error shape, 401 session clearing, query-string encoding. |
| Route and navigation | `ProtectedRoute.test.jsx`, `Navbar.test.jsx` | Loading state, anonymous redirect, correct/wrong role, links shown by role, logout. |
| Registration/login | `Register.test.jsx`, `Login.test.jsx` | Valid submit/navigation, client password boundaries, server validation errors, already-authenticated redirect. |
| Materials UI | `Materials.test.jsx` | Role-specific upload, search, download, size boundary, server errors, deletion confirmation, reporting. |
| Question bank UI | `QuestionBank.test.jsx` | MCQ validation, T/F controls, filters, edit, delete confirmation/conflict, role-specific actions. |
| Quiz UI | `QuizPages.test.jsx`, `QuizAttempt.test.jsx` | Create/publish/list states, countdown and skew handling, manual/automatic submit, one-time submit, result rendering. |
| Admin/report UI | `AdminUsers.test.jsx`, `AdminModeration.test.jsx`, `ReportButton.test.jsx` | Search/filter, block/unblock/delete, confirmation, report listing/removal/dismissal, errors and retry. |

## Completion criteria

For each unit case, assert returned value/state and relevant side effects, including that rejected operations leave state unchanged. Use deterministic fake timers for time-dependent behavior, fixed fixtures for scoring/analytics, and mocked network calls only for frontend unit tests. Run coverage commands in `CODE_BRANCH_COVERAGE_TESTS.md` for branch/line measurement. A test passing in isolation does not establish system-level TLS, uptime, browser compatibility, or concurrency targets.

> **Caveat:** Percentages cover executed tests only. The Instructor Analytics page test was not included because its `recharts` dependency was unavailable.
