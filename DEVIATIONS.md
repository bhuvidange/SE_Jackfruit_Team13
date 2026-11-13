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
- The 500-user and higher-load latency goals were therefore not demonstrated. Detailed measurements are in `PERFORMANCE.md`.

## Administration – Bhuvi Dange
- **Requirements:** CSMQP-F-050 (admin user management) and CSMQP-F-051 (content moderation).
- **Issues:** #17 and #18. Known branch: `feature/29-content-moderation`. PR #25 is associated with admin-user work.
- Add verified deviations here, or state “No known deviation” after checking the completed features.

## Instructor Analytics and Cross-Browser Verification – Bheema Varshini
- **Requirements:** CSMQP-F-041, CSMQP-F-042, CSMQP-NF-005.
- **Issues:** #16 (instructor analytics) and #21 (cross-browser verification).
- Add verified deviations here, or state “No known deviation” after checking the completed features.

## CI/CD, Deployment, and Security – Bhuvan M S
- **Requirements:** CSMQP-SR-004 and CSMQP-SR-005, plus CI/CD and deployment work.
- **Issue:** #20. PRs #27 and #28 are recorded in the project history; confirm their exact scope.
- Add verified deviations and deployment/security limitations here.

## Summary
The confirmed performance deviation is that the 250- and 500-user runs did not meet all stated performance targets. Other owners must complete their sections from implementation evidence before this file is considered final.
