import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { PassThrough } from "stream";

/**
 * Stream-based transcoding: pipe input stream -> ffmpeg -> GIF stream
 * No local files are created. Caller can upload the returned stream to S3.
 *
 * @param {Readable} inputStream - source video stream (e.g. S3 GetObject Body)
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

  // forward input to ffmpeg stdin
  inputStream.pipe(proc.stdin);
  // avoid EPIPE if ffmpeg closes early
  proc.stdin.on("error", () => {});

  // expose ffmpeg stdout as a readable stream
  const out = new PassThrough();
  proc.stdout.pipe(out);

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