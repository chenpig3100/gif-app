import "dotenv/config";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { getParam } from "./params.js";

// Resolve config at module load (top‑level await is OK in ESM)
const REGION =
  (await getParam("COGNITO_REGION")) ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "ap-southeast-2";

export const TABLE_NAME =
  (await getParam("TABLE_NAME")) || process.env.TABLE_NAME || "n11740388-files";

if (!TABLE_NAME) {
  throw new Error("Missing TABLE_NAME (SSM /gif-app/TABLE_NAME or env.TABLE_NAME)");
}

const client = new DynamoDBClient({
  region: REGION,
});

export const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

// Re-export command classes for convenience
export { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand };