// Validación de campos con Zod. La IA puede proponer valores, pero solo este código decide
// si un dato es válido. Cada campo pasa por: texto crudo → valor canónico → esquema Zod.
import { z } from "zod";
import { CAMPO, type CampoId } from "./campos";
import {
  CANALES,
  GENEROS,
  MEDIOS_CONTACTO,
  TIPOS_DOCUMENTO,
  aniosVentas,
  type Canal,
  type Genero,
  type MedioContacto,
  type Opcion,
  type TipoDocumento,
} from "./catalogos";
import { existeCiiu, sugerirCiiu, type SinonimoAprendido } from "./ciiu";
import { interpretarMonto, anualizar, type Periodo } from "./dinero";
import {
  buscarDepartamento,
  buscarMunicipios,
  existeDepartamento,
  municipio,
  nombreDepartamento,
  etiquetaMunicipioConDepartamento,
} from "./divipola";
import { contieneFrase, interpretarSiNo, normalizar, tipoTitulo } from "@/lib/texto";

export type Valores = Partial<{
  primerNombre: string;
  primerApellido: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  confirmacionDocumento: string;
  genero: Genero;
  celular: string;
  correo: string;
  tieneRut: boolean;
  comoSeEntero: Canal;
  departamento: string;
  ciudad: string;
  medioContacto: MedioContacto;
  perteneceMinoria: boolean;
  actividadEconomica: string;
  anioVentas: number;
  ventasUltimoAnio: number;
  aceptaPoliticaDatos: boolean;
  aceptaTerminos: boolean;
}>;

export type CodigoError =
  | "vacio"
  | "formato"
  | "no_coincide"
  | "no_encontrado"
  | "ambiguo"
  | "fuera_de_rango"
  | "periodo"
  | "requiere_accion"
  | "falta_dependencia";

export type OpcionSugerida = { etiqueta: string; valor: string; detalle?: string };

export type ResultadoCampo =
  | { ok: true; valor: Valores[CampoId]; extra?: Valores }
  | { ok: false; codigo: CodigoError; error: string; opciones?: OpcionSugerida[]; propuesta?: number; periodo?: Periodo };

// ---------- esquemas canónicos ----------

const LETRAS = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";
export const zNombre = z
  .string()
  .min(2, "Debe tener al menos 2 letras.")
  .max(40, "Es demasiado largo.")
  .regex(new RegExp(`^[${LETRAS}]+( [${LETRAS}]+){0,2}$`), "Solo puede tener letras, tildes y ñ.");

export const zCelular = z.string().regex(/^3\d{9}$/, "Debe tener 10 números y empezar por 3.");
export const zCorreo = z.email("El correo no tiene un formato válido.").max(120);
export const zVentas = z.number().int().positive().max(1e12);

const valores = <T extends string>(ops: readonly Opcion<T>[]) => ops.map((o) => o.valor) as [T, ...T[]];

export function reglaDocumento(tipo: TipoDocumento | undefined) {
  switch (tipo) {
    case "CC":
      return { re: /^\d{6,10}$/, texto: "La cédula de ciudadanía tiene entre 6 y 10 números." };
    case "CE":
      return { re: /^\d{5,10}$/, texto: "La cédula de extranjería tiene entre 5 y 10 números." };
    case "PPT":
      return { re: /^\d{5,12}$/, texto: "El PPT tiene entre 5 y 12 números." };
    case "PA":
      return { re: /^[A-Z0-9]{5,15}$/, texto: "El pasaporte tiene entre 5 y 15 letras o números." };
    default:
      return { re: /^\d{5,12}$/, texto: "El documento solo puede tener números (entre 5 y 12)." };
  }
}

/** Esquema del estado del formulario: se usa para revalidar todo lo que llega del navegador. */
export const esquemaValores = z
  .object({
    primerNombre: zNombre,
    primerApellido: zNombre,
    tipoDocumento: z.enum(valores(TIPOS_DOCUMENTO)),
    numeroDocumento: z.string().max(15),
    confirmacionDocumento: z.string().max(15),
    genero: z.enum(valores(GENEROS)),
    celular: zCelular,
    correo: zCorreo,
    tieneRut: z.boolean(),
    comoSeEntero: z.enum(valores(CANALES)),
    departamento: z.string().refine(existeDepartamento, "Departamento no válido."),
    ciudad: z.string().refine((c) => !!municipio(c), "Municipio no válido."),
    medioContacto: z.enum(valores(MEDIOS_CONTACTO)),
    perteneceMinoria: z.boolean(),
    actividadEconomica: z.string().refine(existeCiiu, "Código CIIU no válido."),
    anioVentas: z.number().int().refine((y) => aniosVentas().includes(y), "Año no permitido."),
    ventasUltimoAnio: zVentas,
    aceptaPoliticaDatos: z.boolean(),
    aceptaTerminos: z.boolean(),
  })
  .partial()
  .superRefine((v, ctx) => {
    if (v.numeroDocumento !== undefined && !reglaDocumento(v.tipoDocumento).re.test(v.numeroDocumento)) {
      ctx.addIssue({ code: "custom", path: ["numeroDocumento"], message: reglaDocumento(v.tipoDocumento).texto });
    }
    if (v.confirmacionDocumento !== undefined && v.confirmacionDocumento !== v.numeroDocumento) {
      ctx.addIssue({ code: "custom", path: ["confirmacionDocumento"], message: "No coincide con el número de documento." });
    }
    if (v.ciudad && (!v.departamento || municipio(v.ciudad)?.codigoDepartamento !== v.departamento)) {
      ctx.addIssue({ code: "custom", path: ["ciudad"], message: "El municipio no pertenece al departamento." });
    }
  });

