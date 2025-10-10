import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { authMiddleware } from "../middleware/auth.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const DATA_DIR = "data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DATA_PATH = path.join(DATA_DIR, "db.json");
if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, JSON.stringify({ files: [] }, null, 2));

const router = express.Router();

// Pexels Trending Videos
router.get("/trending", async (req, res) => {
    const { limit = 10, page = 1 } = req.query;
    const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

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
            const mp4 = (item.video_files || []).find(f => f.file_type === "video/mp4");
            const thumb = (item.video_pictures || [])[0]?.picture || item.image;
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
    const { url, origName } = req.body || {};
    if (!url) return res.status(400).json({ error: "url is required" });

    try {
        const filename = `${Date.now()}.mp4`;
        const absPath = path.join(UPLOAD_DIR, filename);
        const relPath = path.join("uploads", filename);

        const response = await axios.get(url, {
            responseType: "stream",
            timeout: 30_000,
            maxBodyLength: Infinity,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                Referer: "https://www.pexels.com/",
                Accept: "video/*,application/octet-stream;q=0.9,*/*;q=0.8",
            },
            validateStatus: (s) => s >= 200 && s < 400,
        });

        const ct = String(response.headers["content-type"] || "");
        if (!ct.startsWith("video/")) {
            let sniff = "";
            for await (const chunk of response.data) {
                sniff += chunk.toString("utf8", 0, 256);
                break;
            }
            return res
                .status(415)
                .json({ error: `Not a video (content-type=${ct})`, sample: sniff.slice(0, 80) });
        }

        await new Promise((resolve, reject) => {
            const fileStream = fs.createWriteStream(absPath);
            response.data.pipe(fileStream);
            fileStream.on("finish", resolve);
            fileStream.on("error", reject);
        });

        const fd = fs.openSync(absPath, "r");
        const buf = Buffer.alloc(16);
        fs.readSync(fd, buf, 0, 16, 0);
        fs.closeSync(fd);
        if (!buf.includes(Buffer.from("ftyp"))) {
            try { fs.unlinkSync(absPath); } catch {}
            return res.status(422).json({ error: "Downloaded file is not a valid MP4 (no ftyp)" });
        }

        // Save record to DB
        const size = fs.statSync(absPath).size;
        const db = loadDB();
        const rec = {
            id: genId(),
            ownerSub: req.user?.sub || "unknown",
            origName: origName || filename,
            mime: ct,
            size,
            inputPath: relPath,
            outputPath: null,
            createdAt: new Date().toISOString(),
            tags: [],
        };
        db.files.unshift(rec);
        saveDB(db);

        // OK
        res.json({
            message: "video ingested successfully",
            inputPath: relPath,
            origName: rec.origName,
            size: rec.size,
            contentType: ct,
            fileId: rec.id,
        });
    } catch (err) {
        console.error("ingest error:", err.message);
        return res.status(502).json({ error: "Failed to ingest video" });
    }
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
function loadDB() {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
};

function saveDB(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
};

function genId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export default router;