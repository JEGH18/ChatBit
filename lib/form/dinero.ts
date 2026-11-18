// Interpreta montos en pesos tal como los dice la gente:
// "1.500.000", "10 millones", "unos 2 millones al mes", "10 palos", "500 lucas",
// "dos millones y medio", "un millón doscientos mil", "15M", "800k".
import { normalizar } from "@/lib/texto";

export type Periodo = "dia" | "semana" | "quincena" | "mes" | "anio";
export type MontoInterpretado = { valor: number; periodo: Periodo | null };

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40,
  cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200,
  doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500,
  quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800,
  ochocientas: 800, novecientos: 900, novecientas: 900,
};

const MILLON = ["millon", "millones", "palo", "palos", "melon", "melones", "mill", "mm", "m"];
const MIL = ["mil", "lucas", "luca", "k"];

export function detectarPeriodo(texto: string): Periodo | null {
  const t = normalizar(texto);
  if (/\b(al|por|cada|en un|en el) (dia|diario)\b|\bdiari[oa]s?\b|\b(al|por) dia\b|\bun dia\b/.test(t)) return "dia";
  if (/\b(a la|por|cada|en una|en la) semana\b|\bsemanal(es|mente)?\b/.test(t)) return "semana";
  if (/\bquincena(l|les)?\b/.test(t)) return "quincena";
  if (/\b(al|por|cada|en un|en el) mes\b|\bmensual(es|mente)?\b|\bmes a mes\b/.test(t)) return "mes";
  if (/\b(al|por|en el|en un|cada|el) ano\b|\banual(es|mente)?\b|\b(todo|el) ano\b|\bano pasado\b/.test(t)) return "anio";
  return null;
}

/** Convierte palabras numéricas a dígitos: "dos millones y medio" → "2.5 millones". */
function palabrasANumeros(t: string): string {
  const tokens = t.split(" ");
  const salida: string[] = [];
  let acumulado: number | null = null;
  const volcar = () => {
    if (acumulado !== null) salida.push(String(acumulado));
    acumulado = null;
  };
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    if (w in UNIDADES) {
      acumulado = (acumulado ?? 0) + UNIDADES[w];
    } else if (w === "y" && acumulado !== null && tokens[i + 1] && tokens[i + 1] in UNIDADES && UNIDADES[tokens[i + 1]] < 10) {
      // "treinta y cinco"
      continue;
    } else if (w === "mil" && acumulado !== null && !MILLON.includes(tokens[i + 1] ?? "")) {
      acumulado *= 1000;
    } else {
      volcar();
      salida.push(w);
    }
  }
  volcar();
  return salida.join(" ");
}

function numeroDesdeCifra(raw: string): number | null {
  let num = raw.replace(/[.,]$/, "");
  const seps = num.match(/[.,]/g) ?? [];
  // Un solo separador seguido de 1 o 2 dígitos es decimal ("2,5" o "1.5"); si no, son miles.
  const decimal = seps.length === 1 && /[.,]\d{1,2}$/.test(num);
  num = decimal ? num.replace(",", ".") : num.replace(/[.,]/g, "");
  const v = Number(num);
  return Number.isFinite(v) ? v : null;
}

/**
 * Devuelve el primer monto del texto en pesos (entero) y el periodo mencionado, o null.
 * No decide si el monto es plausible: eso lo hace el motor (pide confirmación).
 */
