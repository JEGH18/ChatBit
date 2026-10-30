import { z } from "zod";
import { esquemaAccion } from "@/lib/conversacion/acciones";

export const esquemaPeticionChat = z.object({
  sesionId: z.string().uuid(),
  estado: z.unknown(),
  entrada: z.object({
    texto: z.string().max(1000).optional(),
    accion: esquemaAccion.optional(),
    canal: z.enum(["texto", "voz", "boton", "formulario"]).optional(),
  }),
  /** Últimos mensajes visibles (solo texto) para dar contexto a la IA. */
  historial: z
    .array(z.object({ rol: z.enum(["usuario", "asistente"]), texto: z.string().max(2000) }))
    .max(30)
    .optional(),
  /** Permite forzar el modo guiado (p. ej. pruebas E2E o preferencia de la persona). */
  modo: z.enum(["auto", "guiado"]).optional(),
});

export type PeticionChat = z.infer<typeof esquemaPeticionChat>;
