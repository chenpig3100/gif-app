require("dotenv").config();
const {
    DynamoDBClient,
    CreateTableCommand,
    UpdateTimeToLiveCommand,
    DescribeTableCommand,
} = require("@aws-sdk/client-dynamodb");

const REGION = process.env.AWS_REGION || "ap-southeast-2";
const TABLE = process.env.TABLE_NAME || "n11740388-files";

async function main() {
    const client = new DynamoDBClient({ region: REGION });

    const create = new CreateTableCommand({
        TableName: TABLE,
        AttributeDefinitions: [
            { AttributeName: "qut-username", AttributeType: "S" },
            { AttributeName: "createdAt", AttributeType: "S" },
            { AttributeName: "id", AttributeType: "S" },
        ],
        KeySchema: [
            { AttributeName: "qut-username", KeyType: "HASH"},
            { AttributeName: "createdAt", KeyType: "RANGE"},
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: "id-index",
                KeySchema: [{ AttributeName: "id", KeyType: "HASH" }],
                Projection: { ProjectionType: "ALL" },
                ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 },
            },
        ],
        BillingMode: "PAY_PER_REQUEST",
    });

    try {
        await client.send(create);
        console.log("Table creating...")
    } catch (e) {
        if (e.name !== "ResourceInUseExpection") throw e;
        console.log("Table already exists, skipping create.")
    }

    // Enable TTL on `expiresAt`
    try {
        await client.send(new UpdateTimeToLiveCommand({
            TableName: TABLE,
            TimeToLiveSpecification: {
                Enabled: true,
                AttributeName: "expiresAt"
            },
        }))
    } catch (e) {
        console.log("TTL set skipped:", e.message);
    }

    // after ACTIVE
    let desc;
    for(;;) {
        desc = await client.send(new DescribeTableCommand({ TableName: TABLE }));
        if (desc.Table.TableStatus === "ACTIVE") break;
        await new Promise(r => setTimeout(r, 1500));
    }
    console.log("Table ACTIVE:", JSON.stringify(desc.Table, null, 2));
}

main().catch(console.error);