export function interpretarMonto(entrada: unknown): MontoInterpretado | null {
  if (typeof entrada === "number") return Number.isFinite(entrada) ? { valor: Math.round(entrada), periodo: null } : null;
  const original = String(entrada ?? "");
  const periodo = detectarPeriodo(original);
  // Como normalizar(), pero conserva los separadores de miles y decimales entre dígitos.
  let t = original
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[$¡!¿?;:"'()]/g, " ")
    .replace(/(\d)\s*([km])\b/g, "$1 $2")
    .replace(/[.,](?!\d)/g, " ")
    .replace(/(^|[^\d])[.,]/g, "$1 ")
    .replace(/\b(\d{1,3})((?: \d{3})+)\b/g, (m) => m.replace(/ /g, ""))
    .replace(/\b(cop|pesos?|de pesos|aprox|aproximadamente|mas o menos|unos|unas|como|cerca de|alrededor de|casi)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  t = palabrasANumeros(t);
  t = t.replace(/(^|[^\d ] ?|^ )mil millones\b/g, "$11 milmillones").replace(/\bmil millones\b/g, "milmillones");

  const m = t.match(/(\d[\d.,]*)\s*(milmillones|millones|millon|palos?|melon(es)?|mill|mm|m|mil|lucas?|k)?\b(\s+y\s+medio)?/);
  let valor: number | null = null;
  if (m) {
    valor = numeroDesdeCifra(m[1]);
    if (valor === null) return null;
    const unidad = m[2] ?? "";
    let mult = 1;
    if (unidad === "milmillones") mult = 1e9;
    else if (MILLON.includes(unidad) || unidad.startsWith("millon") || unidad.startsWith("palo") || unidad.startsWith("melon")) mult = 1e6;
    else if (MIL.includes(unidad) || unidad.startsWith("luca")) mult = 1e3;
    if (m[4]) valor += 0.5;
    valor *= mult;
    // "un millón doscientos mil": suma lo que sigue si es un monto menor
    if (mult === 1e6) {
      const resto = t.slice((m.index ?? 0) + m[0].length).match(/^\s*(?:y\s+)?(\d[\d.,]*)\s*(mil|lucas?|k)?\b/);
      if (resto) {
        const extra = numeroDesdeCifra(resto[1]);
        if (extra !== null) valor += resto[2] ? extra * 1e3 : extra < 1e6 ? extra : 0;
      }
    }
  } else if (/\b(un|medio) (millon|palo|melon)\b/.test(normalizar(original))) {
    valor = /\bmedio\b/.test(normalizar(original)) ? 5e5 : 1e6;
  } else if (/\bpalo y medio\b/.test(t)) {
    valor = 1.5e6;
  }
  if (valor === null) return null;
  return { valor: Math.round(valor), periodo };
}

/** Lleva un monto de cualquier periodo a su equivalente anual. */
export function anualizar(valor: number, periodo: Periodo | null, diasPorSemana = 6): number {
  switch (periodo) {
    case "dia":
      return Math.round(valor * diasPorSemana * 52);
    case "semana":
      return Math.round(valor * 52);
    case "quincena":
      return Math.round(valor * 24);
    case "mes":
      return Math.round(valor * 12);
    default:
      return Math.round(valor);
  }
}

export type Estimacion = {
  ventaDiaria?: number;
  diasPorSemana?: number;
  ventaSemanal?: number;
  ventaMensual?: number;
  mesesTrabajados?: number;
};

export type ResultadoEstimacion = { total: number; pasos: string[] };

/** Estimación transparente de ventas anuales a partir de lo que la persona sabe. */
export function estimarVentasAnuales(e: Estimacion): ResultadoEstimacion | null {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;
  const meses = e.mesesTrabajados && e.mesesTrabajados > 0 && e.mesesTrabajados <= 12 ? e.mesesTrabajados : 12;
  const pasos: string[] = [];
  let mensual: number | null = null;
  if (e.ventaMensual) {
    mensual = e.ventaMensual;
  } else if (e.ventaSemanal) {
    mensual = e.ventaSemanal * 4.33;
    pasos.push(`${fmt(e.ventaSemanal)} a la semana × 4,33 semanas = ${fmt(mensual)} al mes`);
  } else if (e.ventaDiaria && e.diasPorSemana) {
    const semanal = e.ventaDiaria * e.diasPorSemana;
    mensual = semanal * 4.33;
    pasos.push(`${fmt(e.ventaDiaria)} al día × ${e.diasPorSemana} días = ${fmt(semanal)} a la semana`);
    pasos.push(`${fmt(semanal)} × 4,33 semanas = ${fmt(mensual)} al mes`);
  }
  if (mensual === null) return null;
  const total = Math.round(mensual * meses);
  pasos.push(`${fmt(mensual)} al mes × ${meses} meses = ${fmt(total)} al año`);
  return { total, pasos };
}
