// Máquina de estados determinista del registro. Decide el orden de los campos, qué falta,
// cuándo se puede avanzar de paso y cuándo se puede finalizar. La IA no toma estas decisiones.
import { z } from "zod";
import { CONFIG, type Tratamiento } from "@/lib/config";
import { CAMPO, CAMPOS, ORDEN, esCampo, type CampoId, type Paso } from "@/lib/form/campos";
import type { SugerenciaCiiu } from "@/lib/form/ciiu";
import { reglaDocumento, esquemaRegistroCompleto, esquemaValores, type OpcionSugerida, type Valores } from "@/lib/form/validadores";
import { municipio } from "@/lib/form/divipola";

export type Fase = "recolectando" | "revision" | "enviado" | "encuesta" | "fin";

export type Subdialogo =
  | { tipo: "confirmarDocumento" }
  | { tipo: "confirmarNombreApellido"; nombre: string; apellido: string }
  | { tipo: "elegirOpcion"; campo: CampoId; opciones: OpcionSugerida[] }
  | { tipo: "elegirCiiu"; descripcion: string; opciones: SugerenciaCiiu[] }
  | { tipo: "estimarVentas"; paso: "diaria" | "dias"; ventaDiaria?: number }
  | { tipo: "confirmarVentas"; propuesta: number; pasos: string[] }
  | { tipo: "ayudaCorreo" }
  | { tipo: "elegirCorreccion" };

export type EstadoConversacion = {
  version: 1;
  valores: Valores;
  omitidos: CampoId[];
  fase: Fase;
  /** Campo que la persona pidió corregir: tiene prioridad sobre el orden normal. */
  enfoque: CampoId | null;
  subdialogo: Subdialogo | null;
  intentos: Partial<Record<CampoId, number>>;
  /** Descripción del negocio mencionada antes de llegar al campo de actividad. */
  pistaActividad?: string;
  mensajesUsuario: number;
  radicado?: string;
  tratamiento: Tratamiento;
};

export function estadoInicial(tratamiento: Tratamiento = CONFIG.tratamiento): EstadoConversacion {
  return {
    version: 1,
    valores: {},
    omitidos: [],
    fase: "recolectando",
    enfoque: null,
    subdialogo: null,
    intentos: {},
    mensajesUsuario: 0,
    tratamiento,
  };
}

export const tieneValor = (e: EstadoConversacion, c: CampoId) => e.valores[c] !== undefined;
export function resuelto(e: EstadoConversacion, c: CampoId): boolean {
  if (c === "aceptaPoliticaDatos" || c === "aceptaTerminos") return e.valores[c] === true;
  return tieneValor(e, c) || e.omitidos.includes(c);
}

/** Campos sin resolver, en el orden del formulario. */
export function pendientes(e: EstadoConversacion): CampoId[] {
  return ORDEN.filter((c) => !resuelto(e, c));
}

export function obligatoriosFaltantes(e: EstadoConversacion): CampoId[] {
  return ORDEN.filter((c) => CAMPO[c].obligatorio && !resuelto(e, c));
}

/** El siguiente campo a preguntar. */
export function campoActual(e: EstadoConversacion): CampoId | null {
  if (e.enfoque && !(e.enfoque === "confirmacionDocumento" && !tieneValor(e, "numeroDocumento"))) return e.enfoque;
  return pendientes(e)[0] ?? null;
}

export function pasoActual(e: EstadoConversacion): Paso {
  const c = campoActual(e);
  return c ? CAMPO[c].paso : 2;
}

export function pasoCompleto(e: EstadoConversacion, paso: Paso): boolean {
  return CAMPOS.filter((c) => c.paso === paso && c.obligatorio).every((c) => resuelto(e, c.id));
}

export function progreso(e: EstadoConversacion) {
  const total = CAMPOS.length;
  const completos = CAMPOS.filter((c) => resuelto(e, c.id)).length;
  return { completos, total, porcentaje: Math.round((completos / total) * 100) };
}

export function listoParaRevision(e: EstadoConversacion) {
  return obligatoriosFaltantes(e).length === 0;
}