/** Registro listo para "Finalizar registro": obligatorios presentes y consentimientos explícitos. */
export const esquemaRegistroCompleto = esquemaValores.and(
  z.object({
    primerNombre: z.string(),
    primerApellido: z.string(),
    tipoDocumento: z.string(),
    numeroDocumento: z.string(),
    confirmacionDocumento: z.string(),
    genero: z.string(),
    celular: z.string(),
    correo: z.string(),
    departamento: z.string(),
    ciudad: z.string(),
    medioContacto: z.string(),
    actividadEconomica: z.string(),
    anioVentas: z.number(),
    ventasUltimoAnio: z.number(),
    aceptaPoliticaDatos: z.literal(true),
    aceptaTerminos: z.literal(true),
  }),
);

// ---------- interpretación de texto crudo ----------

const DIGITOS: Record<string, string> = {
  cero: "0", uno: "1", un: "1", una: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9",
};

/** Extrae solo dígitos, entendiendo también números dictados por voz ("tres diez cuatro..."). */
export function soloDigitos(texto: string): string {
  const conPalabras = normalizar(texto)
    .split(" ")
    .map((p) => DIGITOS[p] ?? p)
    .join(" ");
  return conPalabras.replace(/\D/g, "");
}

export function coincidirOpcion<V extends string>(texto: string, opciones: readonly Opcion<V>[]): V | null {
  const t = normalizar(texto);
  if (!t) return null;
  for (const o of opciones) {
    if ([o.valor, o.etiqueta, ...o.alias].map(normalizar).includes(t)) return o.valor;
  }
  const hits = opciones.filter((o) =>
    [o.etiqueta, ...o.alias].map(normalizar).some((k) => k.length > 1 && contieneFrase(t, k)),
  );
  if (hits.length === 1) return hits[0].valor;
  if (t.length >= 3) {
    const pref = opciones.filter((o) => [o.etiqueta, ...o.alias].map(normalizar).some((k) => k.startsWith(t)));
    if (pref.length === 1) return pref[0].valor;
  }
  return null;
}

/** Respuestas que no son nombres aunque solo tengan letras ("sí", "hola", "listo"…). */
const NO_SON_NOMBRES = new Set(
  "si no ok okay vale hola buenas buenos dias gracias listo bueno claro dale nada ninguno ninguna nose no se ayuda asesor siguiente omitir correcto cedula masculino femenino".split(" "),
);

const PREFIJOS_NOMBRE = /^(me llamo|mi nombre es|mi primer nombre es|mi apellido es|mi primer apellido es|soy|es|el|la)\s+/;

function limpiarNombre(texto: string) {
  let s = String(texto ?? "").replace(/\s+/g, " ").trim();
  for (let m = normalizar(s).match(PREFIJOS_NOMBRE); m; m = normalizar(s).match(PREFIJOS_NOMBRE)) {
    s = s.split(" ").slice(m[0].trim().split(" ").length).join(" ");
  }
  return s.replace(/[.,!¡¿?]/g, "").trim();
}

function correoDesdeVoz(texto: string) {
  return String(texto ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+arroba\s+|\s*arroba\s*/g, "@")
    .replace(/\s+punto\s+|\s*\bpunto\b\s*/g, ".")
    .replace(/\s+guion bajo\s+/g, "_")
    .replace(/\s+guion\s+/g, "-")
    .replace(/^mi correo es\s+|^es\s+/, "")
    .replace(/\s+/g, "")
    .replace(/[,;]+$|\.$/, "");
}

const ok = (valor: Valores[CampoId], extra?: Valores): ResultadoCampo => ({ ok: true, valor, extra });
const fallo = (codigo: CodigoError, error: string, opciones?: OpcionSugerida[]): ResultadoCampo => ({
  ok: false,
  codigo,
  error,
  opciones,
});

