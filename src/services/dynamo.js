import "dotenv/config";
import DynamoDB from "@aws-sdk/client-dynamodb";
import DynamoDBLib from "@aws-sdk/lib-dynamodb";
import { getParam } from "../services/params.js";

const REGION = getParam("AWS_REGION") || "ap-southeast-2";
export const TABLE_NAME = getParam("TABLE_NAME") || "n11740388-files";
if (!TABLE_NAME) throw new Error("Missing env var TABLE_NAME");

const client = new DynamoDB.DynamoDBClient({ region: REGION, credentials: undefined, });

export const doc = DynamoDBLib.DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
});

export const {
    PutCommand,
    GetCommand,
    QueryCommand,
    UpdateCommand,
    DeleteCommand,
} = DynamoDBLib;