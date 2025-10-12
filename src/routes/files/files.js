import express from "express";
import fs from "fs";
import path from "path";
import { cognitoAuth as authMiddleware } from "../../middleware/cognitoAuth.js";
import { parseBool, parseNumber, parseData, buildLinkHeader } from "../../utils/query.js.js";
import { createFileRec, getById, listMine, updateTags, deleteRecordById, updateOutputPathById } from "../../services/filesRepo.js.js";
import { error } from "console";
import { putObject, s3Key, getSigned, deleteObject } from "../../services/aws/s3.js";
import { getParam } from "../../services/aws/params.js"

const router = express.Router();

// const uploadDir = "uploads";
// if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// const DATA_DIR = "data";
// if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// const DATA_PATH = path.join(DATA_DIR, "db.json");
// if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, JSON.stringify({ files: [] }, null, 2));

router.post("/upload", authMiddleware, async (req, res) => {
    if (!req.files || !req.files.video) {
        return res.status(400).json({ message: "No video file uploaded." });
    }
    const video = req.files.video;
    const safeBase = String(video.name).replace(/\s+/g, "_");
    const key = s3Key("uploads", `${Date.now()}-${safeBase}`);

    try {
        await putObject({
            Key: key,
            Body: video.data ?? video,
            ContentType: video.mimetype || "video/mp4",
        });

        const rec = {
            "qut-username": req.user?.sub || getParam("QUT_USERNAME"),
            createdAt: new Date().toISOString(),
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            origName: video.name,
            mime: video.mimetype || "video/mp4",
            size: video.size,
            inputPath: key,
            outputPath: null,
            tags: [],
        };

        await createFileRec(rec);
        res.json({ message: "Video uploaded successfully", fileId: rec.id, filePath: key });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to persist metadata" });
    }
});

//List
router.get("/mine", authMiddleware, async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

    let cursor = undefined;
    if (req.query.cursor) {
        try { cursor = JSON.parse(Buffer.from(req.query.cursor, "base64").toString("utf8")); } catch { }
    }

    const user = req.user?.sub || getParam("QUT_USERNAME");
    const { items, nextCursor } = await listMine(user, { limit, cursor });

    if (nextCursor) {
        const encoded = Buffer.from(JSON.stringify(nextCursor)).toString("base64");
        res.setHeader("X-Next-Cursor", encoded);
    }
    res.json({ data: items, meta: { limit, nextCursor: nextCursor ? "set" : null } });
});

// Download
// router.get("/:id/download", authMiddleware, (req, res) => {
//     const db = loadDB();
//     const file = db.files.find(f => f.id === req.params.id);
//     if (!file) return res.status(404).send("Not found");

//     const isOwner = file.ownerSub === req.user.sub;
//     const isAdmin = req.user.role === "admin";
//     if (!isOwner && !isAdmin) return res.status(403).send("Forbidden");

//     const p = file.outputPath || file.inputPath;
//     if (!p || !fs.existsSync(p)) return res.status(404).send("File missing");

//     const suggested = file.outputPath ?
//         file.origName.replace(/\.[^.]+$/, ".gif") :
//         file.origName;
//     res.setHeader("Content-Disposition", `attachment; filename="${suggested}"`);
//     return res.download(p, path.basename(p));
// });

router.get("/:id/download", authMiddleware, async (req, res) => {
    const rec = await getById(req.params.id);
    if (!rec) return res.status(404).send("Not found");

    const isOwner = rec["qut-username"] === (req.user?.sub || getParam("QUT_USERNAME"));
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).send("Forbidden");
    const key = rec.outputPath || rec.inputPath;
    if (!key) return res.status(404).send("File missing");

    const url = await getSigned({ Key: key, expiresIn: 3600 });
    res.json({ url, filename: rec.origName.replace(/\.[^.]+$/, rec.outputPath ? ".gif" : "") });
});

// Patch
router.patch("/:id/tags", authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { tags } = req.body;

        if (!Array.isArray(tags)) {
            return res.status(400).json({ error: "tags must be an array" });
        }
        const out = await updateTags(id, tags);
        res.json({ message: "ok", id, tags: out.tags });
    } catch (err) {
        if (String(err.message).includes("File not found")) {
            return res.status(404).json({ error: "File not found" });
        }
        console.error("updateTags error:", err);
        res.status(500).json({ error: "Failed to update tags" });
    }
});

// Delete uploaded video
// router.delete("/:id/upload", authMiddleware, (req, res) => {
//     const db = loadDB();
//     const idx = db.files.findIndex(f => f.id === req.params.id);
//     if (idx === -1) return res.status(404).json({ error: "Not found" });


//     const file = db.files[idx];
//     const isOwner = file.ownerSub === req.user.sub;
//     const isAdmin = req.user.role === "admin";
//     if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });

//     const p = file.inputPath;
//     if (p && fs.existsSync(p)) {
//         try {
//             fs.unlinkSync(p); // delete physical file
//         } catch (e) {
//             console.warn("Failed to delete file:", e.message);
//         }
//     }

//     // delete record from DB
//     db.files.splice(idx, 1);
//     saveDB(db);

//     return res.json({ message: "Upload and DB record deleted", id: req.params.id });
// });

router.delete("/:id/upload", authMiddleware, async (req, res) => {
    const rec = await getById(req.params.id);
    if (!rec) return res.status(404).json({ error: "Not found" });

    const isOwner = rec["qut-username"] === (req.user?.sub || getParam("QUT_USERNAME"));
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });

    if (rec.inputPath) {
        try { await deleteObject({ Key: rec.inputPath }); } catch { }
    }
    if (rec.outputPath) {
        try { await deleteObject({ Key: rec.outputPath }); } catch { }
    }

    await deleteRecordById(req.params.id);
    return res.json({ message: "Upload and DB record deleted", id: req.params.id });
});

// Delete generated GIF
// router.delete("/:id/output", authMiddleware, (req, res) => {
//     const db = loadDB();
//     const file = db.files.find(f => f.id === req.params.id);
//     if (!file) return res.status(404).json({ error: "Not found" });

//     const isOwner = file.ownerSub === req.user.sub;
//     const isAdmin = req.user.role === "admin";
//     if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });

//     const p = file.outputPath;
//     if (!p) return res.status(404).json({ error: "No output to delete" });
//     try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { /* ignore */ }
//     file.outputPath = null;
//     saveDB(db);
//     return res.json({ message: "Output deleted", id: file.id });
// });



// Load and save DB
// function loadDB() {
//     return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
// }

// function saveDB(data) {
//     fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
// }

// function genId() {
//     return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
// }

export default router;