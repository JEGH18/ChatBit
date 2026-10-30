// Protecciones de seguridad y privacidad que se aplican en código (no dependen de la IA).
import { normalizar } from "@/lib/texto";

/** ¿La persona está compartiendo una clave, un código OTP o un número de tarjeta? */
export function detectarDatoProhibido(texto: string): "clave" | "otp" | "tarjeta" | null {
  const t = normalizar(texto);
  if (/\b(contrasena|password|clave (del banco|bancaria|de internet|de la tarjeta|secreta)|mi clave es|la clave es|pin)\b/.test(t)) return "clave";
  if (/\b(otp|codigo (de verificacion|que me llego|de seguridad|de confirmacion|del mensaje|sms)|token)\b/.test(t) && /\d{4,8}/.test(texto))
    return "otp";
  const digitos = texto.replace(/[\s-]/g, "").match(/\d{13,19}/)?.[0];
  if (digitos && luhn(digitos)) return "tarjeta";
  return null;
}

function luhn(num: string): boolean {
  let suma = 0;
  let doble = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (doble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    doble = !doble;
  }
  return suma % 10 === 0;
}

const PATRONES_INYECCION = [
  /\b(ignora|ignore|olvida|omite|salta(te)?)\b.{0,40}\b(instrucciones|reglas|indicaciones|instructions|prompt)\b/,
  /\b(system prompt|prompt del sistema|tus instrucciones|your instructions|mensaje del sistema|instrucciones internas)\b/,
  /\b(muestrame|revela|dime|imprime|repite|ensena)\b.{0,30}\b(prompt|instrucciones|herramientas|tools|configuracion)\b/,
  /\b(actua como|act as|eres ahora|ahora eres|a partir de ahora eres|modo desarrollador|developer mode|jailbreak|dan mode)\b/,
  /<\/?(system|assistant|tool)[^>]*>/,
  /\b(cambia|modifica)\b.{0,20}\b(tus reglas|tu rol|tus instrucciones)\b/,
];

/** Heurística de defensa contra prompt injection. La IA además tiene reglas en el system prompt. */
export function detectarInyeccion(texto: string): boolean {
  const t = normalizar(texto);
  const crudo = texto.toLowerCase();
  return PATRONES_INYECCION.some((re) => re.test(t) || re.test(crudo));
}

/**
 * Quita datos personales de un texto antes de guardarlo en analítica, en la bandeja de preguntas
 * o en el aprendizaje de sinónimos CIIU. Además de patrones (correo, celular, documento), borra
 * los valores exactos que la persona dio en el formulario (nombre, apellido, etc.).
 */
export function redactarPII(texto: string, conocidos: (string | undefined)[] = []): string {
  let s = String(texto ?? "");
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[correo]");
  s = s.replace(/(?:\+?57[\s-]*)?\b3\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g, "[celular]");
  s = s.replace(/\b\d{1,3}(?:[.\s]\d{3}){1,3}\b|\b\d{6,}\b/g, (m) => (m.replace(/\D/g, "").length >= 6 ? "[número]" : m));
  for (const v of conocidos) {
    if (!v || v.length < 3) continue;
    const re = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    s = s.replace(re, "[dato]");
  }
  // Nombres después de "me llamo", "soy", "mi nombre es".
  s = s.replace(/\b(me llamo|mi nombre es|soy)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+){0,3})/g, "$1 [nombre]");
  return s.slice(0, 500);
}
