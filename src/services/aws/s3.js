import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { PassThrough } from "stream";
import { getParam } from "./params.js";


const BUCKET = getParam("S3_BUCKET") || "n11740388-uploads";
const REGION = getParam("AWS_REGION") || "ap-southeast-2";
if (!BUCKET) throw new Error("Missing env S3_BUCKET");

export const s3 = new S3Client({ region: REGION, credentials: undefined, });

export function s3Key(...parts) {
    return parts.filter(Boolean).join("/").replace(/\/+/g, "/");
}

export async function putObject({ Key, Body, ContentType, ACL }) {
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key, Body, ContentType, ACL}));
    return { bucket: BUCKET, key: Key };
}

export async function getSigned({ Key, expiresIn = 3600 }) {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key });
    return getSignedUrl(s3, cmd, { expiresIn });
}

export async function deleteObject(key) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key }));
}

export async function downloadToTmp({ Key }) {
    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key });
    const res = await s3.send(cmd);

    const tmp = path.join("/tmp", `${Date.now()}-${path.basename(Key)}`);
    const w = fs.createWriteStream(tmp);

    await new Promise((resolve, reject) => {
        res.Body.pipe(w).on("finish", resolve).on("error", reject);
    });
    return tmp;
}

export function uploadStream({ Key, ContentType }) {
    const pass = new PassThrough();
    const p = putObject({ Key, Body: pass, ContentType });
    return { writeStream: pass, done: p };
}