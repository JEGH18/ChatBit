// Escritura de un turno del motor como UI Message Stream (protocolo del AI SDK), para que el
// navegador reciba igual las respuestas del modo guiado y las del modo con IA.
import { generateId, type UIMessageStreamWriter } from "ai";
import type { EstadoConversacion } from "@/lib/conversacion/estado";
import type { Bloque, Chip, Turno } from "@/lib/conversacion/tipos";

export type ModoRespuesta = "ia" | "guiado";

/** Datos que acompañan cada respuesta: el estado validado y la interfaz del siguiente paso. */
export type DatosEstado = {
  estado: EstadoConversacion;
  chips: Chip[];
  ui?: Turno["ui"];
  modo: ModoRespuesta;
  aviso?: string;
};

export function escribirTexto(writer: UIMessageStreamWriter, texto: string) {
  const id = generateId();
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: texto });
  writer.write({ type: "text-end", id });
}

export function escribirBloque(writer: UIMessageStreamWriter, bloque: Bloque) {
  writer.write({ type: "data-bloque", data: bloque });
}

export function escribirEstado(writer: UIMessageStreamWriter, datos: DatosEstado) {
  writer.write({ type: "data-estado", data: datos, transient: true });
}

export function escribirTurno(writer: UIMessageStreamWriter, turno: Turno, modo: ModoRespuesta, aviso?: string) {
  for (const m of turno.mensajes) {
    escribirTexto(writer, m.texto);
    if (m.bloque) escribirBloque(writer, m.bloque);
  }
  escribirEstado(writer, { estado: turno.estado, chips: turno.chips, ui: turno.ui, modo, aviso });
}