/**
 * Guarda un valor ya validado y aplica las dependencias del formulario
 * (cambiar el número invalida la confirmación; cambiar el departamento, la ciudad, etc.).
 */
export function asignar(e: EstadoConversacion, campo: CampoId, valor: Valores[CampoId], extra?: Valores): EstadoConversacion {
  const valores: Valores = { ...e.valores };
  const anterior = valores[campo];
  (valores as Record<string, unknown>)[campo] = valor;
  if (extra) for (const [k, v] of Object.entries(extra)) if (esCampo(k) && valores[k] === undefined) (valores as Record<string, unknown>)[k] = v;

  if (campo === "numeroDocumento" && anterior !== valor) delete valores.confirmacionDocumento;
  if (campo === "tipoDocumento" && valores.numeroDocumento && !reglaDocumento(valores.tipoDocumento).re.test(valores.numeroDocumento)) {
    delete valores.numeroDocumento;
    delete valores.confirmacionDocumento;
  }
  if (campo === "departamento" && valores.ciudad && municipio(valores.ciudad)?.codigoDepartamento !== valor) delete valores.ciudad;

  const tocados = new Set<CampoId>([campo, ...(Object.keys(extra ?? {}).filter(esCampo) as CampoId[])]);
  return {
    ...e,
    valores,
    omitidos: e.omitidos.filter((c) => !tocados.has(c)),
    enfoque: e.enfoque && tocados.has(e.enfoque) ? null : e.enfoque,
    fase: e.fase === "revision" && !listoParaRevision({ ...e, valores }) ? "recolectando" : e.fase,
  };
}

export function omitir(e: EstadoConversacion, campo: CampoId): EstadoConversacion {
  if (CAMPO[campo].obligatorio) return e;
  const valores = { ...e.valores };
  delete valores[campo];
  return {
    ...e,
    valores,
    omitidos: e.omitidos.includes(campo) ? e.omitidos : [...e.omitidos, campo],
    enfoque: e.enfoque === campo ? null : e.enfoque,
  };
}

export function borrar(e: EstadoConversacion, campo: CampoId): EstadoConversacion {
  const valores = { ...e.valores };
  delete valores[campo];
  if (campo === "numeroDocumento") delete valores.confirmacionDocumento;
  return { ...e, valores, omitidos: e.omitidos.filter((c) => c !== campo) };
}

export function sumarIntento(e: EstadoConversacion, campo: CampoId): EstadoConversacion {
  return { ...e, intentos: { ...e.intentos, [campo]: (e.intentos[campo] ?? 0) + 1 } };
}

// ---------- revalidación del estado que llega del navegador ----------

const esquemaEstado = z.object({
  valores: z.record(z.string(), z.unknown()).optional(),
  omitidos: z.array(z.string()).optional(),
  fase: z.enum(["recolectando", "revision", "enviado", "encuesta", "fin"]).optional(),
  enfoque: z.string().nullable().optional(),
  subdialogo: z.unknown().optional(),
  intentos: z.record(z.string(), z.number()).optional(),
  pistaActividad: z.string().max(300).optional(),
  mensajesUsuario: z.number().int().min(0).optional(),
  radicado: z.string().max(40).optional(),
  tratamiento: z.enum(["usted", "tu"]).optional(),
});

const esquemaSubdialogo = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("confirmarDocumento") }),
  z.object({ tipo: z.literal("confirmarNombreApellido"), nombre: z.string().max(40), apellido: z.string().max(40) }),
  z.object({
    tipo: z.literal("elegirOpcion"),
    campo: z.string().refine(esCampo),
    opciones: z.array(z.object({ etiqueta: z.string().max(120), valor: z.string().max(40), detalle: z.string().max(300).optional() })).max(10),
  }),
  z.object({
    tipo: z.literal("elegirCiiu"),
    descripcion: z.string().max(300),
    opciones: z
      .array(z.object({ codigo: z.string(), descripcion: z.string(), corto: z.string(), simple: z.string(), puntaje: z.number() }))
      .max(5),
  }),
  z.object({ tipo: z.literal("estimarVentas"), paso: z.enum(["diaria", "dias"]), ventaDiaria: z.number().optional() }),
  z.object({ tipo: z.literal("confirmarVentas"), propuesta: z.number().int().positive(), pasos: z.array(z.string().max(200)).max(6) }),
  z.object({ tipo: z.literal("ayudaCorreo") }),
  z.object({ tipo: z.literal("elegirCorreccion") }),
]);

