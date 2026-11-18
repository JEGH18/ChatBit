/**
 * Evaluación de extracción de campos y clasificación CIIU sobre evals/dataset.json.
 *
 *   npm run evals            → reglas (modo guiado) y búsqueda léxica CIIU (sin internet)
 *   npm run evals -- --ia    → además Claude (requiere ANTHROPIC_API_KEY; consume tokens)
 *   npm run evals -- --dataset evals/dataset-prueba.json   → conjunto de prueba (no usado para ajustar)
 *
 * Métricas: precisión, cobertura (recall) y F1 por campo; coincidencia exacta por mensaje;
 * CIIU top-1 y top-3. Guarda el detalle en evals/resultados/ultimo.json.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { generateText, isStepCount } from "ai";
import { estadoInicial } from "@/lib/conversacion/estado";
import { extraerCampos } from "@/lib/conversacion/extractor";
import { Turnero } from "@/lib/conversacion/motor";
import { ORDEN, type CampoId } from "@/lib/form/campos";
import { sugerirCiiu } from "@/lib/form/ciiu";
import { interpretarCampo, type Valores } from "@/lib/form/validadores";
import { clasificarCiiu } from "@/lib/ia/ciiu";
import { crearHerramientas } from "@/lib/ia/herramientas";
import { MODELO_PRINCIPAL, modeloPrincipal, opcionesProveedor } from "@/lib/ia/modelo";
import { sistemaEstado, sistemaFijo } from "@/lib/ia/prompt";

for (const archivo of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(archivo);
  } catch {
    /* sin archivo */
  }
}

type Caso = { id: string; mensaje: string; campos?: Partial<Record<CampoId, unknown>>; ciiu?: string[]; nota?: string };

/** Extracción con reglas: igual que el modo guiado (extraer → validar en orden). */
function extraerConReglas(mensaje: string): Valores {
  const ext = extraerCampos(mensaje);
  const v: Valores = {};
  for (const c of ORDEN) {
    const crudo = ext.campos[c];
    if (crudo === undefined) continue;
    const r = interpretarCampo(c, crudo, v);
    if (r.ok) Object.assign(v, r.extra ?? {}, { [c]: r.valor });
  }
  return v;
}

/** Extracción con Claude: un paso con la herramienta actualizarCampo (el código valida). */
async function extraerConIA(mensaje: string): Promise<Valores> {
  const turnero = new Turnero(estadoInicial(), {});
  const herramientas = crearHerramientas({
    turnero,
    ctx: {},
    writer: { write: () => undefined } as never,
    bloquesEmitidos: new Set(),
    modeloClasificacion: null,
  });
  await generateText({
    model: modeloPrincipal(),
    instructions: [
      { role: "system", content: sistemaFijo("usted") },
      { role: "system", content: sistemaEstado(estadoInicial()) },
    ],
    messages: [{ role: "user", content: mensaje }],
    tools: { actualizarCampo: herramientas.actualizarCampo },
    stopWhen: isStepCount(1),
    providerOptions: opcionesProveedor(MODELO_PRINCIPAL),
  });
  return turnero.e.valores;
}

type Conteo = { vp: number; fp: number; fn: number };

function puntuar(esperado: Partial<Record<CampoId, unknown>>, obtenido: Valores, porCampo: Map<string, Conteo>) {
  const campos = new Set([...Object.keys(esperado), ...Object.keys(obtenido)]);
  let exacto = true;
  for (const c of campos) {
    const k = porCampo.get(c) ?? { vp: 0, fp: 0, fn: 0 };
    const e = esperado[c as CampoId];
    const o = obtenido[c as CampoId];
    if (e !== undefined && o !== undefined && JSON.stringify(e) === JSON.stringify(o)) k.vp++;
    else {
      exacto = false;
      if (o !== undefined) k.fp++;
      if (e !== undefined) k.fn++;
    }
    porCampo.set(c, k);
  }
  return exacto;
}

