import express from "express";
import axios from "axios";
import { cognitoAuth as authMiddleware } from "../../middleware/cognitoAuth.js";
import { getById, updateOutputPathById } from "../../services/filesRepo.js";
import { s3Key, getObjectStream, putObject } from "../../services/aws/s3.js";
import { transcodeToGifStream } from "../../services/ffmpeg.js";

const router = express.Router();

function baseNameNoExt(key) {
  const name = (key || "").split("/").pop() || `file-${Date.now()}`;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

router.post("/transcode", authMiddleware, async (req, res) => {
  const { fileId, filePath: bodyFilePath } = req.body;
  if (!fileId && !bodyFilePath) {
    return res.status(400).json({ error: "fileId or filePath is required" });
  }

  try {
    let rec = null;
    let filePath = bodyFilePath || null;

    if (fileId) {
      rec = await getById(fileId);
      if (!rec) return res.status(404).json({ error: "File not found" });

      const isOwner = rec["qut-username"] === req.user.sub;
      const isAdmin = req.user.role === "admin";
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      filePath = rec.inputPath;
    }

    if (!filePath) {
      return res.status(400).json({ error: "File path is required" });
    }

    const { stream: inputStream } = await getObjectStream(filePath);

    // Transcode directly in memory
    const gifKey = s3Key("outputs", `${baseNameNoExt(filePath)}.gif`);
    const { stream: gifStream } = transcodeToGifStream(inputStream, {
      duration: 5,
      fps: 10,
      width: 320,
    });

    // Buffer the GIF stream before uploading to S3 to avoid streaming upload errors
    const chunks = [];
    for await (const chunk of gifStream) {
      chunks.push(chunk);
    }
    const gifBuffer = Buffer.concat(chunks);

    await putObject({
      Key: gifKey,
      Body: gifBuffer,
      ContentType: "image/gif",
    });

    if (fileId) {
      await updateOutputPathById(fileId, gifKey);
    }

    return res.json({ status: "done", outputPath: gifKey, fileId: fileId || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Transcode failed" });
  }
});

router.post("/transcodeW", authMiddleware, async (req, res) => {
  const { s3Key } = req.body;
  try {
    const workerUrl = process.env.WORKER_URL || "http://localhost:4000/transcode";
    const resp = await axios.post(workerUrl, { s3Key });
    res.json(resp.data);
  } catch (e) {
    console.error("API → Worker error:", e.message);
    res.status(500).json({ error: "Failed to reach worker-service" });
  }
});

export default router;