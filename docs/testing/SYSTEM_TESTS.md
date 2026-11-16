# CSMQP System Test Specification

**Basis:** TEAM13_CSMQP_SRS v1.0 (04-09-2026)  
**Purpose:** Verify complete user-visible workflows and system-level requirements across the React client, Express API, and MongoDB.  
**Status:** Planned cases; record actual result, build, date, and defect ID when executed.

## Latest execution results

**Build tested:** `2946902` (`main`)

**Executed:** 2026-11-16

| Scope | Passed |
|---|---:|
| Complete API workflow (`server/tests/e2e.integration.test.js`) | 100% |
| Backend API suite | 100% |
| Executed frontend component tests | 100% |

## Test setup

Use an isolated test database and a running client/API. Prepare student, instructor, and administrator accounts; two instructors; at least two students; materials, questions, quizzes, and attempts. Use supported browser versions specified in the SRS. Use an HTTPS deployment for TLS verification and a dedicated load-test environment for load checks. Do not run destructive tests against production data.

For every case, capture the request or user action, observed result, pass/fail, and evidence. Pass means the expected result below is observed. A requirement needing infrastructure or measurement unavailable in the test environment remains **Not Run**, not Passed.

## Functional system tests

| Case | SRS trace | Scenario and steps | Expected result | Priority |
|---|---|---|---|---|
| SYS-AUTH-01 | F-001 | Register with a valid unique email/password; then try duplicate email, malformed email, and passwords below/above configured policy. | Valid account is created; invalid/duplicate registrations are rejected with feedback. | High |
| SYS-AUTH-02 | F-002, SR-001, SR-002 | Log in with valid and invalid credentials; inspect session and password persistence; try expired/tampered token. | Valid login issues usable signed expiring JWT; bad credentials/token fail; stored password is a salted hash. | High |
| SYS-AUTH-03 | F-003, SR-003 | As student, call instructor/admin write endpoints; as instructor call admin endpoints; repeat without token. | Anonymous gets 401; authenticated wrong role gets 403; data remains unchanged. | High |
| SYS-MAT-01 | F-010, F-011 | Instructor uploads valid PDF/DOCX/PPTX/JPG, unsupported type, exactly 15 MB and 15 MB + 1 byte. | Supported files through 15 MB succeed; unsupported/oversize files fail and are not retained. | High |
| SYS-MAT-02 | F-012 | Upload material with subject/topic metadata; inspect list/detail. | Metadata persists and is displayed. | Medium |
| SYS-MAT-03 | F-013, F-051 | Student searches by name/keyword and downloads a result; admin removes a reported material. | Matching material appears; downloaded bytes match upload; removed material is no longer listed/downloadable. | High |
| SYS-QB-01 | F-020, F-021 | Instructor creates MCQ with four options/one correct answer, invalid MCQ, and True/False question; retrieve as authorized user. | Valid questions persist; invalid structure is rejected; correct answer is not exposed in student-facing quiz data. | High |
| SYS-QB-02 | F-022 | Tag questions by subject/topic/difficulty and filter by each tag. | Tags persist; filters return only matching questions. | Medium |
| SYS-QB-03 | F-023, F-051 | Edit/delete an unused question; attempt deletion of question used by published quiz; moderate/remove reported question. | Edit persists; deleted/removed question disappears; protected published quiz question is not removed. | Medium |
| SYS-QUIZ-01 | F-030, F-031 | Instructor creates quiz from selected questions and configures time limit. | Quiz references selected questions in chosen order and stores configured limit. | High |
| SYS-QUIZ-02 | F-032 | Publish as owner, attempt publish as another instructor; inspect student list. | Owner can publish; unauthorized publish is refused; published quiz is visible to eligible students, draft is hidden. | High |
| SYS-QUIZ-03 | F-033 | Student starts quiz, resumes it, submits before deadline, then try submit after deadline (including defined grace behavior). | Deadline is enforced; resume keeps same attempt/deadline; late attempt is rejected or auto-submitted as specified by implementation. | High |
| SYS-QUIZ-04 | F-034, F-035 | Submit all correct, all wrong, mixed, and unanswered responses; inspect result. | Score equals correct-answer count; result shows score and each question’s chosen/correct answer and correctness. | High |
| SYS-PERF-01 | F-040 | Student opens personal dashboard with known attempts. | Average, recent results, and weak topics agree with underlying attempts. | Medium |
| SYS-PERF-02 | F-041, F-042 | Instructor opens class analytics with known records and chart data. | Class/question statistics agree with source records; chart renders without error. | Medium |
| SYS-ADMIN-01 | F-050 | Admin lists, blocks, unblocks, and deletes a test account; try login and existing token after block/delete. | Admin actions are reflected; blocked/deleted accounts lose access immediately; protected admin/self actions follow policy. | High |
| SYS-ADMIN-02 | F-051 | Student reports material/question; admin reviews and removes or dismisses report. | Report is visible to admin; remove hides content; dismiss leaves content available. | Medium |

