import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage"; 

// Region & bucket from env with sensible defaults for local/dev
const REGION = process.env.AWS_REGION || "ap-southeast-2";
const BUCKET = process.env.S3_BUCKET || "n11740388-uploads";

// Basic S3 client (SigV4). No custom checksum config so streams work without buffering
const s3 = new S3Client({ region: REGION });

/**
 * Get an object from S3 as a Node.js Readable stream
 */
export async function downloadFromS3(key) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const res = await s3.send(cmd);
  return res.Body; // Node Readable stream
}

/**
 * Upload a Node.js Readable stream to S3 (streaming, no buffering)
 * Pass ffmpeg stdout directly; do not wrap or coerce.
 */
export async function uploadToS3(key, stream, { contentType = "image/gif" } = {}) {
  // Ensure we received a Node.js Readable stream
  if (!stream || typeof stream.pipe !== "function") {
    throw new TypeError("uploadToS3 expected a Node.js Readable stream");
  }

  const uploader = new Upload({
    client: s3,
    params: {
      Bucket: BUCKET,
      Key: key,
      Body: stream,
      ContentType: contentType,
    },
    queueSize: 4,                // 併發上傳 part
    partSize: 5 * 1024 * 1024,   // 5MB（S3 最小 part）
    leavePartsOnError: false,
  });

  await uploader.done();
  return key;
}

/**
 * Check if a key exists (helps return clearer 404s before starting work)
 */
export async function keyExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound" || err?.Code === "NotFound") {
      return false;
    }
    throw err;
  }
}