/** Nunca se confía en el estado del navegador: cada valor se vuelve a validar en el servidor. */
export function sanitizarEstado(crudo: unknown): EstadoConversacion {
  const base = estadoInicial();
  const r = esquemaEstado.safeParse(crudo);
  if (!r.success) return base;
  const d = r.data;

  // Se validan los valores campo por campo, en orden, para respetar dependencias.
  const valores: Valores = {};
  for (const c of ORDEN) {
    const v = d.valores?.[c];
    if (v === undefined || v === null) continue;
    const prueba = esquemaValores.safeParse({ ...valores, [c]: v });
    if (prueba.success) (valores as Record<string, unknown>)[c] = (prueba.data as Record<string, unknown>)[c];
  }
  const omitidos = (d.omitidos ?? []).filter(esCampo).filter((c) => !CAMPO[c].obligatorio && valores[c] === undefined);
  const sub = esquemaSubdialogo.safeParse(d.subdialogo);
  let e: EstadoConversacion = {
    ...base,
    valores,
    omitidos: [...new Set(omitidos)],
    enfoque: esCampo(d.enfoque) ? d.enfoque : null,
    subdialogo: sub.success ? (sub.data as Subdialogo) : null,
    intentos: Object.fromEntries(Object.entries(d.intentos ?? {}).filter(([k]) => esCampo(k))),
    pistaActividad: d.pistaActividad,
    mensajesUsuario: d.mensajesUsuario ?? 0,
    tratamiento: d.tratamiento ?? base.tratamiento,
  };
  // La fase debe ser coherente con los datos.
  const completo = esquemaRegistroCompleto.safeParse(valores).success;
  if ((d.fase === "enviado" || d.fase === "encuesta" || d.fase === "fin") && completo && d.radicado) {
    e = { ...e, fase: d.fase, radicado: d.radicado };
  } else if (d.fase === "revision" && listoParaRevision(e)) {
    e = { ...e, fase: "revision" };
  }
  return e;
}

// ---------- registro final ----------

export type RegistroGenerado = ReturnType<typeof construirRegistro>;

/** JSON con la estructura del formulario real. En la demo no se envía a Neocrédito. */
export function construirRegistro(e: EstadoConversacion, radicado: string, fecha = new Date()) {
  const v = e.valores;
  return {
    radicado,
    fechaRegistro: fecha.toISOString(),
    tipoPersona: "PERSONA_NATURAL",
    informacionGeneral: {
      primerNombre: v.primerNombre,
      primerApellido: v.primerApellido,
      tipoDocumento: v.tipoDocumento,
      numeroDocumento: v.numeroDocumento,
      confirmacionNumeroDocumento: v.confirmacionDocumento,
      genero: v.genero,
      numeroCelular: v.celular,
      correoElectronico: v.correo,
      tieneRut: v.tieneRut ?? null,
      comoSeEntero: v.comoSeEntero ?? null,
    },
    informacionFinanciera: {
      departamentoNegocio: v.departamento,
      ciudadNegocio: v.ciudad,
      medioContacto: v.medioContacto,
      perteneceMinoria: v.perteneceMinoria ?? null,
      actividadEconomicaCiiu: v.actividadEconomica,
      anioVentas: v.anioVentas,
      ventasUltimoAnio: v.ventasUltimoAnio,
    },
    aceptaPoliticaTratamientoDatos: v.aceptaPoliticaDatos === true,
    aceptaTerminosCondiciones: v.aceptaTerminos === true,
    canal: "ASISTENTE_CONVERSACIONAL_PROTOTIPO",
  };
}

export function generarRadicado(fecha = new Date()) {
  const ymd = fecha.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 6)
    .toUpperCase();
  return `DEMO-${ymd}-${rand}`;
}
