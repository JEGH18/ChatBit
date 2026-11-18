// Validación estricta de las acciones que llegan del navegador.
import { z } from "zod";
import { esCampo, type CampoId } from "@/lib/form/campos";
import type { Accion } from "./tipos";

const campo = z.string().refine(esCampo) as unknown as z.ZodType<CampoId>;
const consentimiento = z.enum(["aceptaPoliticaDatos", "aceptaTerminos"]);

export const esquemaAccion: z.ZodType<Accion> = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("iniciar") }),
  z.object({ tipo: z.literal("responder"), campo, valor: z.string().max(200) }),
  z.object({ tipo: z.literal("omitir"), campo }),
  z.object({ tipo: z.literal("explicar"), campo }),
  z.object({ tipo: z.literal("confirmarDocumento"), correcto: z.boolean() }),
  z.object({ tipo: z.literal("confirmarNombreApellido"), correcto: z.boolean() }),
  z.object({ tipo: z.literal("elegirCiiu"), codigo: z.string().regex(/^\d{4}$/) }),
  z.object({ tipo: z.literal("ningunCiiu") }),
  z.object({ tipo: z.literal("estimarVentas") }),
  z.object({ tipo: z.literal("usarVentas"), valor: z.number().int().positive().max(1e12) }),
  z.object({ tipo: z.literal("rechazarVentas") }),
  z.object({ tipo: z.literal("aceptar"), campo: consentimiento }),
  z.object({ tipo: z.literal("rechazar"), campo: consentimiento }),
  z.object({ tipo: z.literal("ayudaCorreo") }),
  z.object({ tipo: z.literal("crearCorreo") }),
  z.object({ tipo: z.literal("corregir"), campo: campo.optional() }),
  z.object({ tipo: z.literal("revisar") }),
  z.object({ tipo: z.literal("finalizar") }),
  z.object({ tipo: z.literal("asesor") }),
  z.object({ tipo: z.literal("abrirCampo"), campo }),
  z.object({ tipo: z.literal("formularioManual") }),
]) as unknown as z.ZodType<Accion>;
