import { execSync } from "node:child_process";

const DEFAULT_TEST_URL = "postgresql://rifas:rifas_dev_password@localhost:55432/rifas_test?schema=public";

export default function setup() {
  const databaseUrl = process.env.TEST_DATABASE_URL || DEFAULT_TEST_URL;

  console.log("Aplicando migrações no banco de testes...");
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });
}