export type ContextoValidacion = { aprendidosCiiu?: SinonimoAprendido[]; hoy?: Date };

/**
 * Convierte la respuesta de la persona (o la propuesta de la IA) en un valor canónico válido.
 * Nunca adivina: si hay ambigüedad devuelve las opciones para que la persona elija.
 */
export function interpretarCampo(campo: CampoId, crudo: unknown, v: Valores, ctx: ContextoValidacion = {}): ResultadoCampo {
  const texto = typeof crudo === "string" ? crudo.trim() : crudo;
  if (texto === "" || texto === null || texto === undefined) return fallo("vacio", `Necesito ${CAMPO[campo].etiqueta.toLowerCase()}.`);
  const s = String(texto);

  switch (campo) {
    case "primerNombre":
    case "primerApellido": {
      const limpio = limpiarNombre(s);
      if (NO_SON_NOMBRES.has(normalizar(limpio)))
        return fallo("formato", `Necesito su ${CAMPO[campo].etiqueta.toLowerCase()}, tal como aparece en su documento.`);
      const r = zNombre.safeParse(limpio);
      if (!r.success) {
        const msg = /\d/.test(limpio)
          ? "El nombre no puede tener números."
          : r.error.issues[0]?.message ?? "Revise el dato.";
        return fallo("formato", msg);
      }
      return ok(tipoTitulo(limpio));
    }
    case "tipoDocumento": {
      const val = coincidirOpcion(s, TIPOS_DOCUMENTO);
      return val ? ok(val) : fallo("no_encontrado", "Elija uno de los tipos de documento.", opcionesDe(TIPOS_DOCUMENTO));
    }
    case "numeroDocumento": {
      const doc = v.tipoDocumento === "PA" ? s.toUpperCase().replace(/[^A-Z0-9]/g, "") : soloDigitos(s);
      const regla = reglaDocumento(v.tipoDocumento);
      return regla.re.test(doc) ? ok(doc) : fallo("formato", regla.texto);
    }
    case "confirmacionDocumento": {
      if (!v.numeroDocumento) return fallo("falta_dependencia", "Primero necesito el número de documento.");
      const si = interpretarSiNo(s);
      if (si === true || typeof crudo === "boolean") return crudo === false ? fallo("no_coincide", "Corrijamos el número.") : ok(v.numeroDocumento);
      const doc = v.tipoDocumento === "PA" ? s.toUpperCase().replace(/[^A-Z0-9]/g, "") : soloDigitos(s);
      return doc === v.numeroDocumento ? ok(doc) : fallo("no_coincide", "Los números no coinciden.");
    }
    case "genero": {
      const val = coincidirOpcion(s, GENEROS);
      return val ? ok(val) : fallo("no_encontrado", "Elija una de las opciones.", opcionesDe(GENEROS));
    }
    case "celular": {
      let d = soloDigitos(s);
      if (d.length === 12 && d.startsWith("57")) d = d.slice(2);
      const r = zCelular.safeParse(d);
      if (r.success) return ok(d);
      if (d.length === 7 || (d.length === 10 && d.startsWith("60")))
        return fallo("formato", "Ese parece un teléfono fijo. Necesito un celular de 10 números que empiece por 3.");
      return fallo("formato", `El celular debe tener 10 números y empezar por 3${d ? ` (escribió ${d.length})` : ""}.`);
    }
    case "correo": {
      const correo = correoDesdeVoz(s);
      const r = zCorreo.safeParse(correo);
      if (r.success) return ok(correo);
      if (!correo.includes("@")) return fallo("formato", "Al correo le falta la @ (arroba). Ejemplo: nombre@gmail.com.");
      return fallo("formato", "El correo no parece completo. Ejemplo: nombre@gmail.com.");
    }
    case "tieneRut":
    case "perteneceMinoria": {
      const si = interpretarSiNo(s);
      return si === null ? fallo("formato", "Responda sí o no.", opcionesSiNo()) : ok(si);
    }
    case "comoSeEntero": {
      const val = coincidirOpcion(s, CANALES);
      return val ? ok(val) : fallo("no_encontrado", "Elija una de las opciones.", opcionesDe(CANALES));
    }
    case "medioContacto": {
      const val = coincidirOpcion(s, MEDIOS_CONTACTO);
      return val ? ok(val) : fallo("no_encontrado", "Elija WhatsApp, llamada o correo electrónico.", opcionesDe(MEDIOS_CONTACTO));
    }
    case "departamento": {
      if (/^\d{2}$/.test(s) && existeDepartamento(s)) return ok(s);
      const cod = buscarDepartamento(s);
      if (cod) return ok(cod);
      // ¿Dijo una ciudad? Si es inequívoca, se deduce el departamento.
      const ms = buscarMunicipios(s);
      if (ms.length === 1) return ok(ms[0].codigoDepartamento, { ciudad: ms[0].codigo });
      if (ms.length > 1) return fallo("ambiguo", "Ese nombre existe en varios departamentos. ¿Cuál es el suyo?", ms.slice(0, 6).map(opcionMunicipio));
      return fallo("no_encontrado", "No reconocí ese departamento de Colombia.");
    }
    case "ciudad": {
      if (/^\d{5}$/.test(s) && municipio(s)) {
        const m = municipio(s)!;
        if (v.departamento && m.codigoDepartamento !== v.departamento)
          return fallo("formato", `Ese municipio no queda en ${nombreDepartamento(v.departamento)}.`);
        return ok(s, v.departamento ? undefined : { departamento: m.codigoDepartamento });
      }
      const ms = buscarMunicipios(s, v.departamento);
      if (ms.length === 1) return ok(ms[0].codigo, v.departamento ? undefined : { departamento: ms[0].codigoDepartamento });
      if (ms.length > 1)
        return fallo("ambiguo", "Encontré varios municipios con ese nombre. ¿Cuál es?", ms.slice(0, 6).map(opcionMunicipio));
      if (v.departamento) {
        const otros = buscarMunicipios(s);
        if (otros.length)
          return fallo(
            "no_encontrado",
            `No encontré ese municipio en ${nombreDepartamento(v.departamento)}. ¿Su negocio está en otro departamento?`,
            otros.slice(0, 4).map(opcionMunicipio),
          );
        return fallo("no_encontrado", `No encontré ese municipio en ${nombreDepartamento(v.departamento)}. Escríbalo de nuevo.`);
      }
      return fallo("no_encontrado", "No encontré ese municipio. Escríbalo de nuevo, por favor.");
    }
    case "actividadEconomica": {
      const cod = s.match(/^\s*(\d{4})\b/)?.[1] ?? (/^\d{4}$/.test(s) ? s : undefined);
      if (cod && existeCiiu(cod)) return ok(cod);
      if (cod) return fallo("no_encontrado", `El código ${cod} no está en la clasificación CIIU.`);
      const sug = sugerirCiiu(s, ctx.aprendidosCiiu);
      return fallo(
        sug.length ? "requiere_accion" : "no_encontrado",
        sug.length ? "Elija la actividad que mejor describe su negocio." : "No encontré una actividad parecida.",
        sug.map((x) => ({ etiqueta: x.corto, valor: x.codigo, detalle: x.simple })),
      );
    }
    case "anioVentas": {
      const anios = aniosVentas(ctx.hoy);
      const t = normalizar(s);
      let y = Number(s.match(/\b(20\d{2})\b/)?.[1]);
      if (!y && /(ano pasado|el pasado|ultimo ano)/.test(t)) y = anios[0];
      if (!y && /antepasado/.test(t)) y = anios[1];
      return anios.includes(y)
        ? ok(y)
        : fallo("fuera_de_rango", `El año debe ser ${anios.join(" o ")}.`, anios.map((a) => ({ etiqueta: String(a), valor: String(a) })));
    }
    case "ventasUltimoAnio": {
      const m = typeof crudo === "number" ? { valor: Math.round(crudo), periodo: null } : interpretarMonto(s);
      if (!m) return fallo("formato", "No entendí la cifra. Escríbala en pesos, por ejemplo 24.000.000 o “24 millones”.");
      if (m.periodo && m.periodo !== "anio") {
        const anual = anualizar(m.valor, m.periodo);
        return { ok: false, codigo: "periodo", error: "Esa cifra no es anual.", propuesta: anual, periodo: m.periodo };
      }
      const r = zVentas.safeParse(m.valor);
      return r.success ? ok(m.valor) : fallo("fuera_de_rango", "La cifra debe ser un número entero positivo en pesos.");
    }
    case "aceptaPoliticaDatos":
    case "aceptaTerminos": {
      if (crudo === true) return ok(true);
      const t = normalizar(s);
      if (/^(acepto|si acepto|aceptar|si|lo acepto|la acepto|los acepto|de acuerdo)\b/.test(t)) return ok(true);
      return fallo("requiere_accion", "Para continuar se necesita su aceptación explícita.");
    }
  }
}

function opcionesDe<V extends string>(ops: readonly Opcion<V>[]): OpcionSugerida[] {
  return ops.map((o) => ({ etiqueta: o.etiqueta, valor: o.valor }));
}

function opcionesSiNo(): OpcionSugerida[] {
  return [
    { etiqueta: "Sí", valor: "Sí" },
    { etiqueta: "No", valor: "No" },
  ];
}

function opcionMunicipio(m: { codigo: string; nombre: string; codigoDepartamento: string }): OpcionSugerida {
  return { etiqueta: etiquetaMunicipioConDepartamento(m), valor: m.codigo };
}
