import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { cognitoAuth as authMiddleware } from "../../middleware/cognitoAuth.js";
import { createFileRec } from "../../services/filesRepo.js";
import { uploadStream, s3Key } from "../../services/aws/s3.js";
import { getParam } from "../../services/aws/params.js";
import { Readable } from "stream";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const router = express.Router();

// Pexels Trending Videos
router.get("/trending", async (req, res) => {
    const { limit = 10, page = 1 } = req.query;
    const PEXELS_API_KEY = getParam("PEXELS_API_KEY");

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
        res.status(500).json({ error: "Failed to fetch trending videos" });
    }
});

// ingest by Pexels video
router.post("/ingest", authMiddleware, async (req, res) => {
    const { url, origName = "" } = req.body || {};
    if (!url) return res.status(400).json({ error: "url is required" });

    const filename = `${Date.now()}.mp4`;
    const absPath = path.join(UPLOAD_DIR, filename);
    //const relPath = path.join("uploads", filename);
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
    const src = typeof response.data.pipe === "function" ? response.data : Readable.fromWeb(response.data);

    await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(absPath);
        src.pine(ws);
        ws.on("finish", resolve);
        ws.on("error", reject);
    });

    const size = fs.statSync(absPath).size;
    await putObject({
        Key: s3Key("uploads", filename),
        Body: fs.createReadStream(absPath),
        ContentType: response.headers["content-type"] || "video/mp4",
        ContentLength: size,
    });

    try { fs.unlinkSync(absPath); } catch { }
});

// YouTube Trending Videos
// router.get("/trending", async (req, res) => { 
//     const { region = "AU", limit = 10 } = req.query;
//     const API_KEY = process.env.YOUTUBE_API_KEY;

//     try {
//         const  { data } = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
//             params: {
//                 part: "snippet,contentDetails,statistics",
//                 chart: "mostPopular",
//                 regionCode: region,
//                 maxResults: limit,
//                 key: API_KEY,
//             }
//         });

//         const items = data.items.map(item => ({
//             id: item.id,
//             title: item.snippet.title,
//             thumbnails: item.snippet.thumbnails?.medium?.url,
//             channelTitle: item.snippet.channelTitle,
//             viewCount: item.statistics?.viewCount,
//             publishedAt: item.snippet.publishedAt,
//         }));

//         res.json({ items });
//     } catch (error) {
//         console.error("Error fetching trending videos:", error);
//         res.status(500).json({ error: "Failed to fetch trending videos" });
//     }
// });

// Load and save DB

export default router;