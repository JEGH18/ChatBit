/**
 * Graba las conversaciones del modo demo (/demo) en data/demo/<persona>.json.
 * Por defecto usa el motor guiado (sin internet). Con --ia y ANTHROPIC_API_KEY, graba las
 * respuestas reales de Claude para mostrarlas sin conexión durante la presentación.
 * Uso: npm run demo:grabar            |  npm run demo:grabar -- --ia
 */
import { writeFile } from "node:fs/promises";
import type { UIMessageStreamWriter } from "ai";
import { estadoInicial, type EstadoConversacion } from "@/lib/conversacion/estado";
import { procesarTurno, resolverSinIA } from "@/lib/conversacion/motor";
import type { Bloque, Chip, Entrada } from "@/lib/conversacion/tipos";
import { PERSONAS } from "@/lib/demo/personas";
import { turnoConIA, type MensajeHistorial } from "@/lib/ia/turno";
import type { DatosEstado } from "@/lib/servidor/flujo";

for (const archivo of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(archivo);
  } catch {
    /* sin archivo */
  }
}

export type PasoGrabado = {
  usuario?: { texto: string; canal?: string; nota?: string };
  respuesta: { mensajes: { texto: string; bloque?: Bloque }[]; chips: Chip[]; estado: EstadoConversacion };
};

const conIA = process.argv.includes("--ia") && !!process.env.ANTHROPIC_API_KEY;
const HOY = new Date();

async function turno(estado: EstadoConversacion, entrada: Entrada, historial: MensajeHistorial[]) {
  if (!conIA) {
    const t = procesarTurno(estado, entrada, { hoy: HOY });
    return { mensajes: t.mensajes, chips: t.chips, estado: t.estado };
  }
  const r = resolverSinIA(estado, entrada, {});
  if ("turno" in r) return { mensajes: r.turno.mensajes, chips: r.turno.chips, estado: r.turno.estado };
  const partes: Record<string, unknown>[] = [];
  const writer = { write: (p: Record<string, unknown>) => partes.push(p) } as unknown as UIMessageStreamWriter;
  await turnoConIA(writer, r.estado, { ...entrada, texto: entrada.texto! }, historial, {});
  const mensajes: { texto: string; bloque?: Bloque }[] = [];
  for (const p of partes) {
    if (p.type === "text-start") mensajes.push({ texto: "" });
    else if (p.type === "text-delta") mensajes[mensajes.length - 1].texto += p.delta as string;
    else if (p.type === "data-bloque") {
      const ult = mensajes.at(-1);
      if (ult && !ult.bloque) ult.bloque = p.data as Bloque;
      else mensajes.push({ texto: "", bloque: p.data as Bloque });
    }
  }
  const datos = partes.filter((p) => p.type === "data-estado").at(-1)?.data as DatosEstado;
  return { mensajes: mensajes.filter((m) => m.texto.trim() || m.bloque), chips: datos.chips, estado: datos.estado };
}

async function main() {
  for (const p of PERSONAS) {
    let estado = estadoInicial("usted");
    const historial: MensajeHistorial[] = [];
    const pasos: PasoGrabado[] = [];
    const inicio = await turno(estado, { accion: { tipo: "iniciar" } }, historial);
    pasos.push({ respuesta: inicio });
    estado = inicio.estado;
    for (const m of inicio.mensajes) historial.push({ rol: "asistente", texto: m.texto });
    for (const paso of p.pasos) {
      const r = await turno(estado, { texto: paso.texto, accion: paso.accion, canal: paso.canal }, historial);
      pasos.push({ usuario: { texto: paso.texto ?? "", canal: paso.canal, nota: paso.nota }, respuesta: r });
      estado = r.estado;
      if (paso.texto) historial.push({ rol: "usuario", texto: paso.texto });
      for (const m of r.mensajes) if (m.texto) historial.push({ rol: "asistente", texto: m.texto });
    }
    if (estado.fase !== "encuesta") throw new Error(`La persona ${p.id} no terminó el registro (fase ${estado.fase}).`);
    await writeFile(
      `data/demo/${p.id}.json`,
      JSON.stringify({ persona: { id: p.id, nombre: p.nombre, descripcion: p.descripcion }, modo: conIA ? "ia" : "guiado", grabado: HOY.toISOString().slice(0, 10), pasos }),
    );
    console.log(`${p.id}: ${pasos.length} pasos (${conIA ? "con IA" : "motor guiado"})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
