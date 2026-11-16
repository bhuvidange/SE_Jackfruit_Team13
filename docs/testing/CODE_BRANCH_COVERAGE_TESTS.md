# CSMQP Code and Branch Coverage Test Specification

**Purpose:** Define how to measure code coverage and which decision outcomes must be exercised. This document supplements requirement-based system testing; coverage percentage alone does not prove requirement correctness.

## Latest coverage results

**Build tested:** `2946902` (`main`)

**Executed:** 2026-11-16

| Package | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| Backend | 94.94% | 84.74% | 97.05% | 96.53% |

## Commands and configured gates

Run from each package directory:

```sh
# Backend
cd server && npm test -- --coverage

# Frontend
cd client && npm run test:coverage
```

The backend Jest configuration collects `server/src/**/*.js` (excluding server entry/seed/database bootstrap) and sets global minimums of 90% statements, 85% branches, 95% functions, and 95% lines. The frontend Vitest configuration excludes tests/setup/entrypoint and sets minimums of 80% statements, 80% branches, 78% functions, and 82% lines. Review the generated text summary and LCOV/HTML reports; a failed threshold is a failed coverage run. Keep coverage reports as build artifacts rather than source evidence.

## Coverage objectives

| Layer | Main suites / code under coverage | Required branch pairs and boundary outcomes |
|---|---|---|
| Backend auth and policy | `auth.test.js`, `security.test.js`, `loginLockout.test.js`, `jwt.unit.test.js`; auth routes, JWT, password policy, lockout | valid/invalid credentials; known/unknown user; blocked/active; threshold−1/threshold/after threshold; lockout before/after expiry; token valid/expired/tampered/wrong secret/unsupported algorithm; password min/max and just outside; role default/allowed/forbidden. |
| Authorization and sanitization | `sanitize.unit.test.js`, `security.test.js`, `cors.test.js`; authenticate/authorize/sanitize/CORS middleware | no token/malformed scheme/valid token/deleted account; permitted/forbidden role; strings/primitives/nested objects; clean/operator keys; XSS text and harmless comparison; allowed/disallowed/no origin and preflight. |
| Materials | `materials.test.js`, `materials.security.test.js`; routes and upload validation | missing/present file; supported/unsupported extension; matching/mismatched MIME and content signature; 15 MB/15 MB+1; authorized roles; search match/no match/literal metacharacters/injection; owner/admin/other user; active/removed material. |
| Questions | `questionbank.test.js`; question routes/model validation | MCQ and T/F valid/invalid; four options/duplicates/blank options; answer index valid/out of range; filter omitted/valid/invalid; owner/other instructor/admin/student; published-quiz deletion conflict vs unused question; valid/invalid edit. |
| Quiz and grading | `quiz.test.js`; quiz routes and scoring | draft/published; owner/non-owner; start/new/resume; before deadline/inside grace/beyond grace; submit first/duplicate/no attempt; correct/incorrect/unanswered; duplicate answers; question exists/deleted; result owner/other student/instructor. |
| Analytics and administration | `analytics.test.js`, `admin.test.js`, `reports.test.js`; relevant routes | no attempts/attempts; weak topic below/at-or-above threshold; own/other student; admin/student/instructor; block/unblock/delete; self/other admin; valid/malformed/unknown IDs; open/resolved report; dismiss/remove and protected-question conflict. |
| Frontend service and guards | `api.test.js`, `ProtectedRoute.test.jsx`, `Navbar.test.jsx`; API client/auth routing | token present/absent; JSON/multipart; successful/error response; 401 clears session; query empty/encoded; loading/anonymous/right role/wrong role; navigation by role. |
| Frontend workflows | page/component suites in `client/src`; pages/components | loading/data/empty/error; form valid/invalid; confirm/cancel; successful/failed actions; role-dependent controls; quiz timer positive/zero/already submitted; upload size boundary. |

## Test design rules

1. For each conditional, exercise both outcomes; for compound conditions, cover each meaningful operand independently where feasible.
2. For each validator, cover a valid value, a clearly invalid value, and boundary values immediately below/at/above the limit.
3. For authorization branches, use anonymous, allowed role, wrong role, and wrong resource owner as distinct cases.
4. For error handling, trigger expected client errors (4xx), missing records, conflicts, and an unexpected failure where the test harness can do so safely.
5. For UI conditional rendering, cover loading, populated, empty, error, and role-specific states.
6. Do not add tests solely to raise a percentage if they do not assert behavior. Record uncovered lines/branches and explain unreachable or environment-specific paths.

## Review and reporting

Record commit/build, command, runner version, statement/branch/function/line percentages, threshold status, and uncovered files/branches. Compare LCOV artifacts between changes to detect regressions. Current repo includes dedicated unit/integration suites corresponding to the table; this document is a coverage plan, not a claim that every listed branch has been executed in every build.

> **Caveat:** Frontend coverage was unavailable because the `recharts` dependency was not available to the coverage run. Backend branch coverage is 84.74%; the configured minimum is 85%. TLS negotiation, browser/device support, uptime, and production-scale concurrency require separate system/deployment evidence.
