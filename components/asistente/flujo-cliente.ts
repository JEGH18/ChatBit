// Lectura del UI Message Stream (SSE) que envía /api/chat. Se procesa a mano para tener
// control total y poder caer al motor local si la red falla.
import type { Bloque } from "@/lib/conversacion/tipos";
import type { DatosEstado } from "@/lib/servidor/flujo";

export type EventoFlujo =
  | { tipo: "texto-inicio"; id: string }
  | { tipo: "texto"; id: string; delta: string }
  | { tipo: "bloque"; bloque: Bloque }
  | { tipo: "estado"; datos: DatosEstado }
  | { tipo: "error"; mensaje: string };

type Chunk = { type: string; id?: string; delta?: string; data?: unknown; errorText?: string };

export async function* leerFlujo(respuesta: Response): AsyncGenerator<EventoFlujo> {
  if (!respuesta.body) return;
  const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await lector.read();
    if (done) break;
    buffer += value;
    let corte: number;
    while ((corte = buffer.indexOf("\n\n")) >= 0) {
      const evento = buffer.slice(0, corte);
      buffer = buffer.slice(corte + 2);
      for (const linea of evento.split("\n")) {
        if (!linea.startsWith("data:")) continue;
        const json = linea.slice(5).trim();
        if (!json || json === "[DONE]") continue;
        let chunk: Chunk;
        try {
          chunk = JSON.parse(json);
        } catch {
          continue;
        }
        if (chunk.type === "text-start" && chunk.id) yield { tipo: "texto-inicio", id: chunk.id };
        else if (chunk.type === "text-delta" && chunk.id) yield { tipo: "texto", id: chunk.id, delta: chunk.delta ?? "" };
        else if (chunk.type === "data-bloque") yield { tipo: "bloque", bloque: chunk.data as Bloque };
        else if (chunk.type === "data-estado") yield { tipo: "estado", datos: chunk.data as DatosEstado };
        else if (chunk.type === "error") yield { tipo: "error", mensaje: chunk.errorText ?? "Error" };
      }
    }
  }
}
