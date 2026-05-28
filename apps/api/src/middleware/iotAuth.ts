import type { NextFunction, Request, Response } from "express";
import type { Env } from "../config/env.js";

export function createIotAuthMiddleware(env: Env) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== env.IOT_API_KEY) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    next();
  };
}
