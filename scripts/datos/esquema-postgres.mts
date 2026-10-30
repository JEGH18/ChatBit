/**
 * Genera prisma/postgres/schema.prisma a partir de prisma/schema.prisma (misma estructura,
 * proveedor postgresql y cliente generado en otra carpeta). Así hay una sola fuente de verdad.
 * Uso: npm run db:esquema-postgres
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";

const base = await readFile("prisma/schema.prisma", "utf8");
const pg = base
  .replace('provider = "sqlite"', 'provider = "postgresql"')
  .replace('output   = "../lib/generated/prisma"', 'output   = "../../lib/generated/prisma-pg"')
  .replace(/^\/\/ La versión para Postgres[\s\S]*?\n\n/m, "// ARCHIVO GENERADO desde prisma/schema.prisma. No lo edite a mano.\n\n");
await mkdir("prisma/postgres", { recursive: true });
await writeFile("prisma/postgres/schema.prisma", pg);
console.log("prisma/postgres/schema.prisma actualizado");
