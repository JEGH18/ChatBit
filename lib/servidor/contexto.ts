// Contexto dinámico del motor: lo que el asistente aprendió de forma responsable
// (sinónimos CIIU confirmados y respuestas aprobadas por un humano). Se cachea 60 s.
import type { ContextoMotor } from "@/lib/conversacion/motor";
import { repositorio } from "@/lib/datos";

let cache: { hasta: number; ctx: ContextoMotor } | null = null;

export async function obtenerContextoMotor(): Promise<ContextoMotor> {
  if (cache && cache.hasta > Date.now()) return cache.ctx;
  try {
    const repo = await repositorio();
    const [aprendidosCiiu, faqExtra] = await Promise.all([repo.sinonimos(300), repo.faqAprobadas()]);
    cache = { hasta: Date.now() + 60_000, ctx: { aprendidosCiiu, faqExtra } };
  } catch {
    cache = { hasta: Date.now() + 10_000, ctx: {} };
  }
  return cache.ctx;
}

export function invalidarContexto() {
  cache = null;
}
