# Project Deviations

## Student Dashboard – Bhuvi Bagga
- **Requirement:** CSMQP-F-040 | **Issue:** #15 | **PR:** #30
- Implemented a student dashboard with quiz statistics, average score, recent results, and weaker topics, backed by an authenticated student analytics API.
- No functional deviation has been reported for the dashboard.

## Performance Load Testing – Bhuvi Bagga
- **Requirements:** CSMQP-NF-001, CSMQP-NF-002, CSMQP-NF-003 | **Issue:** #19 | **PR:** #30
- Artillery tests were run at 5, 50, 100, 250, and 500 virtual users against a dedicated load-testing database.
- At 5, 50, and 100 users, all simulated users completed successfully.
- At 250 users, all users completed, but p95 response-time targets were exceeded.
- At 500 users, socket timeouts and substantial response-time degradation occurred. Two runs completed 245/500 and 424/500 users.
- The 500-user and higher-load latency goals were therefore not demonstrated. Detailed measurements are in `docs/testing/PERFORMANCE.md`.

## Administration – Bhuvi Dange
- **Requirements:** CSMQP-F-050 (admin user management) and CSMQP-F-051 (content moderation).
- **Issues:** #24 and #29. **PRs:** #25 and #31.
- Admin users can search, block, unblock and delete accounts; blocked/deleted accounts lose access. Reported materials/questions can be removed or their report dismissed. Admin restrictions prevent blocking or deleting administrator accounts.
- Detailed deviations were not provided in the available feature notes; this is a functional summary, not a claim that every acceptance detail has been audited.

## Instructor Analytics and Cross-Browser Verification – Bheema Varshini
- **Requirements:** CSMQP-F-041, CSMQP-F-042, CSMQP-NF-005.
- **Issues:** #16 (instructor analytics) and #21 (cross-browser verification).
- No matching merged PR was found in the available repository history. Confirm implementation and test evidence with the owner before marking these items complete.

## CI/CD, Deployment, and Security – Bhuvan M S
- **Requirements:** CSMQP-SR-004 and CSMQP-SR-005, plus CI/CD and deployment work.
- **Issue:** #26. **PRs:** #27 and #28. CI runs on all branch pushes and PRs to `main`, uploads coverage artifacts, and the README contains a CI badge. Login lockout allows five failed password attempts and blocks the sixth for 15 minutes. CORS uses an exact allow-list.
- **Deployment:** The planned Render backend was replaced for the live demo by Railway; `render.yaml` remains an inactive, Render-specific blueprint. The live frontend is Vercel and the API is Railway. Railway's HTTP endpoint redirects to HTTPS; the health endpoint and Vercel-origin CORS preflight were checked on 2026-11-13.
- **Security/design notes:** JWT is sent in an Authorization header, not a cookie, so the app does not rely on cookie-based CSRF tokens; input sanitization and tests are documented in the Sprint 1 deviations. TLS terminates at the hosting edge and must be verified against the live endpoint, not only an in-process Express test.
- **Demo limitations:** Railway has no persistent volume or external object store configured, so uploaded materials are temporary. For Atlas connectivity from Railway free hosting, Atlas currently allows `0.0.0.0/0`; use strong database credentials and remove this broad entry after the demo or replace it with an appropriate narrower option. Login-lockout counters are in-memory and reset on process restart.

## Summary
The confirmed performance deviation is that the 250- and 500-user runs did not meet all stated performance targets. Instructor analytics and cross-browser verification still need owner evidence before they can be considered complete.
