import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { transcodeFromS3 } from "./ffmpegWorker.js";
import { uploadToS3 } from "./services/s3.js";
// import { updateById } from "./services/filesRepo.js";

const REGION = process.env.AWS_REGION || "ap-southeast-2";
const QUEUE_URL = process.env.SQS_QUEUE_URL || "https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcode-jobs";
const sqs = new SQSClient({ region: REGION });

async function handle(message) {
  const job = JSON.parse(message.Body);
  if (job.type !== "transcode") return;

  const outKey = await transcodeFromS3(job.s3Key, job.options);

  // if (job.fileId) await updateById(job.fileId, { outputPath: outKey });
  console.log("✅ done:", { s3Key: job.s3Key, outKey, fileId: job.fileId });
}

async function loop() {
  while (true) {
    const resp = await sqs.send(new ReceiveMessageCommand({
      QueueUrl: QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20,
      VisibilityTimeout: 180,
    }));
    const msgs = resp.Messages || [];
    for (const m of msgs) {
      try {
        await handle(m);
        await sqs.send(new DeleteMessageCommand({
          QueueUrl: QUEUE_URL,
          ReceiptHandle: m.ReceiptHandle,
        }));
      } catch (err) {
        console.error("❌ job failed", err);
      }
    }
  }
}

loop().catch(console.error);