import express from "express";
import bodyParser from "body-parser";
import { transcodeFromS3 } from "./ffmpegWorker.js";

const app = express();
app.use(bodyParser.json());

app.get("/healthz", (_, res) => res.json({ ok: true, service: "worker" }));

// POST /transcode
app.post("/transcodeW", async (req, res) => {
  const { s3Key, options } = req.body;
  if (!s3Key) return res.status(400).json({ error: "Missing s3Key" });
  try {
    const outputKey = await transcodeFromS3(s3Key, options);
    res.json({ message: "Transcode completed", outputKey });
  } catch (e) {
    console.error("Worker transcode error:", e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Worker service running on ${PORT}`));