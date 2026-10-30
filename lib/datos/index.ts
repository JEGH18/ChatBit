// Selección del repositorio según DB_DRIVER (sqlite | postgres | memoria).
// En Vercel, sin DB_DRIVER, se usa memoria (el disco es de solo lectura).
import { RepositorioMemoria } from "./memoria";
import type { Repositorio } from "./tipos";

const global_ = globalThis as unknown as { __repoNeo?: Promise<Repositorio> };

async function crear(): Promise<Repositorio> {
  const driver = process.env.DB_DRIVER ?? (process.env.VERCEL ? "memoria" : "sqlite");
  if (driver === "sqlite" || driver === "postgres") {
    try {
      const { crearClientePrisma, RepositorioPrisma } = await import("./prisma");
      const db = await crearClientePrisma(driver);
      await db.$queryRawUnsafe("SELECT 1");
      return new RepositorioPrisma(db, driver);
    } catch (e) {
      console.warn(`No se pudo conectar a la base de datos (${driver}); se usa memoria.`, e instanceof Error ? e.message : e);
    }
  }
  return new RepositorioMemoria();
}

export function repositorio(): Promise<Repositorio> {
  global_.__repoNeo ??= crear();
  return global_.__repoNeo;
}

export type { Repositorio } from "./tipos";
