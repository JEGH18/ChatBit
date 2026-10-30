/**
 * Carga datos SINTÉTICOS de demostración en la base configurada (DB_DRIVER/DATABASE_URL),
 * para que el panel /admin muestre indicadores durante la presentación.
 * Uso: npm run db:demo            (agrega 150 sesiones simuladas)
 *      npm run db:demo -- borrar  (borra solo las sesiones sintéticas)
 */
import { repositorio } from "@/lib/datos";
import { generarSintetico } from "@/lib/datos/sintetico";

for (const archivo of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(archivo);
  } catch {
    /* sin archivo */
  }
}

async function main() {
  const repo = await repositorio();
  await repo.borrarSinteticos();
  if (process.argv[2] === "borrar") return console.log(`Sesiones sintéticas borradas (${repo.nombre}).`);
  const { turnos, encuestas } = generarSintetico(Number(process.argv[2]) || 150);
  for (const t of turnos) await repo.guardarTurno(t);
  for (const e of encuestas) await repo.guardarEncuesta(e);
  console.log(`Listo (${repo.nombre}): ${new Set(turnos.map((t) => t.sesion.id)).size} sesiones sintéticas, ${turnos.length} turnos, ${encuestas.length} encuestas.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
