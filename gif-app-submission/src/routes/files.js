import express from "express";
import fs from "fs";
import path from "path";
import { authMiddleware } from "../middleware/auth.js";
import { parseBool, parseNumber, parseData, buildLinkHeader } from "../utils/query.js";

const router = express.Router();

const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const DATA_DIR = "data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DATA_PATH = path.join(DATA_DIR, "db.json");
if (!fs.existsSync(DATA_PATH)) fs.writeFileSync(DATA_PATH, JSON.stringify({ files: [] }, null, 2));

// Upload
router.post("/upload", authMiddleware, async (req, res) => {
    if (!req.files || !req.files.video) {
        return res.status(400).json({ message: "No video file uploaded" });
    }
    const video = req.files.video;
    const videoPath = path.join(uploadDir, `${Date.now()}-${video.name}`);
    video.mv(videoPath, err => {
        if (err) return res.status(500).json({ message: "Error uploading video" });

        const db = loadDB();
        const rec = {
            id: genId(),
            ownerSub: req.user?.sub || "unknown",
            origName: video.name,
            mime: video.mimetype,
            size: video.size,
            inputPath: videoPath,
            outputPath: null,
            createdAt: new Date().toISOString(),
            tags: [],
        };
        db.files.unshift(rec);
        saveDB(db);
        return res.json({
            message: "Video uploaded successfully",
            fileId: rec.id,
            filePath: videoPath,
        });
    });
});

// List
router.get("/mine", authMiddleware, (req, res) => {
    const db = loadDB();
    const {
        // Pagination
        limit: limitRow = "20",
        page: pageRow,
        cursor,

        // Sorting
        sort = "createdAt",
        order = "desc",

        // Filter
        q,
        //mine,
        hasOutput,
        from,
        to,
        minSize,
        maxSize,
        tags,
        tagsMode,
    } = req.query;

    // Validate and parse query params
    const limit = Math.min(Math.max(parseInt(limitRow, 10) || 20, 1), 100);
    const page = pageRow ? Math.max(parseInt(pageRow, 10) || 1, 1) : undefined;
    const hasOutputBool = parseBool(hasOutput);
    const minSizeNum = parseNumber(minSize);
    const maxSizeNum = parseNumber(maxSize);
    const fromDate = parseData(from);
    const toDate = parseData(to);
    // tags
    const tagsList = typeof tags === "string" ?
        tags.split(",").map(t => t.trim()).filter(Boolean) :
        Array.isArray(tags) ?
            tags.flatMap(t => String(t).split(",")).map(t => t.trim()).filter(Boolean) :
            [];
    const tagsMatchMode = (tagsMode === "all") ? "all" : "any"; // default "any"

    // Admin can see all files; normal users see only their own
    let items = (req.user?.role === "admin") ? db.files : db.files.filter(f => f.ownerSub === req.user.sub);

    // Filter
    if (q) {
        const qq = String(q).toLowerCase();
        items = items.filter(f => f.origName.toLowerCase().includes(qq));
    };
    if (hasOutputBool !== undefined) {
        items = items.filter(f => (hasOutputBool ? f.outputPath : !f.outputPath));
    };
    if (minSizeNum !== undefined) {
        items = items.filter(f => (f.size ?? 0) >= minSizeNum);
    };
    if (maxSizeNum !== undefined) {
        items = items.filter(f => (f.size ?? 0) <= maxSizeNum);
    };
    if (fromDate) {
        items = items.filter(f => new Date(f.createdAt) >= fromDate);
    };
    if (toDate) {
        items = items.filter(f => new Date(f.createdAt) <= toDate);
    };
    if (tagsList.length > 0) {
        const tagsNeedles = tagsList.map(t => t.toLowerCase());
        if (tagsMatchMode === "all") {
            items = items.filter(f => {
                if (!Array.isArray(f.tags) || f.tags.length === 0) return false;
                const hay = f.tags.map(x => String(x).toLowerCase());
                return tagsNeedles.every(t => hay.includes(t));
            });
        } else {
            items = items.filter(f => {
                if (!Array.isArray(f.tags) || f.tags.length === 0) return false;
                const hay = f.tags.map(x => String(x).toLowerCase());
                return hay.some(x => tagsNeedles.includes(x));
            });
        }
    };

    // Sort
    const validSort = new Set(["createdAt", "size", "origName"]);
    const sortKey = validSort.has(sort) ? sort : "createdAt";
    const dir = order === "asc" ? 1 : -1;
    items.sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * dir;
    });

    const total = items.length;

    // Pagination: page or cursor
    let pageItems, nextCursor;
    if (page) {
        const start = (page - 1) * limit;
        pageItems = items.slice(start, start + limit);
        nextCursor = undefined;
    } else {
        let startIdx = 0;
        if (cursor) {
            const idx = items.findIndex(f => f.id === cursor);
            if (idx >= 0) startIdx = idx + 1;
        }
        pageItems = items.slice(startIdx, startIdx + limit);
        nextCursor = (startIdx + limit) < items.length ? pageItems[pageItems.length - 1]?.id : null;
    };

    if (typeof total === "number") res.setHeader("X-Total-Count", String(total));
    if (nextCursor) res.setHeader("X-Next-Cursor", String(nextCursor));
    if (!page && nextCursor) {
        const baseUrl = req.originalUrl.split("?")[0] + "?" + new URLSearchParams({ ...req.query, cursor: "" }).toString();
        res.setHeader("Link", buildLinkHeader(baseUrl, { nextCursor }));
    };

    res.json({
        data: pageItems,
        meta: {
            total,
            limit,
            sort: sortKey,
            order: order === "asc" ? "asc" : "desc",
            page: page ?? null,
            nextCursor: page ? null : nextCursor ?? null,
            filters: {
                q: q ?? null,
                hasOutput: hasOutputBool ?? null,
                from: fromDate ? fromDate.toISOString() : null,
                to: toDate ? toDate.toISOString() : null,
                minSize: minSizeNum ?? null,
                maxSize: maxSizeNum ?? null,
                tags: tagsList.length > 0 ? tagsList : null,
                tagsMode: tagsMatchMode,
            }
        }
    });
});

