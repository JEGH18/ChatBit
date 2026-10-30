// Catálogo CIIU Rev. 4 A.C. y búsqueda por descripción en lenguaje natural.
//
// - data/ciiu/frecuentes.json: ~170 actividades frecuentes en microempresas, con explicación sencilla
//   y palabras coloquiales. Es el catálogo por defecto para sugerir.
// - data/ciiu/catalogo-completo.json: todas las clases (se regenera con scripts/datos/importar-ciiu.ts).
//   Se usa para validar cualquier código y como respaldo de la búsqueda.
import completo from "@/data/ciiu/catalogo-completo.json";
import frecuentes from "@/data/ciiu/frecuentes.json";
import { normalizar } from "@/lib/texto";

export type ClaseCiiu = { codigo: string; descripcion: string; corto?: string; simple?: string; palabras?: string };
export type SugerenciaCiiu = { codigo: string; descripcion: string; corto: string; simple: string; puntaje: number };
/** Pareja aprendida (descripción anonimizada → código confirmado por una persona). */
export type SinonimoAprendido = { descripcion: string; codigo: string; veces: number };

export const CIIU_FRECUENTES: ClaseCiiu[] = (frecuentes as { clases: ClaseCiiu[] }).clases;
const CIIU_COMPLETO: ClaseCiiu[] = (completo as { clases: ClaseCiiu[] }).clases;

const POR_CODIGO = new Map<string, ClaseCiiu>();
for (const c of CIIU_COMPLETO) POR_CODIGO.set(c.codigo, c);
for (const c of CIIU_FRECUENTES) POR_CODIGO.set(c.codigo, { ...POR_CODIGO.get(c.codigo), ...c });

/** Códigos que se muestran como botones cuando la persona no sabe por dónde empezar. */
export const CIIU_POPULARES = ["4711", "5619", "1410", "9602", "4771", "5611"];

export function claseCiiu(codigo: string | undefined): ClaseCiiu | undefined {
  return codigo ? POR_CODIGO.get(codigo) : undefined;
}

export function existeCiiu(codigo: string) {
  return POR_CODIGO.has(codigo);
}

/** "2620 - Fabricación de computadoras y de equipo periférico" (como en el formulario real). */
export function etiquetaCiiu(codigo: string | undefined): string {
  const c = claseCiiu(codigo);
  return c ? `${c.codigo} - ${c.descripcion}` : "";
}

const VACIAS = new Set(
  (
    "a al algo algunos alla aqui asi casa con como de del desde donde el ella ellos en entre era es esa ese eso esta este esto estoy hace hacer hago " +
    "la las le lo los me mi mis mucho muy negocio nos o para pero por porque que se ser si sin sobre soy su sus tambien tengo tiene trabajo trabajar " +
    "un una uno unos vendo venta ventas vender y ya yo dedico dedica dedicamos hacemos tenemos vendemos mio mia propio propia pequeno pequena " +
    "cosas tipo clase otros otras producto productos servicio servicios actividad empresa emprendimiento micro microempresa esquina barrio"
  ).split(" "),
);

/** Raíz muy simple para español: quita plurales y algunas terminaciones frecuentes. */
function raiz(p: string): string {
  if (p.length > 5 && p.endsWith("ces")) return p.slice(0, -3) + "z";
  if (p.length > 4 && p.endsWith("es")) return p.slice(0, -2);
  if (p.length > 3 && p.endsWith("s")) return p.slice(0, -1);
  return p;
}

function terminos(texto: string): string[] {
  return normalizar(texto)
    .split(" ")
    .filter((p) => p.length >= 3 && !VACIAS.has(p))
    .map(raiz);
}

type Indice = { clase: ClaseCiiu; fuerte: Set<string>; debil: Set<string> };

function indexar(clases: ClaseCiiu[]): Indice[] {
  return clases.map((c) => ({
    clase: c,
    // "palabras" y nombre corto son vocabulario coloquial: pesan más.
    fuerte: new Set(terminos(`${c.palabras ?? ""} ${c.corto ?? ""}`)),
    debil: new Set(terminos(`${c.descripcion} ${c.simple ?? ""}`)),
  }));
}

const INDICE_FRECUENTES = indexar(CIIU_FRECUENTES);
const INDICE_COMPLETO = indexar(CIIU_COMPLETO.filter((c) => !CIIU_FRECUENTES.some((f) => f.codigo === c.codigo)));

