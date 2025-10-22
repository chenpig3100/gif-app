import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PassThrough, Readable } from "stream";
import { getParam } from "./params.js";

let _s3 = null;
let _bucket = null;
let _region = null;

async function getRegion() {
    if (_region) return _region;
    _region = (await getParam("COGNITO_REGION")) || process.env.AWS_REGION || "ap-southeast-2";
    return _region;
}

async function ensureS3() {
    if (!_bucket) {
        _bucket = await getParam("S3_BUCKET");
        if (!_bucket) throw new Error("Missing S3_BUCKET parameter");
    }
    if (!_s3) {
        const region = await getRegion();
        _s3 = new S3Client({ region });
    }
    return { s3: _s3, bucket: _bucket };
}

// Normalize any SDK body type (Node stream, WebStream, Uint8Array, Buffer, etc.) to a Node.js Readable
async function toNodeReadable(body) {
    if (!body) return Readable.from([]);
    // Already a Node.js stream
    if (typeof body.pipe === "function") return body;

    // WebStream -> Node.js Readable (Node 18+)
    if (typeof body.getReader === "function" && typeof Readable.fromWeb === "function") {
        try { return Readable.fromWeb(body); } catch { /* fallthrough */ }
    }
    if (typeof body.transformToWebStream === "function" && typeof Readable.fromWeb === "function") {
        try { return Readable.fromWeb(body.transformToWebStream()); } catch { /* fallthrough */ }
    }

    // Byte array helpers
    if (typeof body.transformToByteArray === "function") {
        const bytes = await body.transformToByteArray();
        return Readable.from(bytes);
    }

    // Buffers / Uint8Array
    if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
        return Readable.from(body);
    }

    // Fallback: coerce to string buffer
    return Readable.from([Buffer.from(String(body))]);
}

/**
 * Ensure we always pass a clean, non-empty string key to the AWS SDK.
 * This prevents internal smithy/core errors like "labelValue.split is not a function".
 */
function ensureKeyString(key, ctx = "Key") {
    if (key === undefined || key === null) {
        throw new TypeError(`${ctx} is required`);
    }
    const k = String(key).trim().replace(/^\/+/, "");
    if (!k) {
        throw new TypeError(`${ctx} must be a non-empty string`);
    }
    return k;
}

// join parts and normalise slashes; validation happens in ensureKeyString
export const s3Key = (...parts) => parts.filter(Boolean).join("/").replace(/\/+/g, "/").replace(/^\/+/, "");

export async function putObject({ Key, Body, ContentType, ACL }) {
    const { s3, bucket } = await ensureS3();
    const key = ensureKeyString(Key, "S3 PutObject Key");
    const contentType = ContentType ? String(ContentType) : undefined;
    const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: Body, ContentType: contentType, ACL });
    await s3.send(cmd);
    return { bucket, key };
}

export async function getSigned({ Key, expiresIn = 3600 } = {}) {
    const { s3, bucket } = await ensureS3();
    const key = ensureKeyString(Key, "S3 GetObject Key");
    const ttl = Number(expiresIn) > 0 ? Number(expiresIn) : 3600;
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(s3, cmd, { expiresIn: ttl });
}

export async function getObjectStream(Key) {
    const { s3, bucket } = await ensureS3();
    const key = ensureKeyString(Key, "S3 GetObjectStream Key");
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const out = await s3.send(cmd);
    const stream = await toNodeReadable(out.Body);
    return {
        stream,
        contentLength: out.ContentLength,
        contentType: out.ContentType,
        bucket,
        key,
    };
}

export async function deleteObject(Key) {
    const { s3, bucket } = await ensureS3();
    const key = ensureKeyString(Key, "S3 DeleteObject Key");
    const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    await s3.send(cmd);
}

export function uploadStream({ Key, ContentType }) {
    const pass = new PassThrough();
    const done = (async () => {
        const { s3, bucket } = await ensureS3();
        const key = ensureKeyString(Key, "S3 UploadStream Key");
        const contentType = ContentType ? String(ContentType) : undefined;
        const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: pass, ContentType: contentType });
        await s3.send(cmd);
        return { bucket, key };
    })();
    return { writeStream: pass, done };
}

export { getRegion };