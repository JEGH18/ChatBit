import { z } from "zod";
import { repositorio } from "@/lib/datos";
import { redactarPII } from "@/lib/seguridad";

const esquema = z.object({
  sesionId: z.string().uuid(),
  puntaje: z.number().int().min(1).max(3),
  comentario: z.string().max(500).optional(),
  rangoEdad: z.enum(["Menos de 30", "30 a 44", "45 a 59", "60 o más", "Prefiero no decir"]).optional(),
});

export async function POST(req: Request) {
  const r = esquema.safeParse(await req.json().catch(() => null));
  if (!r.success) return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  const repo = await repositorio();
  await repo.guardarEncuesta({
    sesionId: r.data.sesionId,
    puntaje: r.data.puntaje,
    comentario: r.data.comentario ? redactarPII(r.data.comentario) : undefined,
    rangoEdad: r.data.rangoEdad === "Prefiero no decir" ? undefined : r.data.rangoEdad,
  });
  return Response.json({ ok: true });
}