## Non-functional and security system tests

| Case | SRS trace | Method / pass criterion | Evidence |
|---|---|---|---|
| SYS-SEC-01 | SR-001 | Inspect persisted password fields: bcrypt/equivalent salted hash, never plaintext. | Redacted database evidence and test output. |
| SYS-SEC-02 | SR-002 | Send expired, invalid-signature, tampered, and missing JWT requests. All protected requests reject unauthorized sessions. | HTTP status and sanitized response. |
| SYS-SEC-03 | SR-003 | Attempt cross-role and cross-owner mutation of questions/quizzes/grades. Deny unauthorized changes. | Status and before/after data comparison. |
| SYS-SEC-04 | SR-004 | Exercise XSS strings, NoSQL operator payloads, and cookie-only/CSRF-style requests. Inputs are neutralized; cookie alone does not authenticate; no unauthorized state change. | Requests, responses, persisted values. |
| SYS-SEC-05 | SR-005 | Inspect deployed endpoint and attempt plaintext HTTP connection. TLS 1.2+ is negotiated and plaintext is refused or redirected securely. | TLS scan/configuration evidence. |
| SYS-NFR-01 | NF-001 | Load test up to 500 concurrent sessions using representative flows; compare errors and latency with agreed baseline. | Load report. SRS says “without significant degradation” but does not define a numerical degradation threshold; agree it before sign-off. |
| SYS-NFR-02 | NF-002 | Measure page-load latency under normal network conditions; p95 ≤ 2 seconds. | Browser performance report. |
| SYS-NFR-03 | NF-003 | Measure quiz grading latency under normal operating conditions; ≤ 1 second. | Server timing/load report. |
| SYS-NFR-04 | NF-004 | Review monthly availability/uptime records excluding scheduled maintenance; ≥ 99.5%. | Monitoring report; this cannot be established by a short functional run. |
| SYS-NFR-05 | NF-005 | Manually check responsive layouts and core workflows on desktop/tablet/mobile, latest Chrome/Firefox/Safari/Edge. | Browser/device matrix with version, viewport, result, defects. |

## Traceability and execution notes

Cases cover SRS functional IDs F-001..003, F-010..013, F-020..023, F-030..035, F-040..042, F-050..051; non-functional NF-001..005; and security SR-001..005. The SRS uses inconsistent spellings such as `CSMQPF-001` and `CSMQP-F-001`; this document uses the normalized IDs from its section headings.

The repository already has API integration/e2e and client UI tests. These system cases describe broader end-to-end and deployment-level verification.

> **Caveat:** Percentages cover executed tests only. The Instructor Analytics page test was not included because its `recharts` dependency was unavailable. TLS deployment, monthly uptime, browser/device compatibility, and 500-user load acceptance require separate environment-specific evidence.
