import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL || "http://54.252.15.76/api/v1";
const USERNAME = process.env.USERNAME || "admin";
const PASSWORD = process.env.PASSWORD || "1234";
const FILE_ID = process.env.FILE_ID || "1756631623762-pw3tbn"; // template file ID for load test
const TOTAL_JOBS = Number(process.env.TOTAL_JOBS || 250);
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const __filename   = fileURLToPath(import.meta.url);
const __dirname    = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR   = path.join(PROJECT_ROOT, "outputs");

// HTTP client
const http = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  validateStatus: (s) => s < 500 || s === 503 || s === 429,
});

if (!FILE_ID) {
  console.error("Please set FILE_ID environment variable.");
  process.exit(1);
}

async function login() {
  const { data } = await axios.post(`${BASE_URL}/auth/login`, {
    username: USERNAME,
    password: PASSWORD,
  });
  return data.token;
}

async function transcode(token) {
  const res = await http.post(
    "/jobs/transcode",
    { fileId: FILE_ID },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status === 429 || res.status === 503) {
    const ra = Number(res.headers["retry-after"] || 1);
    await new Promise((r) => setTimeout(r, ra * 1000 + Math.random() * 200));
    return transcode(token);
  }

  if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
  return res.data;
}


async function cleanupOutputs() {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) return;
    const files = await fs.promises.readdir(OUTPUT_DIR);
    let removed = 0;
    for (const f of files) {
      if (f.toLowerCase().endsWith(".gif")) {
        try {
          await fs.promises.unlink(path.join(OUTPUT_DIR, f));
          removed++;
        } catch {}
      }
    }
    console.log(`\nCleaned up ${removed} gif files in outputs/`);
  } catch (e) {
    console.warn("cleanupOutputs() failed:", e.message);
  }
}

async function run() {
  const token = await login();
  console.log(`Token acquired. Start load: total=${TOTAL_JOBS}, concurrency=${CONCURRENCY}`);

  let inFlight = 0, done = 0, failed = 0, idx = 0;

  return new Promise((resolve) => {
    const tick = () => {
      while (inFlight < CONCURRENCY && idx < TOTAL_JOBS) {
        inFlight++;
        idx++;
        transcode(token)
          .then(() => { done++; })
          .catch((e) => { failed++; console.error("Err:", e?.response?.status, e?.message); })
          .finally(() => {
            inFlight--;
            process.stdout.write(`\rprogress: done=${done} failed=${failed} inflight=${inFlight}`);
            if (done + failed === TOTAL_JOBS) {
              console.log("\nAll jobs finished.");
              cleanupOutputs().finally(resolve);
            } else {
              setImmediate(tick);
            }
          });
      }
    };
    tick();
  });
}

run().catch((e) => {
  console.error("Fatal err:", e);
  process.exit(1);
});