function puntuar(consulta: string[], idx: Indice): number {
  let p = 0;
  for (const t of consulta) {
    if (idx.fuerte.has(t)) p += 3;
    else if (idx.debil.has(t)) p += 1.5;
    else if (t.length >= 5 && [...idx.fuerte].some((f) => f.startsWith(t) || t.startsWith(f))) p += 1.5;
  }
  return p;
}

function aSugerencia(c: ClaseCiiu, puntaje: number): SugerenciaCiiu {
  return {
    codigo: c.codigo,
    descripcion: c.descripcion,
    corto: c.corto ?? c.descripcion,
    simple: c.simple ?? c.descripcion,
    puntaje: Math.round(puntaje * 10) / 10,
  };
}

/**
 * Sugiere códigos CIIU para una descripción libre ("vendo empanadas en la esquina").
 * Combina: código explícito de 4 dígitos, sinónimos aprendidos de personas anteriores
 * (mejora continua) y búsqueda léxica sobre el catálogo curado y el completo.
 */
export function sugerirCiiu(descripcion: string, aprendidos: SinonimoAprendido[] = [], limite = 3): SugerenciaCiiu[] {
  const codigo = descripcion.match(/\b(\d{4})\b/)?.[1];
  if (codigo && POR_CODIGO.has(codigo)) return [aSugerencia(POR_CODIGO.get(codigo)!, 100)];

  const consulta = terminos(descripcion);
  if (!consulta.length) return [];
  const puntajes = new Map<string, number>();
  const sumar = (cod: string, p: number) => puntajes.set(cod, (puntajes.get(cod) ?? 0) + p);

  for (const idx of INDICE_FRECUENTES) {
    const p = puntuar(consulta, idx);
    if (p > 0) sumar(idx.clase.codigo, p);
  }
  // El catálogo completo solo aporta si el curado no encontró nada fuerte.
  const mejorCurado = Math.max(0, ...puntajes.values());
  if (mejorCurado < 3) {
    for (const idx of INDICE_COMPLETO) {
      const p = puntuar(consulta, idx) * 0.8;
      if (p > 0) sumar(idx.clase.codigo, p);
    }
  }
  // Few-shot dinámico: descripciones parecidas que otras personas confirmaron.
  const setConsulta = new Set(consulta);
  for (const s of aprendidos) {
    const ts = terminos(s.descripcion);
    if (!ts.length || !POR_CODIGO.has(s.codigo)) continue;
    const comunes = ts.filter((t) => setConsulta.has(t)).length;
    const similitud = comunes / Math.max(ts.length, consulta.length);
    if (similitud >= 0.5) sumar(s.codigo, 4 * similitud * Math.min(1 + Math.log2(s.veces), 3));
  }

  const ranking = [...puntajes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limite);
  const res = ranking.map(([cod, p]) => aSugerencia(POR_CODIGO.get(cod)!, p));
  // Siempre se ofrecen `limite` opciones (mismo trato para todos): si faltan, se completan con
  // actividades frecuentes de la misma división CIIU (2 primeros dígitos) que la mejor opción.
  if (res.length && res.length < limite) {
    const division = res[0].codigo.slice(0, 2);
    const seccion = res[0].codigo.slice(0, 1);
    const relleno = [
      ...CIIU_FRECUENTES.filter((c) => c.codigo.startsWith(division)),
      ...CIIU_FRECUENTES.filter((c) => c.codigo.startsWith(seccion)),
      ...CIIU_POPULARES.map((c) => POR_CODIGO.get(c)!),
    ];
    for (const c of relleno) {
      if (res.length >= limite) break;
      if (!res.some((r) => r.codigo === c.codigo)) res.push(aSugerencia(c, 0));
    }
  }
  return res;
}

/** Candidatos amplios para que un modelo de lenguaje re-ordene (top-k más grande). */
export function candidatosCiiu(descripcion: string, aprendidos: SinonimoAprendido[] = [], k = 12) {
  return sugerirCiiu(descripcion, aprendidos, k);
}

export function sugerenciaDe(codigo: string): SugerenciaCiiu | undefined {
  const c = POR_CODIGO.get(codigo);
  return c ? aSugerencia(c, 0) : undefined;
}
