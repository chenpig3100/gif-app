import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PassThrough } from "stream";
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

export const s3Key = (...parts) => parts.filter(Boolean).join("/").replace(/\/+/g, "/");

export async function putObject({ Key, Body, ContentType, ACL }) {
    const { s3, bucket } = await ensureS3();
    const cmd = new PutObjectCommand({ Bucket: bucket, Key, Body, ContentType, ACL });
    await s3.send(cmd);
    return { bucket, key: Key };
}

export async function getSigned({ Key, expiresIn = 3600 }) {
    const { s3, bucket } = await ensureS3();
    const cmd = new GetObjectCommand({ Bucket: bucket, Key });
    return getSignedUrl(s3, cmd, { expiresIn });
}

export async function deleteObject(Key) {
    const { s3, bucket } = await ensureS3();
    const cmd = new DeleteObjectCommand({ Bucket: bucket, Key });
    await s3.send(cmd);
}

export function uploadStream({ Key, ContentType }) {
    const pass = new PassThrough();
    const done = (async () => {
        const { s3, bucket } = await ensureS3();
        const cmd = new PutObjectCommand({ Bucket: bucket, Key, Body: pass, ContentType });
        await s3.send(cmd);
        return { bucket, key: Key };
    })();
    return { writeStream: pass, done };
}

export { getRegion };