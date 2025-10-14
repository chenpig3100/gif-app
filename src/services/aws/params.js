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

export async function getParam(name, fallbackEnv = true) {
  if (cache.has(name)) return cache.get(name);
  if (fallbackEnv && process.env[name]) return process.env[name];

  try {
    const paramName = name.startsWith("/gif-app/") ? name : `/gif-app/${name}`;
    const out = await client.send(
      new GetParameterCommand({ Name: paramName, WithDecryption: false })
    );
    const value = out?.Parameter?.Value;
    if (value) cache.set(name, value);
    return value;
  } catch (err) {
    console.error(`❌ Failed to fetch parameter ${name}:`, err.message);
    return undefined;
}

export const ssmName = (short) => `/gif-app/${short}`;