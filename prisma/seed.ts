import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const nome = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.ADMIN_PASSWORD;

  if (!nome || !email || !senha) {
    throw new Error("Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD no ambiente para criar o administrador.");
  }
  if (senha.length < 10) {
    throw new Error("ADMIN_PASSWORD deve ter pelo menos 10 caracteres.");
  }

  const existente = await prisma.adminUser.findUnique({ where: { email } });
  if (existente) {
    console.log(`Administrador ${email} já existe. Nenhuma alteração feita.`);
    return;
  }

  const senhaHash = await bcrypt.hash(senha, 12);
  await prisma.adminUser.create({ data: { nome, email, senhaHash } });
  console.log(`Administrador ${email} criado com sucesso.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
