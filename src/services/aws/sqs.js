import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: "ap-southeast-2" });

const queueUrl = "https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcode-jobs";

export async function sendJobToQueue(job) {
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(job),
  });

  await sqs.send(command);
  console.log("✅ Job queued:", job);
}