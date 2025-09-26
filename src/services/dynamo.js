// src/services/dynamo.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "ap-southeast-2";
// export const TABLE_NAME = process.env.TABLE_NAME;
// if (!TABLE_NAME) throw new Error("Missing env var TABLE_NAME");

const client = new DynamoDBClient({ region: REGION });

// ✅ 正確初始化 DocumentClient
export const doc = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

// 匯出常用的命令
export { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand };