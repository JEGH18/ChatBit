// Turno con IA: Claude entiende el mensaje y usa herramientas; la máquina de estados valida y
// decide los botones del siguiente paso. Si la IA falla o se niega antes de responder, el turno
// se resuelve con el motor guiado: la persona nunca se queda sin respuesta.
import { generateId, isStepCount, streamText, type LanguageModel, type ModelMessage, type UIMessageStreamWriter } from "ai";
import type { EstadoConversacion } from "@/lib/conversacion/estado";
import { interfazPara, procesarTurno, Turnero, type ContextoMotor } from "@/lib/conversacion/motor";
import type { Entrada, EventoMotor } from "@/lib/conversacion/tipos";
import { escribirBloque, escribirEstado, escribirTurno } from "@/lib/servidor/flujo";
import { crearHerramientas, type SesionIA } from "./herramientas";
import { MODELO_PRINCIPAL, modeloClasificacion, modeloPrincipal, opcionesProveedor } from "./modelo";
import { sistemaEstado, sistemaFijo } from "./prompt";

export type MensajeHistorial = { rol: "usuario" | "asistente"; texto: string };

/** Historial visible → mensajes del modelo (solo texto, alternando, empezando por la persona). */
export function aMensajesModelo(historial: MensajeHistorial[], texto: string): ModelMessage[] {
  const res: { role: "user" | "assistant"; content: string }[] = [];
  for (const h of historial.slice(-12)) {
    const role = h.rol === "usuario" ? "user" : "assistant";
    if (!res.length && role === "assistant") continue;
    const ultimo = res.at(-1);
    if (ultimo?.role === role) ultimo.content += `\n\n${h.texto}`;
    else res.push({ role, content: h.texto.slice(0, 2000) });
  }
  if (res.at(-1)?.role === "user") res.at(-1)!.content += `\n\n${texto}`;
  else res.push({ role: "user", content: texto });
  return res;
}

export type OpcionesTurnoIA = {
  modelo?: LanguageModel;
  modeloClasificacion?: LanguageModel | null;
};

export async function turnoConIA(
  writer: UIMessageStreamWriter,
  estado: EstadoConversacion,
  entrada: Entrada & { texto: string },
  historial: MensajeHistorial[],
  ctx: ContextoMotor,
  opciones: OpcionesTurnoIA = {},
): Promise<{ eventos: EventoMotor[]; modo: "ia" | "guiado"; estado: EstadoConversacion }> {
  const turnero = new Turnero(estado, ctx);
  const sesion: SesionIA = {
    turnero,
    ctx,
    writer,
    bloquesEmitidos: new Set(),
    modeloClasificacion: opciones.modeloClasificacion === undefined ? modeloClasificacion() : opciones.modeloClasificacion,
  };

  let escribioTexto = false;
  let fallo: unknown = null;
  try {
    const resultado = streamText({
      model: opciones.modelo ?? modeloPrincipal(),
      // Parte fija primero, marcada para caché de prompt; el estado cambiante va después.
      // Las instrucciones nunca se mezclan con los mensajes de la persona (defensa contra inyección).
      instructions: [
        { role: "system", content: sistemaFijo(estado.tratamiento), providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
        { role: "system", content: sistemaEstado(estado) },
      ],
      messages: aMensajesModelo(historial, entrada.texto),
      tools: crearHerramientas(sesion),
      stopWhen: isStepCount(5),
      maxOutputTokens: 8000,
      providerOptions: opcionesProveedor(MODELO_PRINCIPAL),
      timeout: 25_000,
    });

    // Se reenvía el texto a medida que llega (streaming); cada paso del modelo es un mensaje.
    const ids = new Map<string, string>();
    for await (const parte of resultado.stream) {
      if (parte.type === "text-start") {
        const id = generateId();
        ids.set(parte.id, id);
        writer.write({ type: "text-start", id });
      } else if (parte.type === "text-delta" && parte.text) {
        writer.write({ type: "text-delta", id: ids.get(parte.id) ?? parte.id, delta: parte.text });
        escribioTexto = true;
      } else if (parte.type === "text-end") {
        writer.write({ type: "text-end", id: ids.get(parte.id) ?? parte.id });
      } else if (parte.type === "error") {
        fallo = parte.error;
        break;
      } else if (parte.type === "finish" && parte.finishReason === "content-filter" && !escribioTexto) {
        fallo = new Error("Respuesta bloqueada por los filtros de seguridad");
      }
    }
  } catch (e) {
    fallo = e;
  }

  if (fallo && !escribioTexto) {
    // Respaldo: el mismo mensaje se procesa con el motor guiado.
    console.error("IA no disponible en este turno, se usa el modo guiado:", fallo instanceof Error ? fallo.message : fallo);
    const turno = procesarTurno(estado, entrada, ctx);
    escribirTurno(writer, turno, "guiado", "La IA no respondió; seguimos en modo guiado.");
    return { eventos: turno.eventos, modo: "guiado", estado: turno.estado };
  }

  // Botones y tarjetas del siguiente paso: los decide la máquina de estados, no la IA.
  const ui = interfazPara(turnero.e, ctx);
  if (fallo) {
    const id = generateId();
    writer.write({ type: "text-start", id });
    writer.write({ type: "text-delta", id, delta: `Perdón, tuve un problema. ${ui.pregunta}` });
    writer.write({ type: "text-end", id });
  }
  if (ui.bloque && (ui.bloque.tipo === "consentimiento" || ui.bloque.tipo === "resumen") && !sesion.bloquesEmitidos.has(ui.bloque.tipo)) {
    escribirBloque(writer, ui.bloque);
  }
  escribirEstado(writer, { estado: ui.estado, chips: ui.chips, modo: "ia" });
  return { eventos: turnero.eventos, modo: "ia", estado: ui.estado };
}
