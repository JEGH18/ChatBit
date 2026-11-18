// Configuración del CLI de Prisma 7. El esquema depende del motor elegido (DB_DRIVER).
import { defineConfig } from "prisma/config";

for (const archivo of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(archivo);
  } catch {
    /* el archivo no existe: se usan las variables del entorno */
  }
}

const postgres = process.env.DB_DRIVER === "postgres";

export default defineConfig({
  schema: postgres ? "prisma/postgres/schema.prisma" : "prisma/schema.prisma",
  migrations: { path: postgres ? "prisma/postgres/migrations" : "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" },
});
