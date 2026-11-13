# Performance Testing Report

## 1. Overview

This document describes the performance and load testing conducted for the Collaborative Study Material and Quiz Platform (CSMQP) as part of Sprint 2.

The objective was to evaluate the backend API under increasing user loads and measure response times, quiz grading performance, and system reliability.

### Performance Requirements

| Requirement | Target |
|---|---|
| Maximum HTTP response time | 2 seconds |
| Maximum quiz grading time | 1 second |
| Load testing capacity | Up to 500 virtual users |

## 2. Testing Environment

| Component | Configuration |
|---|---|
| Load testing tool | Artillery |
| Backend | Node.js and Express |
| Database | MongoDB |
| Testing environment | Local development environment |
| Backend port | 5000 |
| Database | Dedicated `csmqp_loadtest` database |
| Virtual users | 5, 50, 100, 250 and 500 |

A separate MongoDB database was used for load testing to avoid affecting the application's regular development data.

## 3. Test Scenario

A complete student quiz workflow was simulated using Artillery.

Each virtual user performed the following operations:

1. **Login:** Authenticate using a student account through `/api/auth/login`.
2. **Fetch quizzes:** Retrieve available quizzes through `/api/quizzes`.
3. **Start quiz:** Start a quiz attempt through `/api/quizzes/:id/start`.
4. **Submit quiz:** Submit answers through `/api/quizzes/:id/submit`.

The test used 500 dedicated student accounts and a separate quiz created specifically for performance testing.

## 4. Test Configuration

Artillery was configured to increase the number of virtual users across different test runs.

Each test used a 30-second arrival phase.

The following load levels were tested:

- 5 virtual users
- 50 virtual users
- 100 virtual users
- 250 virtual users
- 500 virtual users

**Note:** The arrival count represents the number of virtual users scheduled to arrive during the 30-second phase. It does not mean all users were simultaneously active.

## 5. Performance Test Results

### Summary of Results

| Virtual Users | Completed Users | Failed Users | Average HTTP Response | HTTP p95 | Average Grading Time | Grading p95 |
|---:|---:|---:|---:|---:|---:|---:|
| 5 | 5 | 0 | 16.8 ms | 53 ms | 8 ms | 10.1 ms |
| 50 | 50 | 0 | 19.8 ms | 64.7 ms | 7.5 ms | 10.1 ms |
| 100 | 100 | 0 | 20.3 ms | 70.1 ms | 7.3 ms | 16.9 ms |
| 250 | 250 | 0 | 425.6 ms | 2231 ms | 322.4 ms | 1978.7 ms |
| 500 (Run 1) | 245 | 255 | 2708.5 ms | 6702.6 ms | 1316 ms | 5378.9 ms |
| 500 (Run 2) | 424 | 76 | 2553.6 ms | 6838 ms | 2043.5 ms | 6838 ms |

### 5.1 Results at 5 Users

- All 5 virtual users completed successfully.
- No failed virtual users were recorded.
- Average HTTP response time was 16.8 ms.
- Average grading time was 8 ms.

**Observation:** The application performed successfully under a small user load.

### 5.2 Results at 50 Users

- All 50 virtual users completed successfully.
- No failed virtual users were recorded.
- Average HTTP response time was 19.8 ms.
- Average grading time was 7.5 ms.

**Observation:** The application maintained stable performance as the number of users increased to 50.

### 5.3 Results at 100 Users

- All 100 virtual users completed successfully.
- No failed virtual users were recorded.
- Average HTTP response time was 20.3 ms.
- Average grading time was 7.3 ms.

**Observation:** The application continued to handle the simulated workload successfully at 100 users.

### 5.4 Results at 250 Users

- All 250 virtual users completed successfully.
- No failed virtual users were recorded.
- Average HTTP response time was 425.6 ms.
- HTTP p95 response time was 2231 ms.
- Average grading time was 322.4 ms.
- Grading p95 was 1978.7 ms.

**Observation:** The application completed all virtual user workflows, but response-time and grading-time performance at the 95th percentile exceeded the specified targets.

### 5.5 Results at 500 Users

Two separate 500-user tests were conducted.

**First Run:**
- 500 virtual users were created.
- 245 users completed successfully.
- 255 users failed.
- 255 socket timeouts were recorded.
- Average HTTP response time was 2708.5 ms.
- Average grading time was 1316 ms.

**Second Run:**
- 500 virtual users were created.
- 424 users completed successfully.
- 76 users failed.
- 76 socket timeouts were recorded.
- Average HTTP response time was 2553.6 ms.
- Average grading time was 2043.5 ms.

**Observation:** The second run achieved a higher completion rate and fewer socket timeouts. However, both runs exceeded the required average response-time and grading-time limits.

The results indicate that the application experiences performance degradation under heavier workloads.

## 6. Performance Analysis

The results demonstrate the following:

1. The application handled workloads of 5, 50 and 100 virtual users without failed virtual users.
2. At 250 users, all virtual users completed, but tail response times exceeded the performance targets.
3. At 500 users, socket timeouts and failed virtual users were observed.
4. The second 500-user run showed improved completion compared with the first run.
5. The application requires further optimization to consistently meet performance requirements at higher workloads.

## 7. Potential Optimization Areas

The following improvements can be investigated:

- Optimize MongoDB queries and database indexes.
- Review database connection pooling and query execution time.
- Optimize authentication and quiz submission endpoints.
- Reduce unnecessary database operations during quiz grading.
- Introduce caching for frequently accessed quiz data where appropriate.
- Perform additional tests while monitoring CPU, memory and database resource utilization.

These are recommended areas for further investigation and have not yet been verified as the causes of the observed bottlenecks.

## 8. Conclusion

Performance testing was conducted using Artillery to evaluate the CSMQP backend under increasing virtual user loads.

The application successfully completed all simulated workflows at 5, 50 and 100 users. At 250 users, all virtual users completed, although the 95th-percentile response and grading times exceeded the specified targets.

At 500 users, the application experienced socket timeouts and failed virtual users. A second run improved the completion rate from 49% to 84.8%, but the performance requirements were still not met.

Therefore, the performance testing establishes that the application handles smaller workloads successfully, while additional backend and database optimization is required to improve reliability and response times under heavier workloads.