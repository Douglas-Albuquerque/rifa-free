import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [argEmail, argSenha, argNome] = process.argv.slice(2);
  const email = (argEmail || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const senha = argSenha || process.env.ADMIN_PASSWORD || "";
  const nome = (argNome || process.env.ADMIN_NAME || "Organizador").trim();

  if (!email || !senha) {
    throw new Error(
      "Uso: npm run admin:create -- <email> <senha> [nome]\nOu defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente.",
    );
  }
  if (senha.length < 10) {
    throw new Error("A senha deve ter pelo menos 10 caracteres.");
  }

  const senhaHash = await bcrypt.hash(senha, 12);
  const user = await prisma.adminUser.upsert({
    where: { email },
    create: { email, nome, senhaHash },
    update: { nome, senhaHash },
  });

  console.log(`Administrador ${user.email} criado/atualizado.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
