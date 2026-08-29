import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import { requireAdmin } from "../middleware/optionalAuth.js";

export const usersRouter = Router();

// All user management routes require Admin authorization
usersRouter.use(requireAdmin);

// 1. List all users
usersRouter.get("/", (req: Request, res: Response) => {
  const users = db.prepare("SELECT id, username, role, created_at FROM users ORDER BY id ASC").all();
  return res.json(users);
});

// 2. Create new user
usersRouter.post("/", (req: Request, res: Response) => {
  const { username, password, role = "operator" } = req.body;

  if (!username || typeof username !== "string" || !/^[a-zA-Z0-9_-]{3,30}$/.test(username.trim())) {
    return res.status(400).json({
      error: "Username must be 3-30 characters long and contain only letters, numbers, hyphens, and underscores",
    });
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  const validRoles = ["admin", "operator", "viewer"];
  const sanitizedRole = validRoles.includes(role) ? role : "operator";
  const sanitizedUsername = username.trim().toLowerCase();

  // Check if username already exists
  const existing = db.prepare("SELECT id FROM users WHERE LOWER(username) = ?").get(sanitizedUsername);
  if (existing) {
    return res.status(409).json({ error: `Username "${sanitizedUsername}" already exists` });
  }

  try {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const result = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run(
      sanitizedUsername,
      hash,
      sanitizedRole
    );

    return res.status(201).json({
      id: result.lastInsertRowid,
      username: sanitizedUsername,
      role: sanitizedRole,
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[USERS] Failed to create user:", err);
    return res.status(500).json({ error: "Failed to create user" });
  }
});

// 3. Update user role or reset password
usersRouter.patch("/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | { id: number; username: string; role: string }
    | undefined;

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const { role, password } = req.body;
  const updates: string[] = [];
  const params: any[] = [];

  if (role !== undefined) {
    const validRoles = ["admin", "operator", "viewer"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Role must be 'admin', 'operator', or 'viewer'" });
    }

    // Safety: If demoting an admin, ensure at least one other admin remains
    if (user.role === "admin" && role !== "admin") {
      const adminCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number }).count;
      if (adminCount <= 1) {
        return res.status(400).json({ error: "Cannot demote the only remaining administrator" });
      }
    }

    updates.push("role = ?");
    params.push(role);
  }

  if (password !== undefined) {
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long" });
    }
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    updates.push("password_hash = ?");
    params.push(hash);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  params.push(id);
  db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...params);

  const updated = db.prepare("SELECT id, username, role, created_at FROM users WHERE id = ?").get(id);
  return res.json({
    message: "User updated successfully",
    user: updated,
  });
});

// 4. Delete user
usersRouter.delete("/:id", (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  // Prevent admin from deleting themselves
  if (req.session && req.session.userId === id) {
    return res.status(400).json({ error: "You cannot delete your own account while logged in" });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | { id: number; username: string; role: string }
    | undefined;

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Prevent deleting the only remaining admin
  if (user.role === "admin") {
    const adminCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number }).count;
    if (adminCount <= 1) {
      return res.status(400).json({ error: "Cannot delete the only remaining administrator account" });
    }
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  return res.json({ message: `User "${user.username}" deleted successfully` });
});
