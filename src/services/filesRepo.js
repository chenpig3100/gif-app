import { doc, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, TABLE_NAME } from "./aws/dynamo.js";

const ID_INDEX = "id-index";

export async function createFileRec(item) {
    await doc.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: "attribute_not_exists(#pk) AND attribute_not_exists(#sk)",
        ExpressionAttributeNames: { "#pk": "qut-username", "#sk": "createdAt" },
    }));
    return item;
}

export async function getById(id) {
    const q = await doc.send(new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: ID_INDEX,
        KeyConditionExpression: "#id = :id",
        ExpressionAttributeNames: { "#id": "id" },
        ExpressionAttributeValues: {":id": id },
        Limit: 1,
    }));
    return q.Items?.[0] ?? null;
}

export async function updateOutputPathById(id, outputPath) {
    const rec = await getById(id);
    if (!rec) throw new Error("Record not found");

    await doc.send(
        new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
                "qut-username": rec["qut-username"],
                createdAt: rec["createdAt"],
            },
            UpdateExpression: "SET outputPath = :out",
            ExpressionAttributeValues: {
                ":out": outputPath,
            },
        })
    );
}

export async function listMine(qutUsername, {limit = 20, cursor } = {}) {
    const params = {
        TableName: TABLE_NAME,
        KeyConditionExpression: "#pk = :u",
        ExpressionAttributeNames: { "#pk": "qut-username" },
        ExpressionAttributeValues: {":u": qutUsername},
        ScanIndexForward: false,
        Limit: limit,
    };
    if (cursor) params.ExclusiveStartKey = cursor;

    const out = await doc.send(new QueryCommand(params));
    return {items: out.Items || [], nextCursor: out.LastEvaluatedKey || null };
}

export async function updateTags(id,tags) {
    const rec = await getById(id);
    if (!rec) return null;

    const clean = Array.isArray(tags) ? [...new Set(tags.map(t => String(t).trim()).filter(Boolean))] : [];

    await doc.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { "qut-username": rec["qut-username"], "createdAt": rec["createdAt"] },
        UpdateExpression: "SET tags = :tags",
        ExpressionAttributeValues: { ":tags": clean },
    }));
    return { ...rec, tags };
}

export async function deleteRecordById(id) {
    const rec = await getById(id);
    if (!rec) return false;

    await doc.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { "qut-username": rec["qut-username"], "createdAt": rec["createdAt"] },
    }));
    return true;
}