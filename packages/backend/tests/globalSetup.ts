import { execSync } from "node:child_process";

const TEST_DATABASE_URL = "postgresql://lgx:lgx@localhost:5432/leadsdb_test";

export default function globalSetup(): void {
  execSync("pnpm exec prisma migrate deploy", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}