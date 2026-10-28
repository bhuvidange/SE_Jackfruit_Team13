# Sprint 1 - Deviations from SRS / SAD / Test Plan

Nothing in the requirements was silently dropped. This page lists every place where the implementation decides an
open point, differs from, or adds to the three documents.

## 1. Open points the documents left to the implementation

| Topic | Document | Decision |
| --- | --- | --- |
| Password policy | SRS 4.1 "Password policy TBD"; SAD 4.7 | **Finalized**: 8-64 characters with at least one lowercase letter, one uppercase letter and one digit. The 64 limit stays under bcrypt's 72-byte input cap. Enforced on the server (`utils/passwordPolicy.js`) and mirrored in the register form. |
| Password hashing | SR-001 "bcrypt or equivalent" | `bcryptjs` (pure JavaScript bcrypt, no native build step on Windows), cost 10. |
| JWT lifetime | SR-002 "defined expiry" | HS256, default `2h` (`JWT_EXPIRES_IN`). Verification pins the algorithm, so `alg=none` and foreign-secret tokens are rejected. |
| File storage | SAD 4.7 "storage details open" | Local disk (`server/uploads`, random file names). Metadata in MongoDB (`Material`). A cloud store can replace it later without API changes. |
| API contract | SAD 4.4 "endpoint names are proposed" | Endpoints kept as proposed; extra ones are listed in section 3. |
| Charting library | SRS 4.5 | Not needed in Sprint 1 (analytics are Sprint 2). |

## 2. Differences from the documents

| # | Requirement | Difference and reason |
| --- | --- | --- |
| 1 | SR-004 - CSRF | **CSRF protection is not applicable**: the JWT is sent in the `Authorization` header (stored in the browser, never in a cookie), so browsers cannot attach it to forged cross-site requests. No cookie is ever trusted. `TC-Sec-04` proves that a request carrying the token only as a cookie gets 401. XSS and NoSQL injection are handled by the sanitiser and by strict type checks. |
| 2 | SR-005 / TC-Sec-05 - TLS 1.2+ | **Deferred to deployment.** TLS terminates at the hosting layer (reverse proxy / platform), not inside Express. The API sends `Strict-Transport-Security` (via `helmet`) and the test checks that header; "server rejects non-TLS connections" cannot be exercised against the in-process test app and must be verified in the deployed environment. |
| 3 | SR-004 - XSS | Dangerous input is **stripped** (HTML tags, `javascript:` URLs) rather than stored HTML-escaped; React escapes on output as a second layer. Plain text such as `3 < 5` is preserved. Passwords are never altered. |
| 4 | SAD 4.4 - upload errors | An over-size file returns **413 Payload Too Large** (SAD lists only 400 for invalid files). Unsupported formats and files whose bytes do not match their extension return 400. Exactly 15 MB (15 x 1024 x 1024 bytes) is accepted; one more byte is rejected. |
| 5 | SAD 4.4 - registration | `POST /api/auth/register` also returns a JWT so the user is signed in immediately. Administrators cannot self-register (role must be `student` or `instructor`); admin accounts come from the seed script or future admin tooling. Duplicate emails return 400 as in the SAD. |
| 6 | F-021 | The correct answer is stored as the **index** of the option (`correctAnswer`). A True/False question gets the options `["True","False"]` when none are sent. MCQ options must be non-empty and distinct. |
| 7 | F-023 | Deleting is a **soft delete** (`status: removed`) so existing draft quizzes keep valid references. Deleting a question that belongs to a **published** quiz is blocked with 409 (SRS comment "deletion blocked if question is in a published quiz"). Only the instructor who created a question may edit or delete it (403 otherwise). Administrators have read-only access in Sprint 1; moderation is Sprint 2. |
| 8 | F-030 / F-032 | Quizzes cannot be edited after creation in Sprint 1 (no edit endpoint); publish is one-way. A quiz can be published only if all its questions still exist. Eligibility (`eligibility` field in the SAD data model) has the single value `all` = every registered student. |
| 9 | F-033 - late submission | The SRS allows "rejected or auto-submitted"; both are implemented. The browser **auto-submits** when the countdown reaches zero. The server fixes the deadline at start (`expiresAt`), accepts a submit up to `SUBMIT_GRACE_SECONDS` (default 5 s) late to absorb network delay, and **rejects anything later with 400**, marking the attempt `expired` (score 0, no retry). |
| 10 | F-033 | Each student has **one attempt per quiz** (unique index). `start` is idempotent: reopening an unfinished attempt resumes the same deadline. |
| 11 | F-035 | The graded result stores a **snapshot** of each question (text, options, correct answer), so later edits to the bank never change a past result. Unanswered questions score zero and are shown as "Not answered". |
| 12 | Test Plan numbering | The Test Plan names TC-Auth-01..05 (register, invalid register, login, invalid login, student -> 403). The SRS RTM lists only TC-Auth-01..03; the Test Plan numbering is used. |
| 13 | Test Plan scope | Only tests for Sprint 1 requirements exist. TC-Perf-*, TC-Admin-*, TC-OPS-01 and TC-UX-01 (load, uptime, cross-browser) are not part of this sprint; TC-Quiz-05's 1-second grading limit (NF-003) is asserted in an automated test. |

## 3. Extra endpoints beyond SAD section 4.4

`GET /api/health`, `GET /api/auth/me`, `GET|PUT|DELETE /api/questions[/:id]` (SAD lists none for questions),
`GET /api/materials/:id`, `GET /api/materials/:id/download`, `GET /api/quizzes`, `GET /api/quizzes/:id`,
`POST /api/quizzes/:id/publish`, `POST /api/quizzes/:id/start`, `GET /api/quizzes/attempts/:attemptId`.
`POST /api/quizzes` and `POST /api/quizzes/:id/submit` match the SAD. `GET /api/analytics/student` is Sprint 2.

## 4. Implementation notes worth knowing

* The server checks the user's `status` on every authenticated request, so a blocked account loses access
  immediately (groundwork for F-050 in Sprint 2).
* Login answers identically for an unknown email and a wrong password and does a dummy hash comparison to avoid a timing
  side channel.
* Search (`/api/materials?query=`) matches title, subject, topic, description and original file name, case-insensitively,
  with regular-expression characters escaped.
* Jest note: tests connect Mongoose with `runtimeAdapters: { os }` (`server/tests/helpers.js`). Without it the MongoDB
  driver's dynamic `import('os')` fails inside Jest's sandbox and the connection handshake is rejected.
* The question-bank page's own tiny request helper (stage 2) is replaced by the shared `services/api.js` in stage 4; this is
  only a side effect of the staged hand-off and does not change behaviour.
