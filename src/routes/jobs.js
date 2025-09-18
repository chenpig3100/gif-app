import express from "express";
import fs from "fs";
import path from "path";
import { authMiddleware } from "../middleware/auth.js";
import { transcodeToGif } from "../services/ffmpeg.js";

const router = express.Router();
const DATA_DIR = "data";
const DB_PATH = path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ files: [] }, null, 2));


router.post("/transcode", authMiddleware, async (req, res) => {
    let { fileId, filePath } = req.body;
    const db = loadDB();

    if (fileId) {
        const rec = db.files.find(f => f.id === fileId);
        if (!rec) return res.status(404).json({ error: "File not found" });
        const isOwner = rec.ownerSub === req.user.sub;
        const isAdmin = req.user.role === "admin";
        if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });
        filePath = rec.inputPath;
    }

    if (!filePath) return res.status(400).json({ error: "File path is required" });

    try {
        const outputPath = await transcodeToGif(filePath);

        const idx = db.files.findIndex(f => f.inputPath === filePath);
        if (idx >= 0) {
            db.files[idx].outputPath = outputPath;
            saveDB(db);
        }
        res.json({ status: "done", outputPath, fileId: idx >= 0 ? db.files[idx].id : undefined });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function loadDB() {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}
function saveDB(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export default router;