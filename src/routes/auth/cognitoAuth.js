import express from "express";
import {
    CognitoIdentityProviderClient,
    SignUpCommand,
    ConfirmSignUpCommand,
    InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getParam } from "../../services/aws/params.js";

const router = express.Router();

const region = getParam("COGNITO_REGION");
const ClientId = getParam("COGNITO_CLIENT_ID");
if (!region || !ClientId) throw new Error("Missing COGNITO_REGION / COGNITO_CLIENT_ID");

const cip = new CognitoIdentityProviderClient({ region });

/**
 * POST /api/v1/auth/register
 * body: { "username": "will", "password": "Passw0rd!", "email": "you@example.com" }
 * function: register，Cognito automatic send mail to confirm
 */
router.post("/register", async (req, res) => {
    const { username, password, email } = req.body || {};
    if (!username || !password || !email) {
        return res.status(400).json({ message: "username, password, email required" });
    }
    try {
        await cip.send(
            new SignUpCommand({
                ClientId,
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

/**
* POST /api/v1/auth/confirm
* body: { "username": "will", "code": "123456" }
* function: use email pin code to onfirm
*/
router.post("/confirm", async (req, res) => {
    const { username, code } = req.body || {};
    if (!username || !code) {
        return res.status(400).json({ message: "username and code required" });
    }
    try {
        await cip.send(new ConfirmSignUpCommand({ ClientId, Username: username, ConfirmationCode: code }));
        res.json({ message: "Email confirmed" });
    } catch (e) {
        console.error("Confirm error:", e);
        res.status(400).json({ message: e.message || "Confirm failed" });
    }
});

/**
* POST /api/v1/auth/login
* body: { "username": "will", "password": "Passw0rd!" }
* function: use account & password JWT（IdToken/AccessToken/RefreshToken）
*/
router.post("/login", async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ message: "username and password required" });
    }
    try {
        const out = await cip.send(
            new InitiateAuthCommand({
                AuthFlow: "USER_PASSWORD_AUTH",
                ClientId,
                AuthParameters: { USERNAME: username, PASSWORD: password },
            })
        );
        // AuthenticationResult: { IdToken, AccessToken, RefreshToken, ExpiresIn, TokenType }
        res.json(out.AuthenticationResult);
    } catch (e) {
        console.error("Login error:", e);
        res.status(401).json({ message: "Invalid credentials or user not confirmed" });
    }
});

export default router;