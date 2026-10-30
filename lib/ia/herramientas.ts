// Herramientas (tools) que Claude puede usar. Todas ejecutan código determinista: la IA propone,
// el código valida y decide. Ninguna herramienta puede confirmar el documento, aceptar la política
// o los términos, ni finalizar el registro: eso requiere una acción explícita de la persona.
import { tool, type LanguageModel, type UIMessageStreamWriter } from "ai";
import { z } from "zod";
import { CONFIG, enlaceWhatsAppAsesor } from "@/lib/config";
import { buscarFaq } from "@/lib/conocimiento/faq";
import { listoParaRevision, obligatoriosFaltantes, omitir } from "@/lib/conversacion/estado";
import type { ContextoMotor, Turnero } from "@/lib/conversacion/motor";
import type { Bloque } from "@/lib/conversacion/tipos";
import { CAMPO, CAMPOS_SOLO_ACCION_EXPLICITA, ORDEN, type CampoId } from "@/lib/form/campos";
import { existeCiiu } from "@/lib/form/ciiu";
import { estimarVentasAnuales, interpretarMonto } from "@/lib/form/dinero";
import { valorLegible } from "@/lib/form/presentacion";
import { interpretarCampo } from "@/lib/form/validadores";
import { escribirBloque } from "@/lib/servidor/flujo";
import { clasificarCiiu } from "./ciiu";
import { describirSiguiente } from "./prompt";

const CAMPOS_IA = ORDEN.filter((c) => !CAMPOS_SOLO_ACCION_EXPLICITA.includes(c)) as [CampoId, ...CampoId[]];

export type SesionIA = {
  turnero: Turnero;
  ctx: ContextoMotor;
  writer: UIMessageStreamWriter;
  bloquesEmitidos: Set<Bloque["tipo"]>;
  modeloClasificacion: LanguageModel | null;
};

function emitir(s: SesionIA, bloque: Bloque) {
  s.bloquesEmitidos.add(bloque.tipo);
  escribirBloque(s.writer, bloque);
}

