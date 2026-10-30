import { estadoInicial, type EstadoConversacion } from "@/lib/conversacion/estado";
import { procesarTurno, type ContextoMotor } from "@/lib/conversacion/motor";
import type { Accion, Turno } from "@/lib/conversacion/tipos";

export type Paso = string | Accion;

/** Ejecuta una conversación completa contra el motor y devuelve todos los turnos. */
export function conversar(pasos: Paso[], ctx: ContextoMotor = { hoy: new Date("2026-10-29T12:00:00Z") }) {
  let estado: EstadoConversacion = estadoInicial("usted");
  const turnos: Turno[] = [];
  const t0 = procesarTurno(estado, { accion: { tipo: "iniciar" } }, ctx);
  turnos.push(t0);
  estado = t0.estado;
  for (const p of pasos) {
    const turno = typeof p === "string" ? procesarTurno(estado, { texto: p }, ctx) : procesarTurno(estado, { accion: p }, ctx);
    turnos.push(turno);
    estado = turno.estado;
  }
  return { estado, turnos, ultimo: turnos.at(-1)! };
}

export const textoDe = (t: Turno) => t.mensajes.map((m) => m.texto).join("\n");
