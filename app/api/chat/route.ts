import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { sanitizarEstado } from "@/lib/conversacion/estado";
import { procesarTurno } from "@/lib/conversacion/motor";
import { obtenerContextoMotor } from "@/lib/servidor/contexto";
import { escribirTurno } from "@/lib/servidor/flujo";
import { esquemaPeticionChat } from "@/lib/servidor/peticion";

export const maxDuration = 30;

export async function POST(req: Request) {
  const cuerpo = await req.json().catch(() => null);
  const peticion = esquemaPeticionChat.safeParse(cuerpo);
  if (!peticion.success) return Response.json({ error: "Solicitud inválida." }, { status: 400 });

  const { entrada } = peticion.data;
  // Nunca se confía en el estado del navegador: se revalida campo por campo.
  const estado = sanitizarEstado(peticion.data.estado);
  const ctx = await obtenerContextoMotor();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      const turno = procesarTurno(estado, entrada, ctx);
      escribirTurno(writer, turno, "guiado");
      writer.write({ type: "finish" });
    },
    onError: () => "No pude responder en este momento. Intente de nuevo.",
  });
  return createUIMessageStreamResponse({ stream, headers: { "Cache-Control": "no-store" } });
}