function resumen(porCampo: Map<string, Conteo>) {
  const total = [...porCampo.values()].reduce((a, k) => ({ vp: a.vp + k.vp, fp: a.fp + k.fp, fn: a.fn + k.fn }), { vp: 0, fp: 0, fn: 0 });
  const p = total.vp / Math.max(1, total.vp + total.fp);
  const r = total.vp / Math.max(1, total.vp + total.fn);
  return { precision: p, recall: r, f1: (2 * p * r) / Math.max(1e-9, p + r), ...total };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

async function main() {
  const i = process.argv.indexOf("--dataset");
  const ruta = i > 0 ? process.argv[i + 1] : "evals/dataset.json";
  const { casos } = JSON.parse(await readFile(ruta, "utf8")) as { casos: Caso[] };
  console.log(`Conjunto: ${ruta}`);
  const conIA = process.argv.includes("--ia");
  if (conIA && !process.env.ANTHROPIC_API_KEY) throw new Error("--ia requiere ANTHROPIC_API_KEY");
  const sistemas = conIA ? (["reglas", "ia"] as const) : (["reglas"] as const);
  const detalle: Record<string, unknown>[] = [];
  const informe: Record<string, unknown> = { fecha: new Date().toISOString(), modelo: conIA ? MODELO_PRINCIPAL : null };

  // 1. Extracción de campos
  const conCampos = casos.filter((c) => c.campos);
  for (const s of sistemas) {
    const porCampo = new Map<string, Conteo>();
    let exactos = 0;
    for (const caso of conCampos) {
      const obtenido = s === "reglas" ? extraerConReglas(caso.mensaje) : await extraerConIA(caso.mensaje);
      const ok = puntuar(caso.campos!, obtenido, porCampo);
      if (ok) exactos++;
      detalle.push({ sistema: s, tipo: "extraccion", id: caso.id, ok, esperado: caso.campos, obtenido });
    }
    const r = resumen(porCampo);
    informe[`extraccion_${s}`] = { ...r, exactos, casos: conCampos.length };
    console.log(`\n== Extracción de campos (${s}) — ${conCampos.length} mensajes`);
    console.log(`Precisión ${pct(r.precision)} · Cobertura ${pct(r.recall)} · F1 ${pct(r.f1)} · Mensajes 100% correctos ${exactos}/${conCampos.length}`);
    console.table(
      Object.fromEntries(
        [...porCampo.entries()]
          .sort((a, b) => ORDEN.indexOf(a[0] as CampoId) - ORDEN.indexOf(b[0] as CampoId))
          .map(([c, k]) => [c, { aciertos: k.vp, sobrantes: k.fp, faltantes: k.fn }]),
      ),
    );
  }

  // 2. Clasificación CIIU
  const conCiiu = casos.filter((c) => c.ciiu?.length);
  for (const s of sistemas) {
    let top1 = 0;
    let top3 = 0;
    const filas: Record<string, { esperado: string; top3: string; resultado: string }> = {};
    for (const caso of conCiiu) {
      const sug = s === "reglas" ? sugerirCiiu(caso.mensaje, [], 3) : await clasificarCiiu(caso.mensaje, []);
      const codigos = sug.map((x) => x.codigo);
      const t1 = caso.ciiu!.includes(codigos[0]);
      const t3 = codigos.some((c) => caso.ciiu!.includes(c));
      if (t1) top1++;
      if (t3) top3++;
      filas[caso.id] = { esperado: caso.ciiu!.join("/"), top3: codigos.join(", "), resultado: t1 ? "top-1" : t3 ? "top-3" : "fallo" };
      detalle.push({ sistema: s, tipo: "ciiu", id: caso.id, mensaje: caso.mensaje, esperado: caso.ciiu, obtenido: codigos });
    }
    informe[`ciiu_${s}`] = { top1: top1 / conCiiu.length, top3: top3 / conCiiu.length, casos: conCiiu.length };
    console.log(`\n== Clasificación CIIU (${s === "reglas" ? "búsqueda léxica" : "léxica + Claude Haiku"}) — ${conCiiu.length} descripciones`);
    console.log(`Top-1 ${pct(top1 / conCiiu.length)} · Top-3 ${pct(top3 / conCiiu.length)}`);
    console.table(filas);
  }

  await mkdir("evals/resultados", { recursive: true });
  const salida = `evals/resultados/${ruta.includes("prueba") ? "prueba" : "desarrollo"}${conIA ? "-ia" : ""}.json`;
  await writeFile(salida, JSON.stringify({ conjunto: ruta, informe, detalle }, null, 1));
  console.log(`\nDetalle guardado en ${salida}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
