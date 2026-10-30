import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { after } from "next/server";
import { construirRegistroTurno } from "@/lib/analitica/registrar";
import { sanitizarEstado, type EstadoConversacion } from "@/lib/conversacion/estado";
import { procesarTurno, resolverSinIA } from "@/lib/conversacion/motor";
import type { EventoMotor } from "@/lib/conversacion/tipos";
import { repositorio } from "@/lib/datos";
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

  const { sesionId, entrada, historial = [], modo } = peticion.data;
  // Nunca se confía en el estado del navegador: se revalida campo por campo.
  const estado = sanitizarEstado(peticion.data.estado);
  const ctx = await obtenerContextoMotor();
  const conIA = iaDisponible() && modo !== "guiado";

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      let resultado: { estado: EstadoConversacion; eventos: EventoMotor[]; modo: string };
      if (!conIA) {
        const turno = procesarTurno(estado, entrada, ctx);
        escribirTurno(writer, turno, "guiado");
        resultado = { estado: turno.estado, eventos: turno.eventos, modo: "guiado" };
      } else {
        // Acciones, seguridad, subdiálogos y consentimientos se resuelven con reglas, sin IA.
        const r = resolverSinIA(estado, entrada, ctx);
        if ("turno" in r) {
          escribirTurno(writer, r.turno, "ia");
          resultado = { estado: r.turno.estado, eventos: r.turno.eventos, modo: "ia" };
        } else {
          resultado = await turnoConIA(writer, r.estado, { ...entrada, texto: entrada.texto! }, historial, ctx);
        }
      }
      writer.write({ type: "finish" });

      // Analítica anonimizada, después de responder (no retrasa a la persona).
      after(async () => {
        try {
          const repo = await repositorio();
          await repo.guardarTurno(construirRegistroTurno({ sesionId, antes: estado, despues: resultado.estado, entrada, eventos: resultado.eventos, modo: resultado.modo }));
        } catch (e) {
          console.error("No se pudo guardar la analítica del turno:", e instanceof Error ? e.message : e);
        }
      });
    },
    onError: () => "No pude responder en este momento. Intente de nuevo.",
  });
  return createUIMessageStreamResponse({ stream, headers: { "Cache-Control": "no-store" } });
}
