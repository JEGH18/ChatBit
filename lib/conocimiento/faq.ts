// Base de conocimiento ligera (RAG léxico) sobre preguntas frecuentes de Neocrédito.
// Fuente: data/faq/*.md (versionados) + respuestas aprobadas por un humano en /admin.
import indice from "@/data/faq/indice.json";
import { normalizar } from "@/lib/texto";

export type EntradaFaq = { id: string; pregunta: string; palabras: string[]; respuesta: string; fuente: string };
export type ResultadoFaq = { entrada: EntradaFaq; puntaje: number };

export const FAQ_BASE: EntradaFaq[] = (indice as { entradas: EntradaFaq[] }).entradas;

const VACIAS = new Set(
  "a al como con cual cuales de del el en es esta este eso hay la las le lo los me mi mis no o para pero por que se si su sus te tengo un una y ya yo usted ustedes ella el puedo puede quiero saber hola buenas buenos dias tardes".split(
    " ",
  ),
);

const raiz = (p: string) => (p.length > 4 && p.endsWith("es") ? p.slice(0, -2) : p.length > 3 && p.endsWith("s") ? p.slice(0, -1) : p);
const terminos = (s: string) =>
  normalizar(s)
    .split(" ")
    .filter((p) => p.length > 2 && !VACIAS.has(p))
    .map(raiz);

/** Umbral mínimo para considerar que la base sabe responder. Debajo, la pregunta va a la bandeja. */
export const UMBRAL_FAQ = 0.34;

export function buscarFaq(pregunta: string, extra: EntradaFaq[] = []): ResultadoFaq | null {
  const q = normalizar(pregunta);
  const tq = new Set(terminos(pregunta));
  if (!tq.size) return null;
  let mejor: ResultadoFaq | null = null;
  for (const e of [...FAQ_BASE, ...extra]) {
    // Frases clave completas pesan más que palabras sueltas.
    let frase = 0;
    for (const p of e.palabras) if (p.includes(" ") && q.includes(normalizar(p))) frase = Math.max(frase, 0.6);
    const te = new Set(terminos(`${e.pregunta} ${e.palabras.join(" ")}`));
    let comunes = 0;
    for (const t of tq) if (te.has(t)) comunes++;
    const cobertura = comunes / tq.size;
    const puntaje = Math.min(1, frase + cobertura * 0.7);
    if (!mejor || puntaje > mejor.puntaje) mejor = { entrada: e, puntaje };
  }
  return mejor && mejor.puntaje >= UMBRAL_FAQ ? mejor : null;
}

const INTERROGATIVOS =
  /^(que|qué|como|cómo|cuanto|cuánto|cuanta|cuando|cuándo|donde|dónde|por que|porque|para que|cual|cuál|quien|quién|puedo|se puede|es necesario|necesito|hay que|tengo que|cobran|me van|ustedes|eso es|esto es|y si|es seguro|es gratis)\b/;

export function parecePregunta(texto: string): boolean {
  if (texto.includes("?")) return true;
  const t = normalizar(texto);
  // "como 2 millones", "como unos 80 mil": aquí "como" significa "aproximadamente".
  if (/^(como|cuanto|que)\s+(\d|unos?\b|unas?\b|mas o menos|de \d|medio|dos|tres|cien|mil)/.test(t)) return false;
  return INTERROGATIVOS.test(t);
}
