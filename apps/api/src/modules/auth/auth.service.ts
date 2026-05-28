import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { Env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";

const ACCESS_TTL = "15m";
const REFRESH_TTL_DAYS = 7;

export interface SafeUser {
  id: number;
  nombre: string;
  email: string;
  rol: string;
}

export async function login(
  env: Env,
  email: string,
  password: string
): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  }

  const valid = await verifyPassword(password, usuario.password);
  if (!valid) {
    throw Object.assign(new Error("Invalid credentials"), { status: 401 });
  }

  const user: SafeUser = {
    id: usuario.idUsuario,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
  };

  const accessToken = jwt.sign(user, env.JWT_SECRET, { expiresIn: ACCESS_TTL });
  const refreshToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: usuario.idUsuario,
      expiresAt,
    },
  });

  return { user, accessToken, refreshToken };
}

export async function refresh(
  env: Env,
  refreshToken: string
): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { usuario: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    throw Object.assign(new Error("Invalid refresh token"), { status: 401 });
  }

  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const u = stored.usuario;
  const user: SafeUser = {
    id: u.idUsuario,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
  };

  const accessToken = jwt.sign(user, env.JWT_SECRET, { expiresIn: ACCESS_TTL });
  const newRefresh = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

  await prisma.refreshToken.create({
    data: { token: newRefresh, userId: u.idUsuario, expiresAt },
  });

  return { user, accessToken, refreshToken: newRefresh };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
}

export async function register(
  nombre: string,
  email: string,
  password: string,
  rol = "usuario"
): Promise<SafeUser> {
  const existing = await prisma.usuario.findUnique({ where: { email } });
  if (existing) {
    throw Object.assign(new Error("Email already registered"), { status: 409 });
  }

  const hash = await bcrypt.hash(password, 10);
  const usuario = await prisma.usuario.create({
    data: { nombre, email, password: hash, rol },
  });

  return {
    id: usuario.idUsuario,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
  };
}

/** Supports Node bcrypt ($2a$, $2b$) and PHP bcrypt ($2y$) */
async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  const normalized = hash.startsWith("$2y$") ? hash.replace("$2y$", "$2a$") : hash;
  try {
    return await bcrypt.compare(plain, normalized);
  } catch {
    return false;
  }
}
