import { PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { doc } from "./dynamo";

const TABLE = process.env.TABLE_NAME;
const ID_INDEX = "id-index";

export async function createFileRec(item) {
    await doc.send(new PutCommand({
        TableName: TABLE,
        Item: item,
        ConditionExpression: "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",
        ExpressionAttributeNames: { "#pk": "qut-username", "#sk": "createdAt" },
    }));
    return item;
}

export async function getById(id) {
    const q = await doc.send(new QueryCommand({
        TableName: TABLE,
        IndexName: ID_INDEX,
        KeyConditionExpression: "#id = :id",
        ExpressionAttributeNames: { "#id": "id" },
        ExpressionAttributeValues: {":id": id },
        Limit: 1,
    }));
    return q.Items?.[0] || null;
}

export async function listMine(qutUsername, {limit = 20, cursor } = {}) {
    const params = {
        TableName: TABLE,
        KeyConditionExpression: "#pk = :u",
        ExpressionAttributeNames: { "#pk": "qut-username" },
        ExpressionAttributeValues: {":u": qutUsername},
        ScanIndexForward: false,
        Limit: limit,
    };
    if (cursor) params.ExclusiveStartKey = cursor;

    const out = await doc.send(new QueryCommand(params));
    return {items: out.Items || [], nextCursor: out.LastEvaluteKey || null };
}

export async function updateTags(id,tags) {
    const rec = await getById(id);
    if (!rec) return null;

    await doc.send(new UpdateCommand({
        TableName: TABLE,
        Key: { "qut-username": rec["qut-username"], "createdAt": rec["createdAt"] },
        UpdateExpression: "SET #tags = :tags",
        ExressionAttributeNames: { "#tags": "tags" },
        ExpressionAttributeValues: { ":tags": tags },
    }));
    return { ...rec, tags };
}

export async function deleteRecordById(id) {
    const rec = await getById(id);
    if (!rec) return false;

    await doc.send(new DeleteCommand({
        TableName: TABLE,
        Key: { "qut-username": rec["qut-username"], "createdAt": rec["createdAt"] },
    }));
    return true;
}
