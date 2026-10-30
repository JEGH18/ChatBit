// Contexto dinámico del motor: lo que el asistente aprendió de forma responsable
// (sinónimos CIIU confirmados y respuestas aprobadas por un humano). Se cachea 60 s.
import type { ContextoMotor } from "@/lib/conversacion/motor";
import { repositorio } from "@/lib/datos";

// En globalThis: Next empaqueta por separado las rutas de API y las server actions, y el estado de
// módulo no se comparte entre ellas. Así, aprobar una respuesta en /admin invalida la caché del chat.
const g = globalThis as unknown as { __contextoNeo?: { hasta: number; ctx: ContextoMotor } | null };

export async function obtenerContextoMotor(): Promise<ContextoMotor> {
  const cache = g.__contextoNeo;
  if (cache && cache.hasta > Date.now()) return cache.ctx;
  try {
    const repo = await repositorio();
    const [aprendidosCiiu, faqExtra] = await Promise.all([repo.sinonimos(300), repo.faqAprobadas()]);
    g.__contextoNeo = { hasta: Date.now() + 60_000, ctx: { aprendidosCiiu, faqExtra } };
  } catch {
    g.__contextoNeo = { hasta: Date.now() + 10_000, ctx: {} };
  }
  return g.__contextoNeo!.ctx;
}

export function invalidarContexto() {
  g.__contextoNeo = null;
}
