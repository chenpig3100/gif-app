Assignment 2 - Cloud Services Exercises - Response to Criteria
================================================

Instructions
------------------------------------------------
- Keep this file named A2_response_to_criteria.md, do not change the name
- Upload this file along with your code in the root directory of your project
- Upload this file in the current Markdown format (.md extension)
- Do not delete or rearrange sections.  If you did not attempt a criterion, leave it blank
- Text inside [ ] like [eg. S3 ] are examples and should be removed


Overview
------------------------------------------------

- **Name:** Wu-Hsian, Chen
- **Student number:** n11740388
- **Partner name (if applicable):** Wai Lap (William) Cham
- **Application name:** gif-app
- **Two line description:** A RESTful backend that ingests or uploads videos, transcodes them to GIF using FFmpeg, and serves them via authenticated endpoints. Users can manage their own files (list, search, tag, delete), while admins can view all users’ files.
- **EC2 instance name or ID:** i-01c17ae02d2034a3e

------------------------------------------------

### Core - First data persistence service

- **AWS service name:**  S3
- **What data is being stored?:** Uploaded video files (MP4)
- **Why is this service suited to this data?:** S3 is well-suited for storing large unstructured binary files (blobs). It provides durability, scalability, and cost efficiency, making it ideal for user-uploaded videos.
- **Why is are the other services used not suitable for this data?:** DynamoDB and RDS are not suitable for storing large binary objects due to size limits and higher costs for such data.
- **Bucket/instance/table name:** n11740388-uploads
- **Video timestamp:**
- **Relevant files:**
    - src/routes/related.js
    - src/services/s3.js

### Core - Second data persistence service

- **AWS service name:**  DynamoDB
- **What data is being stored?:** Video metadata such as title, duration, thumbnail URL, and S3 download URL.
- **Why is this service suited to this data?:** DynamoDB is optimized for fast key-value lookups and scalable storage of structured metadata. Using the video ID as the primary key allows efficient CRUD operations.
- **Why is are the other services used not suitable for this data?:**  S3 can store JSON but does not support efficient queries. RDS requires more complex schema management, which is unnecessary for simple metadata.
- **Bucket/instance/table name:** n11740388-files
- **Video timestamp:**
- **Relevant files:**
    - src/routes/related.js 
    - src/services/s3.js

### Third data service

- **AWS service name:**  [eg. RDS]
- **What data is being stored?:** [eg video metadata]
- **Why is this service suited to this data?:** [eg. ]
- **Why is are the other services used not suitable for this data?:** [eg. Advanced video search requires complex querries which are not available on S3 and inefficient on DynamoDB]
- **Bucket/instance/table name:**
- **Video timestamp:**
- **Relevant files:**
    -

### S3 Pre-signed URLs

- **S3 Bucket names:**
- **Video timestamp:**
- **Relevant files:**
    -

### In-memory cache

- **ElastiCache instance name:**
- **What data is being cached?:** [eg. Thumbnails from YouTube videos obatined from external API]
- **Why is this data likely to be accessed frequently?:** [ eg. Thumbnails from popular YouTube videos are likely to be shown to multiple users ]
- **Video timestamp:**
- **Relevant files:**
    -

### Core - Statelessness

- **What data is stored within your application that is not stored in cloud data services?:** Temporary local files, such as downloaded video chunks before uploading to S3.
- **Why is this data not considered persistent state?:** These files can be recreated from their source (e.g., re-downloaded from Pexels API or S3) if lost, so they are not persistent.
- **How does your application ensure data consistency if the app suddenly stops?:** The application is designed to be stateless, with all persistent data stored in cloud services (S3, DynamoDB, Parameter Store). PM2 is used as a process manager to automatically restart the application, ensuring the app reloads parameters and data from cloud storage.
- **Relevant files:**
    - ecosystem.config.js

### Graceful handling of persistent connections

- **Type of persistent connection and use:** [eg. server-side-events for progress reporting]
- **Method for handling lost connections:** [eg. client responds to lost connection by reconnecting and indicating loss of connection to user until connection is re-established ]
- **Relevant files:**
    -


### Core - Authentication with Cognito

- **User pool name:** User pool - gif-app
- **How are authentication tokens handled by the client?:** The client receives authentication tokens (ID token, Access token, Refresh token) from Cognito after a successful login request. These tokens are stored client-side and included in the Authorization: Bearer <token> header for subsequent API requests.
- **Video timestamp:**
- **Relevant files:**
    - src/routes/cognitoAuth.js
    - src/middleware/cognitoAuth.js

### Cognito multi-factor authentication

- **What factors are used for authentication:** [eg. password, SMS code]
- **Video timestamp:**
- **Relevant files:**
    -

### Cognito federated identities

- **Identity providers used:**
- **Video timestamp:**
- **Relevant files:**
    -

### Cognito groups

- **How are groups used to set permissions?:** [eg. 'admin' users can delete and ban other users]
- **Video timestamp:**
- **Relevant files:**
    -

### Core - DNS with Route53

- **Subdomain**:  [eg. myawesomeapp.cab432.com]
- **Video timestamp:**

### Parameter store

- **Parameter names:** 
    - /gif-app/AUTH_MODE
    - /gif-app/COGNITO_CLIENT_ID
    - /gif-app/COGNITO_REGION
    - /gif-app/COGNITO_USER_POOL_ID
    - /gif-app/PEXELS_API_KEY
    - /gif-app/PEXELS_API_URL
    - /gif-app/S3_BUCKET
    - /gif-app/TABLE_NAME
    - /gif-app/COGNITO_ISS
    - /gif-app/S3_PREFIX
- **Video timestamp:**
- **Relevant files:**
    - src/services/params.js
    - src/routes/cognitoAuth.js
    - src/routes/related.js

### Secrets manager

- **Secrets names:** [eg. n1234567-youtube-api-key]
- **Video timestamp:**
- **Relevant files:**
    -

### Infrastructure as code

- **Technology used:**
- **Services deployed:**
- **Video timestamp:**
- **Relevant files:**
    -

### Other (with prior approval only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -

### Other (with prior permission only)

- **Description:**
- **Video timestamp:**
- **Relevant files:**
    -