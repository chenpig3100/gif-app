import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDoucumentClient } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "ap-southest-2";

const client = new DynamoDBClient({
    region: REGION,
});

export const doc = DynamoDBDoucumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
});