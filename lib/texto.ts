// Utilidades de texto compartidas por el motor, los validadores y la búsqueda.

/** Minúsculas, sin tildes ni signos de puntuación, espacios simples. Conserva la ñ como n. */
export function normalizar(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[¡!¿?.,;:"'()[\]{}«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const escaparRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ¿Aparece `frase` como palabra(s) completa(s) dentro de `texto`? (ambos normalizados) */
export function contieneFrase(texto: string, frase: string): boolean {
  if (!frase) return false;
  return new RegExp(`(^| )${escaparRegex(frase)}( |$)`).test(texto);
}

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "e", "d.c."]);

/** "VALLE DEL CAUCA" → "Valle del Cauca" */
export function tipoTitulo(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w, i) => (i > 0 && PARTICULAS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/D\.c\./g, "D.C.");
}

/** Respuesta afirmativa/negativa en lenguaje natural. null si no es claro. */
export function interpretarSiNo(entrada: unknown): boolean | null {
  if (typeof entrada === "boolean") return entrada;
  const t = normalizar(entrada);
  if (!t || /^no (se|sabe|sabria|estoy seguro|estoy segura|recuerdo|me acuerdo)\b/.test(t)) return null;
  if (/^(no|nop|nope|negativo|n|nada|ninguno|ninguna|tampoco|para nada|no tengo)\b/.test(t)) return false;
  if (/^(si|sii+|sip|s|claro|correcto|correcta|afirmativo|yes|por supuesto|exacto|eso es|asi es|de acuerdo|ok|okay|dale|listo|confirmo|esta bien|bueno|perfecto|tengo|si tengo|si senor|si senora|ajam|aja)\b/.test(t))
    return true;
  return null;
}

/** Agrupa un documento para leerlo en voz alta: "1103679690" → "1.103.679.690" */
export function agruparDocumento(doc: string): string {
  if (!/^\d+$/.test(doc)) return doc.split("").join(" ");
  return doc.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Celular en grupos fáciles de leer: "3104567890" → "310 456 7890" */
export function agruparCelular(cel: string): string {
  return cel.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3");
}

export const formatoCOP = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

/** Quita marcas de formato ligero (**negrita**, [texto](url)) para lectura en voz alta. */
export function textoPlano(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[•·]/g, ",")
    .replace(/\n+/g, ". ");
}
