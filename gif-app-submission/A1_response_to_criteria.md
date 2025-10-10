Assignment 1 - REST API Project - Response to Criteria
================================================

Overview
------------------------------------------------

- **Name:** Wu-Hsuan(Bryan) Chen
- **Student number:** n11740388
- **Application name:** GIFTrans
- **Two line description:** A RESTful backend that ingests or uploads videos, transcodes them to GIF using FFmpeg, and serves them via authenticated endpoints. Users can manage their own files (list, search, tag, delete), while admins can view all users’ files.


Core criteria
------------------------------------------------

### Containerise the app

- **ECR Repository name:** gif-app
- **Video timestamp:** 00:38
- **Relevant files:**
    - Dockerfile
    - .dockerignore

### Deploy the container

- **EC2 instance ID:** i-00965624be0a21c39
- **Video timestamp:** 01:05

### User login

- **One line description:** JWT-based login with role claims (user/admin); tokens required on protected routes; owner vs. admin authorization enforced.
- **Video timestamp:** 02:20
- **Relevant files:**
    - src/routes/auth.js
    - src/middleware/auth.js
    - .env(JWT_SECRET)

### REST API

- **One line description:** Resource-oriented API for files, jobs, and related content; uses standard HTTP verbs (GET/POST/PATCH/DELETE), status codes, and auth headers.
- **Video timestamp:** 01:48
- **Relevant files:**
    - src/app.js
    - src/routes/jobs.js
    - src/routes/files.js
    - src/routes/related.js
    - src/utils/query.js
    - src/middleware/auth.js

### Data types

- **One line description:** Stores unstructured media (videos/GIFs) and structured JSON metadata (separate from login data).
- **Video timestamp:** 03:18
- **Relevant files:**
    - uploads/
    - outputs/
    - data/db.js
    - src/routes/files.js (read/write)
    - src/routes/related.js (read/write)

#### First kind

- **One line description:** Unstructured media artifacts for the pipeline.
- **Type:** Files on disk — MP4 inputs in uploads/, GIF outputs in outputs/.
- **Rationale:** Source/derived binaries are large and only referenced by path; no ACID needs.
- **Video timestamp:** 03:18
- **Relevant files:**
    - uploads/, outputs/
    - src/services/ffmpeg.js
    src/routes/jobs.js

#### Second kind

- **One line description:** Structured metadata describing ownership, tags, sizes, and file paths.
- **Type:** JSON document (data/db.json).
- **Rationale:** Enables search/filtering, access control, and linking input/output; simple to back up and migrate later.
- **Video timestamp:** 03:18
- **Relevant files:**
  - data/db.js
  - src/routes/files.js
  - src/routes/related.js

### CPU intensive task

 **One line description:** FFmpeg-based video→GIF transcoding (scale=320:-1, fps=10, pix_fmt=rgb24) executed via child process; concurrency-limited to stabilize load.
- **Video timestamp:** 00:28
- **Relevant files:**
    - src/services/ffmpeg.js
    - src/routes/jobs.js
    - outputs/

### CPU load testing

 **One line description:** scripts/load.js hammers /jobs/transcode with configurable TOTAL_JOBS and CONCURRENCY to sustain high CPU usage.
- **Video timestamp:** 05:55
- **Relevant files:**
    - scripts/load.js

Additional criteria
------------------------------------------------

### Extensive REST API features

- **One line description:** Implemented pagination, sorting, and rich filtering on GET /files/mine; supports q, tag filters (tags, tagsMode=any|all), size/time ranges, hasOutput, and cursor pagination. Admin lists all users; regular users see only their own.
- **Video timestamp:** 03:18
- **Relevant files:**
    - src/routes/files.js (query params: limit, cursor, sort, order, q, hasOutput, from, to, minSize, maxSize, tags, tagsMode)

### External API(s)

- **One line description:** Integrated Pexels Videos API: discover trending (GET /related/trending) and ingest selected MP4 into local storage (POST /related/ingest) with auth and type sniffing.
- **Video timestamp:** 04:50
- **Relevant files:**
    - src/routes/related.js
    - .env

### Additional types of data

- **One line description:** Adds user-defined tags (array) and source provenance for ingested assets; tags are mutable via partial updates.
- **Video timestamp:** 05:14
- **Relevant files:**
    - src/routes/files.js (PATCH /files/:id/tags)
    - src/routes/related.js (records ingested entires)

### Custom processing

- **One line description:** Custom FFmpeg invocation via spawn plus server-side concurrency gate (MAX_ACTIVE) to avoid overload under load; optional two-step clean/transcode flow explored.
- **Video timestamp:** 00:28
- **Relevant files:**
    - src/services/ffmpeg.js
    - src/routes/job.js

### Infrastructure as code

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 

### Web client

- **One line description:**
- **Video timestamp:**
- **Relevant files:**
    -   

### Upon request

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**
    - 