// Download
router.get("/:id/download", authMiddleware, (req, res) => {
    const db = loadDB();
    const file = db.files.find(f => f.id === req.params.id);
    if (!file) return res.status(404).send("Not found");

    const isOwner = file.ownerSub === req.user.sub;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).send("Forbidden");

    const p = file.outputPath || file.inputPath;
    if (!p || !fs.existsSync(p)) return res.status(404).send("File missing");

    const suggested = file.outputPath ?
        file.origName.replace(/\.[^.]+$/, ".gif") :
        file.origName;
    res.setHeader("Content-Disposition", `attachment; filename="${suggested}"`);
    return res.download(p, path.basename(p));
});

// Patch
router.patch("/:id/tags", authMiddleware, (req, res) => {
    const { id } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags) || !tags.every(t => typeof t === "string")) {
        return res.status(400).json({ error: "Invalid tags" });
    }

    const db = loadDB();
    const idx = db.files.findIndex(f => f.id === id);
    if (idx === -1) return res.status(404).json({ error: "File not found" });

    db.files[idx].tags = tags;
    saveDB(db);

    return res.json({ message: "Tags updated", file: db.files[idx] });
});

// Delete uploaded video
router.delete("/:id/upload", authMiddleware, (req, res) => {
    const db = loadDB();
    const idx = db.files.findIndex(f => f.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const file = db.files[idx];
    const isOwner = file.ownerSub === req.user.sub;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });

    const p = file.inputPath;
    if (p && fs.existsSync(p)) {
        try {
            fs.unlinkSync(p); // delete physical file
        } catch (e) {
            console.warn("Failed to delete file:", e.message);
        }
    }

    // delete record from DB
    db.files.splice(idx, 1);
    saveDB(db);

    return res.json({ message: "Upload and DB record deleted", id: req.params.id });
});

// Delete generated GIF
router.delete("/:id/output", authMiddleware, (req, res) => {
    const db = loadDB();
    const file = db.files.find(f => f.id === req.params.id);
    if (!file) return res.status(404).json({ error: "Not found" });

    const isOwner = file.ownerSub === req.user.sub;
    const isAdmin = req.user.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).json({ error: "Forbidden" });

    const p = file.outputPath;
    if (!p) return res.status(404).json({ error: "No output to delete" });
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) { /* ignore */ }
    file.outputPath = null;
    saveDB(db);
    return res.json({ message: "Output deleted", id: file.id });
});



// Load and save DB
function loadDB() {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
}

function saveDB(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function genId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default router;