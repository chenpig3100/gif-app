import { jwtVerify, createRemoteJWKSet } from "jose";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { getParam } from "../services/aws/params.js";

/**
 * We must await getParam() because it returns a Promise.
 * Cache resolved values to avoid repeated SSM calls.
 */
let CACHED_ISS = null;
let CACHED_REGION = null;
let CACHED_CLIENT_ID = null;

let JWKS = null;          // createRemoteJWKSet result (a fetcher function)
let JWKS_FOR_ISS = null;  // which issuer the JWKS is bound to
let cip = null;

function ensure(name, val) {
  if (!val) throw new Error(`Missing required value: ${name}`);
  return val;
}

export async function getIssuer() {
  if (!CACHED_ISS) {
    const iss = await getParam("COGNITO_ISS");
    CACHED_ISS = ensure("COGNITO_ISS", iss);
  }
  return CACHED_ISS;
}

export async function getRegion() {
  if (!CACHED_REGION) {
    const region = (await getParam("COGNITO_REGION")) || (await getParam("AWS_REGION"));
    CACHED_REGION = ensure("COGNITO_REGION/AWS_REGION", region);
  }
  return CACHED_REGION;
}

export async function getClientId() {
  if (!CACHED_CLIENT_ID) {
    const id = await getParam("COGNITO_CLIENT_ID");
    CACHED_CLIENT_ID = ensure("COGNITO_CLIENT_ID", id);
  }
  return CACHED_CLIENT_ID;
}

export async function getJWKS() {
  const iss = await getIssuer(); // ensure resolved string
  if (!JWKS || JWKS_FOR_ISS !== iss) {
    const jwksUrl = new URL(`${iss}/.well-known/jwks.json`);
    JWKS = createRemoteJWKSet(jwksUrl);
    JWKS_FOR_ISS = iss;
  }
  return JWKS;
}

export async function getCip() {
  if (!cip) {
    const region = await getRegion();
    cip = new CognitoIdentityProviderClient({ region });
  }
  return cip;
}

/**
 * Express middleware: verify JWT from Authorization: Bearer <token>
 */
export async function cognitoAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const [jwks, issuer] = await Promise.all([getJWKS(), getIssuer()]);
    const { payload } = await jwtVerify(token, jwks, { issuer });

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
    console.error("Cognito token verify failed:", e?.message || e);
    res.status(401).json({ message: "Invalid or expired token" });
  }
}