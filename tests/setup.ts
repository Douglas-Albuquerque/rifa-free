process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://rifas:rifas_dev_password@localhost:55432/rifas_test?schema=public";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret-with-at-least-32-characters-long";
process.env.APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";
