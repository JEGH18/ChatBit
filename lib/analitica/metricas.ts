// Indicadores del panel administrativo, calculados a partir de filas sin datos personales.
// Función pura: sirve igual para SQLite, Postgres o memoria, y se puede probar.
import { CAMPO, ORDEN, type CampoId } from "@/lib/form/campos";
import { FAQ_BASE } from "@/lib/conocimiento/faq";
import type { DatosPanel, FilaEvento, FilaSesion } from "@/lib/datos/tipos";

const MIN_ABANDONO = 30;
export const RANGOS_EDAD = ["Menos de 30", "30 a 44", "45 a 59", "60 o más"] as const;

const mediana = (xs: number[]) => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);

export type Segmento = { clave: string; etiqueta: string; sesiones: number };

export function calcularMetricas(d: DatosPanel, ahora = new Date()) {
  const eventosPorSesion = new Map<string, FilaEvento[]>();
  for (const e of d.eventos) {
    const l = eventosPorSesion.get(e.sesionId) ?? [];
    l.push(e);
    eventosPorSesion.set(e.sesionId, l);
  }
  const iniciadas = d.sesiones.filter((s) => (eventosPorSesion.get(s.id) ?? []).some((e) => e.tipo === "mensaje" || e.tipo === "campo_completado"));
  const finalizadas = iniciadas.filter((s) => s.finalizada);
  const abandonada = (s: FilaSesion) => !s.finalizada && ahora.getTime() - s.actualizadaEn.getTime() > MIN_ABANDONO * 60_000;
  const abandonadas = iniciadas.filter(abandonada);
  const encuestas = d.encuestas;
  const conjunto = (s: FilaSesion, tipo: string) => new Set((eventosPorSesion.get(s.id) ?? []).filter((e) => e.tipo === tipo && e.campo).map((e) => e.campo!));

  // Embudo por campo
  const embudo = ORDEN.map((c) => {
    let llegaron = 0;
    let completaron = 0;
    const tiempos: number[] = [];
    for (const s of iniciadas) {
      const ev = eventosPorSesion.get(s.id) ?? [];
      const mostrado = ev.find((e) => e.tipo === "campo_mostrado" && e.campo === c);
      const completado = ev.find((e) => (e.tipo === "campo_completado" || e.tipo === "campo_omitido") && e.campo === c);
      if (mostrado || completado) llegaron++;
      if (completado) completaron++;
      if (mostrado && completado && completado.creadoEn >= mostrado.creadoEn) tiempos.push((completado.creadoEn.getTime() - mostrado.creadoEn.getTime()) / 1000);
    }
    const abandonaron = abandonadas.filter((s) => s.ultimoCampo === c).length;
    return { campo: c, etiqueta: CAMPO[c].etiqueta, paso: CAMPO[c].paso, llegaron, completaron, abandonaron, tiempoMedianoSeg: mediana(tiempos) };
  });

  // Fricción por campo
  const contar = (tipo: string) => {
    const m = new Map<string, number>();
    for (const e of d.eventos) if (e.tipo === tipo && e.campo) m.set(e.campo, (m.get(e.campo) ?? 0) + 1);
    return m;
  };
  const errores = contar("error_validacion");
  const ayudas = contar("ayuda");
  const correcciones = contar("correccion");
  const friccion = ORDEN.map((c) => ({ campo: c, etiqueta: CAMPO[c].etiqueta, errores: errores.get(c) ?? 0, ayudas: ayudas.get(c) ?? 0, correcciones: correcciones.get(c) ?? 0 }))
    .filter((f) => f.errores + f.ayudas + f.correcciones > 0)
    .sort((a, b) => b.errores + b.ayudas - (a.errores + a.ayudas));

  // Preguntas frecuentes respondidas
  const faqConteo = new Map<string, number>();
  for (const e of d.eventos) if (e.tipo === "pregunta_faq" && e.detalle) faqConteo.set(e.detalle, (faqConteo.get(e.detalle) ?? 0) + 1);
  const faq = [...faqConteo.entries()]
    .map(([id, veces]) => ({ id, pregunta: FAQ_BASE.find((f) => f.id === id)?.pregunta ?? (id.startsWith("aprobada-") ? "Respuesta aprobada en la bandeja" : id), veces }))
    .sort((a, b) => b.veces - a.veces);

  // Satisfacción
  const csat = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;
  for (const e of encuestas) csat[e.puntaje as 1 | 2 | 3]++;

  // Finalización chat vs formulario manual
  const porCanal = (filtro: (s: FilaSesion) => boolean) => {
    const g = iniciadas.filter(filtro);
    return { sesiones: g.length, finalizadas: g.filter((s) => s.finalizada).length, tasa: pct(g.filter((s) => s.finalizada).length, g.length) };
  };

  // Completitud por campo, desagregada por segmento (detección de brechas de desempeño)
  const segmentos: { clave: string; etiqueta: string; filtro: (s: FilaSesion) => boolean }[] = [
    { clave: "todas", etiqueta: "Todas", filtro: () => true },
    ...RANGOS_EDAD.map((r) => ({ clave: `edad:${r}`, etiqueta: r, filtro: (s: FilaSesion) => s.rangoEdad === r })),
    { clave: "edad:sin", etiqueta: "Edad sin dato", filtro: (s: FilaSesion) => !s.rangoEdad },
    { clave: "canal:voz", etiqueta: "Usó voz", filtro: (s: FilaSesion) => s.usoVoz },
    { clave: "canal:texto", etiqueta: "Solo texto", filtro: (s: FilaSesion) => !s.usoVoz },
  ];
  const camposCompletitud = ORDEN.filter((c) => c !== "confirmacionDocumento");
  const tablaCompletitud = segmentos.map((seg) => {
    const g = iniciadas.filter(seg.filtro);
    const valores = Object.fromEntries(camposCompletitud.map((c) => [c, g.length ? pct(g.filter((s) => conjunto(s, "campo_completado").has(c)).length, g.length) : null])) as Record<CampoId, number | null>;
    return { clave: seg.clave, etiqueta: seg.etiqueta, sesiones: g.length, valores, finalizacion: pct(g.filter((s) => s.finalizada).length, g.length) };
  });
  const general = tablaCompletitud[0];
  const alertas: string[] = [];
  for (const seg of tablaCompletitud.slice(1)) {
    if (seg.sesiones < 5) continue;
    for (const c of camposCompletitud) {
      const a = seg.valores[c];
      const b = general.valores[c];
      if (a !== null && b !== null && b - a >= 15) alertas.push(`${seg.etiqueta}: «${CAMPO[c].etiqueta}» se completa ${Math.round(b - a)} puntos menos que el promedio (${a}% vs ${b}%).`);
    }
    if (seg.finalizacion !== null && general.finalizacion !== null && general.finalizacion - seg.finalizacion >= 15)
      alertas.push(`${seg.etiqueta}: la tasa de finalización es ${Math.round(general.finalizacion - seg.finalizacion)} puntos menor que el promedio.`);
  }

  // CIIU: qué tan seguido la primera sugerencia es la elegida
  const ciiu = d.eventos.filter((e) => e.tipo === "ciiu_confirmado" && e.detalle);
  const posiciones = ciiu.map((e) => Number(e.detalle!.split(":")[1])).filter((n) => Number.isFinite(n));
  const duraciones = finalizadas.filter((s) => s.finalizadaEn).map((s) => (s.finalizadaEn!.getTime() - s.creadaEn.getTime()) / 60_000);

  return {
    generado: ahora,
    totales: {
      sesiones: iniciadas.length,
      finalizadas: finalizadas.length,
      tasaFinalizacion: pct(finalizadas.length, iniciadas.length),
      abandonadas: abandonadas.length,
      enCurso: iniciadas.length - finalizadas.length - abandonadas.length,
      tiempoMedianoMin: mediana(duraciones),
      csatPositivo: pct(csat[3], encuestas.length),
      csatPromedio: encuestas.length ? Math.round((encuestas.reduce((a, e) => a + e.puntaje, 0) / encuestas.length) * 100) / 100 : null,
      respuestasEncuesta: encuestas.length,
      escalamiento: pct(iniciadas.filter((s) => s.escalada).length, iniciadas.length),
      usoVoz: pct(iniciadas.filter((s) => s.usoVoz).length, iniciadas.length),
      completitudVentas: pct(iniciadas.filter((s) => conjunto(s, "campo_completado").has("ventasUltimoAnio")).length, iniciadas.length),
      completitudCiiu: pct(iniciadas.filter((s) => conjunto(s, "campo_completado").has("actividadEconomica")).length, iniciadas.length),
    },
    embudo,
    friccion,
    faq,
    sinResolver: d.preguntas.filter((p) => p.estado === "pendiente"),
    aprobadas: d.preguntas.filter((p) => p.estado === "aprobada"),
    csat,
    finalizacionPorCanal: { chat: porCanal((s) => !s.usoFormulario), manual: porCanal((s) => s.usoFormulario) },
    completitud: { campos: camposCompletitud.map((c) => ({ campo: c, etiqueta: CAMPO[c].etiqueta })), segmentos: tablaCompletitud, alertas },
    ciiu: {
      confirmaciones: ciiu.length,
      top1: pct(posiciones.filter((p) => p === 1).length, posiciones.length),
      top3: pct(posiciones.filter((p) => p <= 3).length, posiciones.length),
      sinonimos: d.sinonimos.slice(0, 15),
    },
    sinteticas: d.sesiones.filter((s) => s.sintetica).length,
  };
}

export type Metricas = ReturnType<typeof calcularMetricas>;
