import { Router } from "express";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import * as authService from "../../modules/auth/auth.service.js";

function getCookieOptions(req: import("express").Request) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const isHttps =
    req.secure ||
    (typeof forwardedProto === "string" && forwardedProto.toLowerCase() === "https");

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax" as const,
    path: "/",
  };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export function authRoutes(env: Env): Router {
  const router = Router();
  const auth = createAuthMiddleware(env);

  router.post("/login", async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const { user, accessToken, refreshToken } = await authService.login(env, email, password);
      const COOKIE_OPTS = getCookieOptions(req);

      res.cookie("access_token", accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
      res.cookie("refresh_token", refreshToken, {
        ...COOKIE_OPTS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({ user });
    } catch (e) {
      next(e);
    }
  });

  router.post("/register", async (req, res, next) => {
    try {
      const data = registerSchema.parse(req.body);
      const user = await authService.register(data.nombre, data.email, data.password);
      res.status(201).json({ user });
    } catch (e) {
      next(e);
    }
  });

  router.post("/refresh", async (req, res, next) => {
    try {
      const token = req.cookies?.refresh_token ?? req.body?.refreshToken;
      if (!token) {
        res.status(401).json({ error: "No refresh token" });
        return;
      }
      const { user, accessToken, refreshToken } = await authService.refresh(env, token);
      const COOKIE_OPTS = getCookieOptions(req);

      res.cookie("access_token", accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
      res.cookie("refresh_token", refreshToken, {
        ...COOKIE_OPTS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({ user });
    } catch (e) {
      next(e);
    }
  });

  router.post("/logout", async (req, res, next) => {
    try {
      await authService.logout(req.cookies?.refresh_token);
      const COOKIE_OPTS = getCookieOptions(req);
      res.clearCookie("access_token", COOKIE_OPTS);
      res.clearCookie("refresh_token", COOKIE_OPTS);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.get("/me", auth, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
