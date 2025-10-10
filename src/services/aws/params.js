import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-southeast-2";
const client = new SSMClient({ region });

const cache = new Map();

export async function preloadParams(names = []) {
    if (!names || names.length === 0) return;
    const out = await client.send(new GetParametersCommand({
        Names: names,
        WithDecryption: false,
    }));
    for (const p of out.Parameters || []) {
    const short = p.Name.split("/").pop();
    cache.set(short, p.Value);
    }
}

export function getParam(name, fallbackEnv = true) {
    if (cache.has(name)) return cache.get(name);
    if (fallbackEnv) return process.env[name];
    return undefined;
}

export const ssmName = (short) => `/gif-app/${short}`;