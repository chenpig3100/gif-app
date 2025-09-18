import express from "express";
import fileUpload from "express-fileupload";
import authRoutes from "./routes/auth.js";
import fileRoutes from "./routes/files.js";
import jobRoutes from "./routes/jobs.js";
import relatedRoutes from "./routes/related.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(fileUpload());

// Routes
const v1 = express.Router();

app.use("/api/v1", v1);
v1.use("/auth", authRoutes);
v1.use("/files", fileRoutes);
v1.use("/jobs", jobRoutes);
v1.use("/related", relatedRoutes);

// health check
app.get("/healthz", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

export default app;
