import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const email = process.env.ADMIN_EMAIL ?? "admin@bin.local";
const password = process.env.ADMIN_PASSWORD ?? "password123";

const prisma = new PrismaClient();
const hash = await bcrypt.hash(password, 10);

await prisma.usuario.upsert({
  where: { email },
  create: {
    nombre: "Admin BIN",
    email,
    password: hash,
    rol: "admin",
  },
  update: { password: hash },
});

console.log(`Admin listo: ${email} / ${password}`);
await prisma.$disconnect();
