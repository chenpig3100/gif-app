import express from "express";
import axios from "axios";
import { cognitoAuth as authMiddleware } from "../../middleware/cognitoAuth.js";
import { createFileRec } from "../../services/filesRepo.js";
import { s3Key, putObject } from "../../services/aws/s3.js";
import { getParam } from "../../services/aws/params.js";
import { sendJobToQueue } from "../../services/aws/sqs.js";

const router = express.Router();

// Pexels Trending Videos
router.get("/trending", async (req, res) => {
    const { limit = 10, page = 1 } = req.query;
    const PEXELS_API_KEY = await getParam("PEXELS_API_KEY");
    if (!PEXELS_API_KEY) {
      return res.status(500).json({ error: "PEXELS_API_KEY not configured" });
    }
    try {
        const { data } = await axios.get("https://api.pexels.com/videos/popular", {
            params: {
                per_page: limit,
                page,
            },
            headers: {
                Authorization: PEXELS_API_KEY,
            }
        });

        const items = data.videos.map(item => {
            const mp4 = (item.video_files || []).find(f => f.file_type === "video/mp4") || null;
            const thumb = (item.video_pictures || [])[0]?.picture || item.image || null;
            return {
                id: String(item.id),
                provider: "pexels",
                title: item.user?.name || `Video ${item.id}`,
                duration: item.duration,
                width: item.width,
                height: item.height,
                thumbnails: thumb,
                downloadUrl: mp4?.link || null,
                sourceUrl: item.url,
            };
        });

        res.json({ items });
    } catch (error) {
        console.error("Error fetching trending videos:", error);
        return res.status(502).json({ error: "Failed to fetch trending videos" });
    }
});

// ingest by Pexels video
router.post("/ingest", authMiddleware, async (req, res) => {
    try {
      const { url, origName = "" } = req.body || {};
      if (!url) return res.status(400).json({ error: "url is required" });

      const filename = `${Date.now()}.mp4`;
      const key = s3Key("uploads", filename);

      const response = await axios.get(url, {
        responseType: "stream",
        timeout: 30000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Referer: "https://www.pexels.com/",
          Accept: "video/*,application/octet-stream;q=0.9,*/*;q=0.8",
        },
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const contentType = String(response.headers["content-type"] || "");
      if (!contentType.startsWith("video/")) {
        // sniff a tiny chunk for debugging context
        let sniff = "";
        for await (const chunk of response.data) { sniff += chunk.toString("utf8", 0, 128); break; }
        return res.status(415).json({ error: `Not a video (content-type=${contentType})`, sample: sniff.slice(0, 80) });
      }

      const rawLen = response.headers["content-length"];
      const contentLength = Number.isFinite(Number(rawLen)) ? Number(rawLen) : undefined;

      // Buffer the stream into memory before upload (simple, safe for moderate file sizes)
      const chunks = [];
      for await (const chunk of response.data) chunks.push(chunk);
      const fileBuffer = Buffer.concat(chunks);

      await putObject({
        Key: key,
        Body: fileBuffer,
        ContentType: contentType || "video/mp4",
        ...(contentLength ? { ContentLength: contentLength } : {}),
      });

      let jobQueued = false;
      const owner = req.user?.sub || (await getParam("QUT_USERNAME"));
      const rec = {
        "qut-username": owner,
        createdAt: new Date().toISOString(),
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        origName: origName || filename,
        mime: contentType || "video/mp4",
        size: contentLength ?? fileBuffer.length,
        inputPath: key,
        outputPath: null,
        tags: [],
      };
      await createFileRec(rec);

      // enqueue a transcode job via SQS (non-blocking if SQS fails)
      try {
        await sendJobToQueue({
          type: "transcode",
          s3Key: key,
          options: {},          // add transcode options here if needed
          requestedBy: owner,   // who requested the job
        });
        jobQueued = true;
      } catch (e) {
        console.error("SQS enqueue failed:", e?.message || e);
      }

      return res.json({ ok: true, key, filename, size: rec.size, file: rec, jobQueued });
    } catch (err) {
      console.error("/related/ingest error:", err?.message || err);
      return res.status(502).json({ error: "Failed to ingest video" });
    }
  });

export default router;