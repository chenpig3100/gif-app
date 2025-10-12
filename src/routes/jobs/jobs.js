import express from "express";
import { cognitoAuth as authMiddleware } from "../../middleware/cognitoAuth.js";
import fs from "fs";
import path from "path";
import { transcodeToGif } from "../../services/ffmpeg.js";
import { getById, updateOutputPathById } from "../../services/filesRepo.js";
import { downloadToTmp, putObject, s3Key } from "../../services/aws/s3.js";
import { getParam } from "../../services/aws/params.js";

const router = express.Router();

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
        const localSrc = await downloadToTmp({ Key: filePath });
        const localGif = await transcodeToGif(localSrc);

        const gifKey = s3Key("outputs", `${path.basename(localSrc, path.extname(localSrc))}.gif`);
        const body = fs.createReadStream(localGif);
        await putObject({ Key: gifKey, Body: body, ContentType: "image/gif" });

        try { fs.unlinkSync(localSrc); } catch {}
        try { fs.unlinkSync(localGif); } catch {}

        if (fileId) {
            await updateOutputPathById(fileId, gifKey);
        }

        return res.json({
            status: "done",
            outputPath: gifKey,
            fileId: fileId || null,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message || "Transcode failed" });
    }
});

export default router;