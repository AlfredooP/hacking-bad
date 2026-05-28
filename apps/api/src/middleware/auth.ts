import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Env } from "../config/env.js";

export interface AuthUser {
  id: number;
  email: string;
  rol: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function createAuthMiddleware(env: Env) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token =
      req.cookies?.access_token ??
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null);

    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
      req.user = payload;
      next();
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.rol)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
