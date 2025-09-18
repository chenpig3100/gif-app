import express from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

const router = express.Router();

const USERS = [
    {
        username: "admin",
        password: "1234",
        role: "admin",
    },
    {
        username: "user1",
        password: "1234",
        role: "user",
    },
    {
        username: "user2",
        password: "1234",
        role: "user",
    }
];
router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = USERS.find((user) => user.username === username && user.password === password);
    if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ sub: user.username, role: user.role }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
});

export default router;