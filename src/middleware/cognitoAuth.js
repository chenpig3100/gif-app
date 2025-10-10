import { jwtVerify, createRemoteJWKSet } from "jose";
import {
    CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { getParam } from "../services/params.js";

let JWKS = null;
let cip = null;

function ensureEnv(name, val) {
    if (!val) throw new Error(`Missing env ${name}`);
    return val;
}

function getIssuer() {
    const iss = getParam("COGNITO_ISS");
    if (!iss) throw new Error("Missing env COGNITO_ISS");
    return iss;
}

function getRegion() {
    const region = getParam("COGNITO_REGION") || getParam("AWS_REGION");
    return ensureEnv("COGNITO_REGION/AWS_REGION", region);
}

export function getClientId() {
    const id = getParam("COGNITO_CLIENT_ID");
    return ensureEnv("COGNITO_CLIENT_ID", id);
}

export function getJWKS() {
    if (!JWKS) {
        const iss = getIssuer();
        JWKS = createRemoteJWKSet(new URL(`${getIssuer()}/.well-known/jwks.json`));
    }
    return JWKS;
}

export function getCip() {
    if (!cip) {
        cip = new CognitoIdentityProviderClient({ region: getRegion() });
    }
    return cip;
}

export async function cognitoAuth(req, res, next) {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const { payload } = await jwtVerify(token, getJWKS(), { issuer: getIssuer() });
        const groups = payload["cognito:groups"] || [];
        req.user = {
            sub: payload.sub,
            username: payload["cognito:username"],
            email: payload.email,
            groups,
            role: groups.includes("Admins") ? "admin" : "user",
        };
        next();
    } catch (e) {
        console.error("Cognito token verify failed:", e.message);
        res.status(401).json({ message: "Invalid or expired token" });
    }
}