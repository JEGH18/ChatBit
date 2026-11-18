// Acceso al panel administrativo con una contraseña simple (variable de entorno) y una cookie
// firmada con HMAC. Suficiente para un prototipo; en producción se usaría el SSO de la entidad.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "neo_admin";
const DURACION_S = 8 * 3600;

const secreto = () => process.env.ADMIN_SECRET || `neo-${process.env.ADMIN_PASSWORD ?? ""}-sin-secreto`;

function firmar(valor: string) {
  return createHmac("sha256", secreto()).update(valor).digest("base64url");
}

function iguales(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function adminConfigurado() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function claveCorrecta(intento: string) {
  const clave = process.env.ADMIN_PASSWORD;
  return !!clave && iguales(firmar(intento), firmar(clave));
}

export async function abrirSesionAdmin() {
  const vence = Math.floor(Date.now() / 1000) + DURACION_S;
  (await cookies()).set(COOKIE, `${vence}.${firmar(String(vence))}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_S,
  });
}

export async function cerrarSesionAdmin() {
  (await cookies()).delete(COOKIE);
}

export async function esAdmin(): Promise<boolean> {
  if (!adminConfigurado()) return false;
  const valor = (await cookies()).get(COOKIE)?.value;
  if (!valor) return false;
  const [vence, firma] = valor.split(".");
  return Number(vence) > Date.now() / 1000 && !!firma && iguales(firma, firmar(vence));
}

// Límite simple de intentos de ingreso por IP (en memoria).
const intentos = new Map<string, { n: number; desde: number }>();
export function puedeIntentar(ip: string) {
  const ahora = Date.now();
  const r = intentos.get(ip);
  if (!r || ahora - r.desde > 60_000) {
    intentos.set(ip, { n: 1, desde: ahora });
    return true;
  }
  r.n++;
  return r.n <= 5;
}
