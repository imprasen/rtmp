import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";

export const authRouter = Router();

// Login
authRouter.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | { id: number; username: string; password_hash: string; role: string }
    | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;

  return res.json({
    message: "Login successful",
    user: { id: user.id, username: user.username, role: user.role },
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
