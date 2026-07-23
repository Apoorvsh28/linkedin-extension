import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../services/auth.service.js";
import { HttpError } from "./errorHandler.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  const session = token ? verifyToken(token) : null;
  if (!session) {
    next(new HttpError(401, "Unauthorized"));
    return;
  }
  next();
}
