// Opciones de los campos de selección del formulario "persona natural".
// Ajuste estas listas si cambian las opciones del formulario real de Neocrédito.
import { CONFIG } from "@/lib/config";

export type Opcion<V extends string = string> = { valor: V; etiqueta: string; alias: string[] };

export const TIPOS_DOCUMENTO = [
  { valor: "CC", etiqueta: "CÉDULA DE CIUDADANÍA", alias: ["cc", "cedula", "cedula de ciudadania", "ciudadania", "c c"] },
  { valor: "CE", etiqueta: "CÉDULA DE EXTRANJERÍA", alias: ["ce", "cedula de extranjeria", "extranjeria", "c e"] },
  { valor: "PA", etiqueta: "PASAPORTE", alias: ["pasaporte", "pa", "passport"] },
  {
    valor: "PPT",
    etiqueta: "PERMISO POR PROTECCIÓN TEMPORAL (PPT)",
    alias: ["ppt", "permiso por proteccion temporal", "permiso de proteccion temporal", "permiso temporal"],
  },
] as const satisfies readonly Opcion[];
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]["valor"];

const GENEROS_BASE = [
  { valor: "MASCULINO", etiqueta: "MASCULINO", alias: ["masculino", "hombre", "varon", "m", "macho", "senor"] },
  { valor: "FEMENINO", etiqueta: "FEMENINO", alias: ["femenino", "mujer", "f", "senora", "dama"] },
  { valor: "OTRO", etiqueta: "OTRO", alias: ["otro", "otra", "no binario", "no binaria"] },
  {
    valor: "NO_INFORMA",
    etiqueta: "PREFIERO NO DECIR",
    alias: ["prefiero no decir", "prefiero no decirlo", "no quiero decir", "prefiero no responder", "no informo", "reservado"],
  },
] as const satisfies readonly Opcion[];
export type Genero = (typeof GENEROS_BASE)[number]["valor"];
export const GENEROS: readonly Opcion<Genero>[] = CONFIG.generoPermitePrefieroNoDecir
  ? GENEROS_BASE
  : GENEROS_BASE.filter((g) => g.valor !== "NO_INFORMA");

export const CANALES = [
  { valor: "EVENTOS", etiqueta: "Eventos", alias: ["evento", "eventos", "feria", "charla", "taller", "capacitacion"] },
  {
    valor: "REDES",
    etiqueta: "Redes sociales",
    alias: ["redes", "redes sociales", "facebook", "instagram", "tiktok", "linkedin", "twitter", "youtube", "whatsapp", "internet"],
  },
  {
    valor: "RECOMENDACION",
    etiqueta: "Recomendación",
    alias: ["recomendacion", "recomendado", "amigo", "amiga", "familiar", "vecino", "vecina", "conocido", "referido", "me contaron", "me recomendaron"],
  },
  { valor: "ENTIDAD", etiqueta: "Entidad financiera", alias: ["entidad", "entidad financiera", "banco", "cooperativa", "asesor del banco"] },
  { valor: "OTRO", etiqueta: "Otro", alias: ["otro", "otra", "otros", "radio", "television", "prensa"] },
] as const satisfies readonly Opcion[];
export type Canal = (typeof CANALES)[number]["valor"];

export const MEDIOS_CONTACTO = [
  { valor: "WHATSAPP", etiqueta: "WhatsApp", alias: ["whatsapp", "wasap", "guasap", "wpp", "whats", "wsp", "wasa"] },
  { valor: "LLAMADA", etiqueta: "Llamada", alias: ["llamada", "llamar", "llamarme", "telefono", "llamada telefonica", "que me llamen"] },
  { valor: "CORREO", etiqueta: "Correo electrónico", alias: ["correo", "email", "mail", "e mail", "correo electronico", "gmail"] },
] as const satisfies readonly Opcion[];
export type MedioContacto = (typeof MEDIOS_CONTACTO)[number]["valor"];

/** Años de ventas que acepta el formulario: el último año fiscal cerrado y el anterior. */
export function aniosVentas(hoy = new Date()): number[] {
  const y = hoy.getFullYear();
  return [y - 1, y - 2];
}

export function etiquetaDe<V extends string>(opciones: readonly Opcion<V>[], valor: V | undefined): string {
  return opciones.find((o) => o.valor === valor)?.etiqueta ?? "";
}
