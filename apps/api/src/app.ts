import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import type { Env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { v1Routes } from "./routes/v1/index.js";

export function createApp(env: Env) {
  const app = express();
  // Needed so req.secure reflects X-Forwarded-Proto from nginx
  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "bin-api" });
  });

  app.use("/v1", v1Routes(env));

  app.use(errorHandler);

  return app;
}
