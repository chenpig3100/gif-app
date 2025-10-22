import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { PassThrough, Readable } from "stream";
import { pipeline } from "stream/promises";

// Normalize various input types to a Node.js Readable stream
function toNodeReadable(src) {
  // Already a Node stream
  if (src && typeof src.pipe === "function") return src;

  // Buffers / Uint8Array
  if (Buffer.isBuffer(src) || src instanceof Uint8Array) {
    return Readable.from(src);
  }

  // Async iterable (some SDK bodies)
  if (src && typeof src[Symbol.asyncIterator] === "function") {
    return Readable.from(src);
  }

  throw new TypeError("Unsupported input stream type for ffmpeg: expected a Readable stream");
}

/**
 * Stream-based transcoding: pipe input stream -> ffmpeg -> GIF stream
 * No local files are created. Caller can upload the returned stream to S3.
 *
 * @param {Readable|Buffer|Uint8Array|AsyncIterable} inputStream - source video stream (e.g. S3 GetObject Body)
 * @param {object} opts
 * @param {number} [opts.duration=5]
 * @param {number} [opts.fps=10]
 * @param {number} [opts.width=320]
 * @returns {{ stream: Readable, process: ChildProcess }}
 */
export function transcodeToGifStream(inputStream, { duration = 5, fps = 10, width = 320 } = {}) {
  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-nostdin",
    "-y",
    "-t", String(duration),
    "-i", "pipe:0",
    "-vf", `fps=${fps},scale=${width}:-1:flags=lanczos`,
    "-an",
    "-pix_fmt", "rgb24",
    "-f", "gif",
    "pipe:1",
  ];

  const proc = spawn("ffmpeg", args);

  // capture ffmpeg stderr for better error messages
  let fferr = "";
  proc.stderr.on("data", (d) => { fferr += d.toString(); });

  // Normalize to Node Readable then forward to ffmpeg stdin using pipeline
  const inStream = toNodeReadable(inputStream);

  // Expose ffmpeg stdout as a readable stream
  const out = new PassThrough();
  proc.stdout.pipe(out);

  // Forward input safely and ignore EPIPE when ffmpeg closes early
  pipeline(inStream, proc.stdin).catch((err) => {
    if (err && (err.code === "EPIPE" || String(err).includes("EPIPE"))) {
      // ffmpeg closed stdin; safe to ignore
      return;
    }
    try { proc.kill("SIGKILL"); } catch (_) {}
    out.emit("error", err);
  });
  proc.stdin.on("error", (e) => {
    if (e && e.code === "EPIPE") return; // ignore expected EPIPE
    out.emit("error", e);
  });

  // If ffmpeg itself errors, surface that on the output stream
  proc.on("error", (err) => out.emit("error", err));
  proc.on("close", (code) => {
    if (code !== 0) out.emit("error", new Error(`ffmpeg exited with code ${code}${fferr ? ": " + fferr : ""}`));
    out.end();
  });

  return { stream: out, process: proc };
}

/**
 * DEPRECATED: file-path version kept for backward compatibility.
 * Writes to OS temp directory instead of project ./outputs to avoid local state in repo.
 * Prefer using transcodeToGifStream() and uploading directly to S3.
 *
 * @param {string} inputPath - local path to source video
 * @returns {Promise<string>} - absolute path to temp GIF file
 */
export async function transcodeToGif(inputPath) {
  const inPath = path.resolve(inputPath);
  const outPath = path.join(os.tmpdir(), `${Date.now()}.gif`);

  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-nostdin",
    "-y",
    "-t", "5",
    "-i", inPath,
    "-vf", "fps=10,scale=320:-1:flags=lanczos",
    "-an",
    "-pix_fmt", "rgb24",
    outPath,
  ];

  await new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`))));
  });

  return outPath;
}