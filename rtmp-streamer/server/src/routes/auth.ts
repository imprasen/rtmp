import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { db } from "../db.js";

export const authRouter = Router();

// P1-10: Strict Rate Limiter on Authentication (10 attempts per 15 minutes)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: "Too many login attempts from this IP. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Login with Rate Limiting & Session Fixation Protection
authRouter.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password || typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const sanitizedUsername = username.trim().toLowerCase();

  const user = db.prepare("SELECT * FROM users WHERE LOWER(username) = ?").get(sanitizedUsername) as
    | { id: number; username: string; password_hash: string; role: string }
    | undefined;

  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  // P1: Async bcrypt compare to prevent blocking the event loop
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  // P1-11: Regenerate session ID upon successful login to prevent Session Fixation attacks
  req.session.regenerate((err) => {
    if (err) {
      console.error("[AUTH] Session regeneration error:", err);
      return res.status(500).json({ error: "Failed to initialize secure session" });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;

    return res.json({
      message: "Login successful",
      user: { id: user.id, username: user.username, role: user.role },
    });
  });
});

// Logout
authRouter.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Could not log out" });
    }
    res.clearCookie("connect.sid");
    return res.json({ message: "Logged out successfully" });
  });
});

// Current User State
authRouter.get("/me", (req: Request, res: Response) => {
  if (req.session && req.session.userId) {
    return res.json({
      authenticated: true,
      guest: false,
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role,
      },
    });
  }
  return res.json({
    authenticated: false,
    guest: true,
    user: null,
  });
});
