import "dotenv/config";

import express from "express";
import fileUpload from "express-fileupload";
import { preloadParams, ssmName, getParam } from "./services/aws/params.js";

await preloadParams([
    ssmName("TABLE_NAME"),
    ssmName("S3_BUCKET"),
    ssmName("S3_PREFIX"),
    ssmName("AUTH_MODE"),
    ssmName("COGNITO_USER_POOL_ID"),
    ssmName("COGNITO_CLIENT_ID"),
    ssmName("COGNITO_REGION"),
    ssmName("COGNITO_ISS"),
    ssmName("PEXELS_API_KEY"),
]);

const app = express();
app.use(express.json());
app.use(fileUpload());

const { default: cognitoRoutes } = await import("./routes/auth/cognitoAuth.js");
const { default: fileRoutes } = await import("./routes/files/files.js");
const { default: jobRoutes } = await import("./routes/jobs/jobs.js");
const { default: relatedRoutes } = await import("./routes/related/related.js");

const [region, clientId, ISS, API_KEY] = await Promise.all([
  getParam("COGNITO_REGION"),
  getParam("COGNITO_CLIENT_ID"),
  getParam("COGNITO_ISS"),
  getParam("PEXELS_API_KEY"),
]);
console.log("Loaded from SSM:", { region, clientId, ISS, API_KEY });

// Routes
const v1 = express.Router();

app.use("/api/v1", v1);
v1.use("/auth", cognitoRoutes);
v1.use("/files", fileRoutes);
v1.use("/jobs", jobRoutes);
v1.use("/related", relatedRoutes);

// health check
app.get("/healthz", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

export default app;