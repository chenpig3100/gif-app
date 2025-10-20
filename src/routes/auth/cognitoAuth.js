import express from "express";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getParam } from "../../services/aws/params.js";

const router = express.Router();

let _cip = null;
let _clientId = null;

async function getCip() {
  if (_cip) return _cip;

  const region = await getParam("COGNITO_REGION");
  _clientId = await getParam("COGNITO_CLIENT_ID");

  if (!region || !_clientId) {
    throw new Error("Missing COGNITO_REGION / COGNITO_CLIENT_ID");
  }

  // 確保這裡拿到的是字串
  _cip = new CognitoIdentityProviderClient({ region });
  return _cip;
}

function requireCreds(res) {
  if (!_clientId) {
    res.status(500).json({ message: "Cognito client not initialised" });
    return false;
  }
  return true;
}

// POST /api/v1/auth/register
router.post("/register", async (req, res) => {
  try {
    const cip = await getCip();
    const { username, password, email } = req.body || {};
    if (!username || !password || !email) {
      return res.status(400).json({ message: "username, password, email required" });
    }
    if (!requireCreds(res)) return;

    await cip.send(
      new SignUpCommand({
        ClientId: _clientId,
        Username: username,
        Password: password,
        UserAttributes: [{ Name: "email", Value: email }],
      })
    );

    res.json({ message: "Sign up success. Please check your email for the code." });
  } catch (e) {
    console.error("SignUp error:", e);
    res.status(400).json({ message: e.message || "Sign up failed" });
  }
});

// POST /api/v1/auth/confirm
router.post("/confirm", async (req, res) => {
  try {
    const cip = await getCip();
    const { username, code } = req.body || {};
    if (!username || !code) {
      return res.status(400).json({ message: "username and code required" });
    }
    if (!requireCreds(res)) return;

    await cip.send(new ConfirmSignUpCommand({ ClientId: _clientId, Username: username, ConfirmationCode: code }));
    res.json({ message: "Email confirmed" });
  } catch (e) {
    console.error("Confirm error:", e);
    res.status(400).json({ message: e.message || "Confirm failed" });
  }
});

// POST /api/v1/auth/login
router.post("/login", async (req, res) => {
  try {
    const cip = await getCip();
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: "username and password required" });
    }
    if (!requireCreds(res)) return;

    const out = await cip.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: _clientId,
        AuthParameters: { USERNAME: username, PASSWORD: password },
      })
    );
    res.json(out.AuthenticationResult); // { IdToken, AccessToken, ... }
  } catch (e) {
    console.error("Login error:", e);
    res.status(401).json({ message: "Invalid credentials or user not confirmed" });
  }
});

export default router;