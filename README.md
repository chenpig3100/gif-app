

# GIF Processing API

## Project Overview
This project is a **RESTful API** built with **Node.js, Express, and FFmpeg** for uploading, processing, and managing videos. The main feature is converting uploaded or externally sourced videos into **GIF format**.  
The application is containerized with **Docker** and tested with **Postman**.

---

## Core Features
1. **User Authentication (JWT)**
   - Users must log in to obtain a JWT token.  
   - Supports role-based access: *admin* can view all users’ files.

2. **File Upload & Storage**
   - Videos can be uploaded and stored locally (`uploads/`).  
   - Metadata is recorded in `data/db.json` (file ID, owner, size, input/output path, etc.).

3. **CPU-Intensive Processing**
   - Each video can be transcoded into a GIF using **FFmpeg**.  
   - Verified with a custom `load.js` script to generate high CPU load.

4. **REST API**
   - Fully REST-compliant design with `GET`, `POST`, `PATCH`, `DELETE`.  
   - Supports pagination, filtering, and sorting.

5. **Dockerization**
   - The app is packaged in a Docker container.  
   - Images can be pushed to **AWS ECR** and deployed on **EC2**.

---

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` → Obtain JWT token.   

### File Management
- `POST /api/v1/files/upload` → Upload a video.  
- `GET /api/v1/files/mine` → List user’s own files (supports pagination & filtering).  
- `GET /api/v1/files/:id/download` → Download processed file.  
- `DELETE /api/v1/files/:id/upload` → Delete uploaded file and metadata.
- `DELETE /api/v1/files/:id/output` → Delete output file.

### Transcoding
- `POST /api/v1/jobs/transcode` → Convert uploaded video into GIF.  

### External API (Pexels Integration)
- `GET /api/v1/related/trending` → Fetch trending videos from Pexels API.  
- `POST /api/v1/related/ingest` → Download & ingest a Pexels video into the system.  

### Tags
- `PATCH /api/v1/files/:id/tags` → Add or update tags for a file.  

---

## Testing
- API testing is performed with **Postman**.  
- Load testing is performed using `scripts/load.js` to simulate heavy transcoding requests.

---

## Additional Features
- **Extended API Features** → Pagination, filtering, and sorting in queries.  
- **External API** → Integration with **Pexels API** to fetch and ingest trending videos.  
- **Additional Data Types** → Tags and metadata stored in structured JSON.  
- **Custom Processing** → CPU-intensive transcoding workflow using FFmpeg with configurable options.  

---

## How to Run

### Local
```bash
npm install
npm start
```

### Docker
```bash
docker build -t gif-app .
docker run -p 3000:3000 gif-app
```

### Load Test
```bash
node scripts/load.js
```

---

## Deployment
- Docker image pushed to **AWS ECR**.  
- Container pulled and deployed on **EC2 instance**.  

---