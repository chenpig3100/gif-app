import { downloadFromS3, uploadToS3 } from "./services/s3.js";
import { transcodeToGifStream } from "./services/ffmpeg.js";

export async function transcodeFromS3(s3Key, options) {
  const inputStream = await downloadFromS3(s3Key);
  const { stream: gifStream } = transcodeToGifStream(inputStream, options = {});

  const outKey = s3Key.replace(/^uploads\//, "outputs/").replace(/\.[^/.]+$/, ".gif");
  await uploadToS3(outKey, gifStream, {contentType: "image/gif" });
  return outKey;
}