export function crearHerramientas(s: SesionIA) {
  return {
    actualizarCampo: tool({
      description:
        "Guarda uno o varios datos del formulario que la persona dio en su mensaje. El código valida cada dato y responde qué se guardó, qué errores hubo y cuál es el siguiente campo. Use el texto tal como lo dijo la persona (por ejemplo 'cc', 'Cali', '310 456 7890', 'wasap').",
      inputSchema: z.object({
        campos: z
          .array(
            z.object({
              campo: z.enum(CAMPOS_IA).describe("Identificador del campo"),
              valor: z.string().max(200).describe("Valor dicho por la persona. Para omitir un campo opcional use 'omitir'."),
            }),
          )
          .min(1)
          .max(16),
      }),
      execute: async ({ campos }) => {
        const guardados: { campo: CampoId; valor: string }[] = [];
        const errores: { campo: CampoId; error: string; opciones?: string[]; propuesta_anual?: number }[] = [];
        // Se procesan en el orden del formulario para respetar dependencias (departamento antes de ciudad).
        const ordenados = [...campos].sort((a, b) => ORDEN.indexOf(a.campo) - ORDEN.indexOf(b.campo));
        for (const { campo, valor } of ordenados) {
          const def = CAMPO[campo];
          if (/^(omitir|prefiero no (decir|responder))$/i.test(valor.trim())) {
            if (def.obligatorio) errores.push({ campo, error: "Es obligatorio; no se puede omitir." });
            else {
              s.turnero.e = omitir(s.turnero.e, campo);
              guardados.push({ campo, valor: "(prefirió no responder)" });
            }
            continue;
          }
          if (campo === "actividadEconomica" && !(/^\d{4}$/.test(valor.trim()) && existeCiiu(valor.trim()))) {
            errores.push({ campo, error: "Para la actividad use sugerirCIIU con la descripción y deje que la persona elija." });
            continue;
          }
          if (campo === "ventasUltimoAnio") {
            const r = interpretarCampo(campo, valor, s.turnero.e.valores);
            if (!r.ok && r.codigo === "periodo") {
              errores.push({ campo, error: "La cifra no es anual. Use estimarVentas para calcular el total del año y pedir confirmación.", propuesta_anual: r.propuesta });
              continue;
            }
          }
          const r = s.turnero.guardar(campo, valor, "ia");
          if (r.ok) guardados.push({ campo, valor: valorLegible(campo, s.turnero.e.valores) });
          else {
            const detalle = interpretarCampo(campo, valor, s.turnero.e.valores);
            errores.push({ campo, error: r.error, opciones: !detalle.ok ? detalle.opciones?.map((o) => o.etiqueta) : undefined });
          }
        }
        s.turnero.e = { ...s.turnero.e, subdialogo: null };
        return {
          guardados: guardados.map((g) => ({ campo: g.campo, valor: ["numeroDocumento", "celular", "correo", "genero", "perteneceMinoria"].includes(g.campo) ? "(registrado)" : g.valor })),
          errores,
          siguiente: describirSiguiente(s.turnero.e),
        };
      },
    }),

    sugerirCIIU: tool({
      description:
        "Propone los 3 códigos CIIU más probables para la descripción del negocio que dio la persona (por ejemplo 'vendo empanadas en la esquina'). La pantalla muestra las opciones como tarjetas para que la persona elija.",
      inputSchema: z.object({ descripcion: z.string().min(2).max(300).describe("Descripción del negocio con las palabras de la persona") }),
      execute: async ({ descripcion }) => {
        s.turnero.eventos.push({ tipo: "ayuda", campo: "actividadEconomica" });
        const opciones = await clasificarCiiu(descripcion, s.ctx.aprendidosCiiu, s.modeloClasificacion);
        if (!opciones.length) return { opciones: [], instruccion: "No hubo coincidencias: pida que describa el negocio con otras palabras." };
        s.turnero.e = { ...s.turnero.e, subdialogo: { tipo: "elegirCiiu", descripcion, opciones } };
        emitir(s, { tipo: "opcionesCiiu", descripcion, opciones });
        return {
          opciones: opciones.map((o, i) => ({ numero: i + 1, codigo: o.codigo, nombre: o.corto, explicacion_sencilla: o.simple })),
          instruccion: "Las opciones ya se muestran como tarjetas. En una o dos frases invite a elegir la que mejor describa su negocio. No elija por la persona.",
        };
      },
    }),

    estimarVentas: tool({
      description:
        "Calcula las ventas anuales a partir de lo que la persona sabe (venta de un día normal y días por semana, o venta semanal, o mensual). Devuelve el cálculo paso a paso; la pantalla lo muestra con un botón para confirmar.",
      inputSchema: z.object({
        ventaDiaria: z.number().int().positive().optional().describe("Pesos que vende en un día normal"),
        diasPorSemana: z.number().int().min(1).max(7).optional(),
        ventaSemanal: z.number().int().positive().optional(),
        ventaMensual: z.number().int().positive().optional(),
        mesesTrabajados: z.number().int().min(1).max(12).optional().describe("Meses que trabajó en el año, si no fueron los 12"),
        textoOriginal: z.string().max(200).optional().describe("Frase original de la persona, p. ej. 'unos 2 millones al mes'"),
      }),
      execute: async (datos) => {
        s.turnero.eventos.push({ tipo: "ayuda", campo: "ventasUltimoAnio" });
        // Si la IA pasó solo el texto, el parser determinista lo interpreta.
        if (!datos.ventaDiaria && !datos.ventaSemanal && !datos.ventaMensual && datos.textoOriginal) {
          const m = interpretarMonto(datos.textoOriginal);
          if (m?.periodo === "mes") datos.ventaMensual = m.valor;
          else if (m?.periodo === "semana") datos.ventaSemanal = m.valor;
          else if (m?.periodo === "dia") datos.ventaDiaria = m.valor;
        }
        const est = estimarVentasAnuales(datos);
        if (!est) return { error: "Faltan datos. Pregunte cuánto vende en un día normal y cuántos días trabaja a la semana." };
        s.turnero.e = { ...s.turnero.e, subdialogo: { tipo: "confirmarVentas", propuesta: est.total, pasos: est.pasos } };
        emitir(s, { tipo: "calculoVentas", pasos: est.pasos, total: est.total });
        return { total_anual: est.total, pasos: est.pasos, instruccion: "El cálculo ya se muestra. Pida confirmar con el botón o decir la cifra correcta." };
      },
    }),

    explicarCampo: tool({
      description: "Devuelve la explicación oficial, en lenguaje sencillo, de para qué sirve un campo del formulario.",
      inputSchema: z.object({ campo: z.enum(ORDEN as [CampoId, ...CampoId[]]) }),
      execute: async ({ campo }) => {
        s.turnero.eventos.push({ tipo: "ayuda", campo });
        return { campo, explicacion: CAMPO[campo].ayuda, ejemplo: CAMPO[campo].ejemplo ?? null };
      },
    }),

    consultarPreguntasFrecuentes: tool({
      description: "Busca en la base de conocimiento de Neocrédito (qué es, si cobra, ofertas, qué pasa después, datos personales, fraude). Úsela antes de responder cualquier pregunta sobre Neocrédito.",
      inputSchema: z.object({ pregunta: z.string().min(2).max(300) }),
      execute: async ({ pregunta }) => {
        const r = buscarFaq(pregunta, s.ctx.faqExtra);
        if (r) {
          s.turnero.eventos.push({ tipo: "pregunta_faq", id: r.entrada.id });
          return { encontrado: true, respuesta: r.entrada.respuesta, fuente: r.entrada.fuente };
        }
        s.turnero.eventos.push({ tipo: "pregunta_sin_respuesta", texto: pregunta });
        return {
          encontrado: false,
          instruccion: "No hay respuesta aprobada. Dígalo con honestidad, explique que la pregunta quedó anotada para que el equipo la revise y ofrezca un asesor. No invente.",
        };
      },
    }),

    mostrarResumen: tool({
      description: "Muestra la tarjeta de resumen con todos los datos para revisar antes de finalizar. Úsela cuando no falte ningún dato.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!listoParaRevision(s.turnero.e)) return { ok: false, faltan: obligatoriosFaltantes(s.turnero.e).map((c) => CAMPO[c].etiqueta) };
        s.turnero.e = { ...s.turnero.e, fase: "revision", subdialogo: null, enfoque: null };
        emitir(s, { tipo: "resumen" });
        return { ok: true, instruccion: "Pida revisar la tarjeta: puede tocar un dato para corregirlo o «Finalizar registro»." };
      },
    }),

    escalarAAsesor: tool({
      description: "Ofrece hablar con un asesor humano (WhatsApp o teléfono). Úsela si la persona lo pide o si no logra avanzar.",
      inputSchema: z.object({ motivo: z.string().max(200) }),
      execute: async ({ motivo }) => {
        s.turnero.eventos.push({ tipo: "escalamiento", motivo: `ia: ${motivo}`.slice(0, 120) });
        emitir(s, { tipo: "asesor" });
        return { whatsapp: enlaceWhatsAppAsesor(), telefono: CONFIG.asesor.telefono, horario: CONFIG.asesor.horario, nota: "Su avance queda guardado." };
      },
    }),
  };
}
