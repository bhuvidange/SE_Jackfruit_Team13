# Software Test Report – CSMQP

## 1. Student Dashboard – Bhuvi Bagga
- **Requirement:** CSMQP-F-040 | **Issue / PR:** #15 / #30
- Analytics endpoint tests: **5 passed**.
- Complete backend Jest suite: **14 test suites passed; 201 tests passed**.
- Manual verification: dashboard checked with a student account, displaying quiz count, average score, recent result, and weak topic.

## 2. Performance Load Testing – Bhuvi Bagga
- **Requirements:** CSMQP-NF-001, CSMQP-NF-002, CSMQP-NF-003 | **Issue / PR:** #19 / #30
- **Tool:** Artillery
- **Scenario:** student login → fetch quizzes → start quiz → submit answers.
- **Environment:** dedicated local MongoDB database `csmqp_loadtest`; generated load-test credentials/data were excluded from Git.

| Virtual users | Completed | Failed | HTTP average | HTTP p95 | Grading average | Grading p95 |
|---:|---:|---:|---:|---:|---:|---:|
| 5 | 5 | 0 | 16.8 ms | 53 ms | 8 ms | 10.1 ms |
| 50 | 50 | 0 | 19.8 ms | 64.7 ms | 7.5 ms | 10.1 ms |
| 100 | 100 | 0 | 20.3 ms | 70.1 ms | 7.3 ms | 16.9 ms |
| 250 | 250 | 0 | 425.6 ms | 2231 ms | 322.4 ms | 1978.7 ms |
| 500 – Run 1 | 245 | 255 | 2708.5 ms | 6702.6 ms | 1316 ms | 5378.9 ms |
| 500 – Run 2 | 424 | 76 | 2553.6 ms | 6838 ms | 2043.5 ms | 6838 ms |

### Interpretation against the SRS
- **CSMQP-NF-001:** 500-user runs had failures/timeouts; support for 500 users without significant degradation was not demonstrated.
- **CSMQP-NF-002:** p95 response time exceeded the 2-second target at 250 and 500 users.
- **CSMQP-NF-003:** p95 grading time exceeded the 1-second target at 250 and 500 users.
- The load profile scheduled virtual users over 30 seconds; this should not be described as 500 simultaneous active requests.

## 3. Other Team Features – Evidence to Complete
The following assignments are known, but their detailed test commands, test counts, and outcomes were not available when this report was prepared. Each owner should add verified evidence.

| Owner | Feature / requirement | Issue | PR known | Evidence to add |
|---|---|---:|---:|---|
| Bhuvi Dange | Admin user management – CSMQP-F-050 | #17 | #25 | Test names/counts/results and manual checks |
| Bhuvi Dange | Content moderation – CSMQP-F-051 | #18 | Confirm | Test names/counts/results and manual checks |
| Bheema Varshini | Instructor analytics – CSMQP-F-041, F-042 | #16 | Confirm | Test names/counts/results and manual checks |
| Bheema Varshini | Cross-browser – CSMQP-NF-005 | #21 | Confirm | Browsers/devices tested and outcomes |
| Bhuvan M S | CI/CD, deployment/security – CSMQP-SR-004, SR-005 | #20 | #27/#28; confirm mapping | CI run, deployment verification, TLS/security evidence |

## 4. Overall Result
The backend automated suite passed with 201 tests. Student dashboard checks passed. Load testing completed without failures at 5, 50, and 100 users; 250- and 500-user workloads exposed response-time and reliability limitations. Complete the other owners’ evidence before marking this report final.
