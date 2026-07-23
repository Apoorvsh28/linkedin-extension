import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { issueToken } from "../services/auth.service.js";

export const authRouter: Router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

// POST /api/auth/login
authRouter.post("/login", (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    if (!safeEqual(email, env.adminEmail) || !safeEqual(password, env.adminPassword)) {
      throw new HttpError(401, "Invalid email or password");
    }
    res.json({ token: issueToken(email), email });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ email: env.adminEmail });
});
