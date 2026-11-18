// Límite de uso en el servidor (además del contador por sesión que viaja en el estado).
// En memoria y por instancia: suficiente para un prototipo; en producción, usar un almacén
// compartido (p. ej. Upstash/Redis) o el firewall de la plataforma.
import { CONFIG } from "@/lib/config";

type Ventana = { n: number; desde: number };
const g = globalThis as unknown as { __limitesNeo?: { ip: Map<string, Ventana>; sesion: Map<string, number> } };
const almacen = (g.__limitesNeo ??= { ip: new Map(), sesion: new Map() });

// Generoso: muchas personas comparten IP (redes móviles con NAT, cafés internet, puntos de atención).
const POR_IP_MINUTO = Number(process.env.LIMITE_IP_MINUTO || 120);

export function permitir(ip: string, sesionId: string): { ok: true } | { ok: false; motivo: "ip" | "sesion" } {
  const ahora = Date.now();
  const v = almacen.ip.get(ip);
  if (!v || ahora - v.desde > 60_000) almacen.ip.set(ip, { n: 1, desde: ahora });
  else if (++v.n > POR_IP_MINUTO) return { ok: false, motivo: "ip" };

  const n = (almacen.sesion.get(sesionId) ?? 0) + 1;
  almacen.sesion.set(sesionId, n);
  // Margen sobre el límite visible (los botones también cuentan como peticiones).
  if (n > CONFIG.maxMensajesSesion * 2) return { ok: false, motivo: "sesion" };
  if (almacen.sesion.size > 50_000) almacen.sesion.clear();
  return { ok: true };
}
