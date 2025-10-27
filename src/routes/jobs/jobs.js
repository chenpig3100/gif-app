import express from "express";
import { cognitoAuth as authMiddleware } from "../../middleware/cognitoAuth.js";
import { getById } from "../../services/filesRepo.js";
import { sendJobToQueue } from "../../services/aws/sqs.js";

const router = express.Router();

/**
 * Resolve an S3 key (inputPath) from body params and enforce auth when fileId is used.
 * Supports any one of: { fileId } OR { filePath } OR { s3Key } in the request body.
 * - fileId: loads record, checks ownership/admin, uses rec.inputPath as s3Key
 * - filePath/s3Key: treated as the S3 object key directly
 */
async function resolveS3KeyAndAuthorize(req, res) {
  const { fileId, filePath, s3Key } = req.body || {};

  // If client directly provides s3Key, accept it (no DB fetch)
  if (s3Key) return { s3Key, fileId: null };

  let rec = null;
  let key = filePath || null; // In this project, filePath already represents an S3 key

  if (fileId) {
    rec = await getById(fileId);
    if (!rec) {
      res.status(404).json({ error: "File not found" });
      return null;
    }

    const isOwner = rec["qut-username"] === req.user.sub;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: "Forbidden" });
      return null;
    }

    key = rec.inputPath;
  }

  if (!key) {
    res.status(400).json({ error: "fileId, filePath or s3Key is required" });
    return null;
  }

  return { s3Key: key, fileId: fileId || null };
}

// Safely coerce header values to numbers; returns undefined on failure
function toNum(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * POST /jobs/transcode (and /jobs/transcodeW for backward compatibility)
 * Queues a transcode job to SQS instead of calling the worker directly.
 * Options precedence: defaults < body.options < headers (x-gif-duration|fps|width)
 */
async function enqueueTranscode(req, res) {
  const resolved = await resolveS3KeyAndAuthorize(req, res);
  if (!resolved) return;

  const { s3Key, fileId } = resolved;

  // 1) defaults
  const defaults = { duration: 5, fps: 10, width: 320 };

  // 2) from body
  const bodyOptions = (req.body && req.body.options) ? req.body.options : {};

  // 3) header overrides (express lower-cases header names)
  const hdr = req.headers || {};
  const headerOptions = {
    duration: toNum(hdr["x-gif-duration"]),
    fps: toNum(hdr["x-gif-fps"]),
    width: toNum(hdr["x-gif-width"]),
  };

  // Merge with precedence: defaults < body < headers (ignore undefined)
  const merged = {
    ...defaults,
    ...(bodyOptions || {}),
    ...Object.fromEntries(Object.entries(headerOptions).filter(([, v]) => v !== undefined)),
  };

  const job = {
    type: "transcode",
    s3Key,
    options: merged,
    fileId,
    requestedBy: req.user?.sub,
    requestedAt: Date.now(),
  };

  try {
    const resp = await sendJobToQueue(job);
    console.log("Job queued:", job); // for debugging/verification
    return res.status(202).json({
      status: "queued",
      s3Key,
      fileId,
      options: merged,
      messageId: resp?.MessageId,
    });
  } catch (e) {
    console.error("Queue enqueue error:", e);
    return res.status(500).json({ error: "Failed to enqueue job" });
  }
}

router.post("/transcode", authMiddleware, enqueueTranscode);
router.post("/transcodeW", authMiddleware, enqueueTranscode); // alias for compatibility

export default router;