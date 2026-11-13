# Requirements Traceability Matrix – CSMQP

Maps SRS requirements to their owner, GitHub issue, pull request, and verification evidence. IDs below use the exact `CSMQP-` prefix from the SRS.

| SRS requirement ID | Requirement summary | Owner | Issue | PR | Verification / test evidence | Status |
|---|---|---|---:|---:|---|---|
| CSMQP-F-040 | Student dashboard: average score, recent quiz results, weak subjects/topics | Bhuvi Bagga | #15 | #30 | 5 analytics tests passed; student dashboard manually checked; backend suite 201 tests passed | Implemented/tested |
| CSMQP-NF-001 | Support up to 500 concurrent users without significant degradation | Bhuvi Bagga | #19 | #30 | Artillery at 5/50/100/250/500 users; 500-user runs had 255 and 76 failures | Tested; target not met at 500 |
| CSMQP-NF-002 | Page-load time p95 ≤ 2 seconds | Bhuvi Bagga | #19 | #30 | Artillery response-time measurements; p95 exceeded 2 seconds at 250 and 500 users | Tested; target not met at higher loads |
| CSMQP-NF-003 | Quiz grading ≤ 1 second | Bhuvi Bagga | #19 | #30 | Artillery grading measurements; p95 exceeded 1 second at 250 and 500 users | Tested; target not met at higher loads |
| CSMQP-F-050 | Administrator can view, block, or delete user accounts | Bhuvi Dange | #17 | #25 | Admin-user test evidence to be added by owner | Pending evidence |
| CSMQP-F-051 | Administrator can moderate/remove reported materials or questions | Bhuvi Dange | #18 | Confirm | Content-moderation test evidence and PR to be confirmed | Pending evidence |
| CSMQP-F-041 | Instructor class-level performance statistics | Bheema Varshini | #16 | Confirm | Instructor analytics test evidence and PR to be confirmed | Pending evidence |
| CSMQP-F-042 | Render performance data using charts and graphs | Bheema Varshini | #16 | Confirm | Chart-rendering test evidence and PR to be confirmed | Pending evidence |
| CSMQP-NF-005 | Responsive interface across desktop/tablet/mobile and target browsers | Bheema Varshini | #21 | Confirm | Browser/device matrix and results to be added | Pending evidence |
| CSMQP-SR-004 | Sanitize user input against XSS, CSRF, and NoSQL injection | Bhuvan M S | #20 | #27 (confirm) | Security test and CI evidence to be added | Pending evidence |
| CSMQP-SR-005 | Enforce TLS 1.2 or higher for client-server communication | Bhuvan M S | #20 | #28 (confirm) | Deployed endpoint/TLS verification evidence to be added | Pending evidence |

## Notes
- Confirm PR-to-issue mappings for other teammates on GitHub before final release.
- The SRS lists CSMQP-NF-001, CSMQP-NF-002, and CSMQP-NF-003 in section 5.
- Do not mark a requirement “passed” merely because a test was run; compare measured results with its acceptance criterion.
- Replace “Pending evidence” only after the responsible teammate supplies verified results.
