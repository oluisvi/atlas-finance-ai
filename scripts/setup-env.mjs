import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const examplePath = resolve(root, ".env.example");

function secret(bytes = 48) {
  return randomBytes(bytes).toString("base64url");
}

if (existsSync(envPath)) {
  console.log(".env already exists — skipped.");
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error(".env.example not found.");
  process.exit(1);
}

let content = readFileSync(examplePath, "utf8");
content = content.replace(
  'JWT_ACCESS_SECRET="replace-with-strong-random-secret"',
  `JWT_ACCESS_SECRET="${secret()}"`,
);
content = content.replace(
  'JWT_REFRESH_SECRET="replace-with-strong-random-secret"',
  `JWT_REFRESH_SECRET="${secret()}"`,
);

copyFileSync(examplePath, envPath);
writeFileSync(envPath, content, "utf8");

console.log("Created .env from .env.example with generated JWT secrets.");
console.log("");
console.log("Next: edit .env and replace:");
console.log("  - <DB_PASSWORD> in DIRECT_URL and DATABASE_URL");
console.log("  - <REGION> in DATABASE_URL (e.g. sa-east-1)");
console.log("");
console.log("Then run:");
console.log("  npm run db:verify-catalog");
