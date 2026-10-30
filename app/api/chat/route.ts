import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { sanitizarEstado } from "@/lib/conversacion/estado";
import { procesarTurno, resolverSinIA } from "@/lib/conversacion/motor";
import { iaDisponible } from "@/lib/ia/modelo";
import { turnoConIA } from "@/lib/ia/turno";
import { obtenerContextoMotor } from "@/lib/servidor/contexto";
import { escribirTurno } from "@/lib/servidor/flujo";
import { esquemaPeticionChat } from "@/lib/servidor/peticion";

export const maxDuration = 30;

export async function POST(req: Request) {
  const cuerpo = await req.json().catch(() => null);
  const peticion = esquemaPeticionChat.safeParse(cuerpo);
  if (!peticion.success) return Response.json({ error: "Solicitud inválida." }, { status: 400 });

  const { entrada, historial = [], modo } = peticion.data;
  // Nunca se confía en el estado del navegador: se revalida campo por campo.
  const estado = sanitizarEstado(peticion.data.estado);
  const ctx = await obtenerContextoMotor();
  const conIA = iaDisponible() && modo !== "guiado";

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      if (!conIA) {
        escribirTurno(writer, procesarTurno(estado, entrada, ctx), "guiado");
      } else {
        // Acciones, seguridad, subdiálogos y consentimientos se resuelven con reglas, sin IA.
        const r = resolverSinIA(estado, entrada, ctx);
        if ("turno" in r) escribirTurno(writer, r.turno, "ia");
        else await turnoConIA(writer, r.estado, { ...entrada, texto: entrada.texto! }, historial, ctx);
      }
      writer.write({ type: "finish" });
    },
    onError: () => "No pude responder en este momento. Intente de nuevo.",
  });
  return createUIMessageStreamResponse({ stream, headers: { "Cache-Control": "no-store" } });
}
