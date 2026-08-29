import session from "express-session";

export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "live-stream-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.USE_HTTPS === "true",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});
