import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const OUTPUT_DIR = path.resolve("outputs");

export async function transcodeToGif(inputPath) {
  const inPath = path.resolve(inputPath);
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const outName = `${Date.now()}.gif`;
  const outPath = path.join(OUTPUT_DIR, outName);

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

  return path.relative(process.cwd(), outPath);
}