import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  adminEmail: required("ADMIN_EMAIL"),
  adminPassword: required("ADMIN_PASSWORD"),
  authSecret: process.env.AUTH_SECRET ?? required("ADMIN_PASSWORD"),
};
