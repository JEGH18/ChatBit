// Motor conversacional determinista. Funciona sin IA (modo guiado) y, con IA, se encarga de todo
// lo que exige una acción explícita: confirmar el documento, elegir el CIIU, aceptar la política
// y los términos, revisar el resumen y finalizar. Mismas reglas para todas las personas.
import { CONFIG, enlaceWhatsAppAsesor, type Tratamiento } from "@/lib/config";
import { buscarFaq, parecePregunta, type EntradaFaq } from "@/lib/conocimiento/faq";
import { CAMPO, ORDEN, esCampo, preguntaDe, type CampoId } from "@/lib/form/campos";
import { CANALES, GENEROS, MEDIOS_CONTACTO, TIPOS_DOCUMENTO, aniosVentas, type Opcion } from "@/lib/form/catalogos";
import { CIIU_POPULARES, sugerenciaDe, sugerirCiiu, type SinonimoAprendido } from "@/lib/form/ciiu";
import { estimarVentasAnuales, interpretarMonto, type Periodo } from "@/lib/form/dinero";
import { DEPARTAMENTOS_FRECUENTES, municipioPrincipal, nombreDepartamento, nombreMunicipio } from "@/lib/form/divipola";
import { valorLegible } from "@/lib/form/presentacion";
import { esquemaRegistroCompleto, interpretarCampo, soloDigitos, type OpcionSugerida } from "@/lib/form/validadores";
import { detectarDatoProhibido, detectarInyeccion } from "@/lib/seguridad";
import { agruparDocumento, formatoCOP, interpretarSiNo, normalizar, tipoTitulo } from "@/lib/texto";
import {
  asignar,
  borrar,
  campoActual,
  generarRadicado,
  listoParaRevision,
  omitir,
  sumarIntento,
  type EstadoConversacion,
} from "./estado";
import { extraerCampos } from "./extractor";
import type { Accion, Bloque, Chip, Entrada, EventoMotor, MensajeBot, Turno } from "./tipos";

export type ContextoMotor = {
  aprendidosCiiu?: SinonimoAprendido[];
  faqExtra?: EntradaFaq[];
  hoy?: Date;
};

const VINETAS_POLITICA = [
  "Sus datos se usan solo para su registro y para que las entidades aliadas le contacten con ofertas.",
  "Puede conocer, corregir o pedir que se borren sus datos cuando quiera (Ley 1581 de 2012).",
  "Sus datos no se venden y no se usan para fines distintos a los autorizados.",
];
const VINETAS_TERMINOS = [
  "Neocrédito no cobra por el registro ni por el trámite.",
  "Las ofertas de las entidades no son en firme: cada entidad hace su propio estudio.",
  "Puede recibir varias ofertas, pero solo puede aceptar una.",
];

const PASOS_CORREO = [
  "Entre a gmail.com desde el celular o un computador.",
  "Toque “Crear cuenta” y luego “Para uso personal”.",
  "Escriba su nombre, fecha de nacimiento y elija un nombre de usuario (por ejemplo, nombreapellido123).",
  "Cree una contraseña que solo usted conozca. No se la comparta a nadie, tampoco a este asistente.",
  "Cuando termine, vuelva aquí y escriba el correo nuevo. Su avance queda guardado.",
];

// ---------- utilidades ----------

const trato = (t: Tratamiento, usted: string, tu: string) => (t === "tu" ? tu : usted);

function chipsOpciones<V extends string>(campo: CampoId, opciones: readonly Opcion<V>[]): Chip[] {
  return opciones.map((o) => ({ etiqueta: o.etiqueta, texto: o.etiqueta, accion: { tipo: "responder", campo, valor: o.valor } }));
}

function chipsSugeridas(campo: CampoId, opciones: OpcionSugerida[]): Chip[] {
  return opciones.map((o) => ({ etiqueta: o.etiqueta, texto: o.etiqueta, accion: { tipo: "responder", campo, valor: o.valor } }));
}

const chipAsesor = (): Chip => ({ etiqueta: "Hablar con un asesor", texto: "Quiero hablar con un asesor", accion: { tipo: "asesor" } });

/** Palabras con las que la persona puede referirse a un campo ("corregir el celular"). */
const PALABRAS_CAMPO: Record<CampoId, string[]> = {
  primerNombre: ["nombre", "nombres", "primer nombre", "segundo nombre"],
  primerApellido: ["apellido", "apellidos", "primer apellido", "segundo apellido"],
  tipoDocumento: ["tipo de documento", "tipo documento"],
  numeroDocumento: ["numero de documento", "documento", "cedula", "numero de cedula"],
  confirmacionDocumento: ["confirmacion"],
  genero: ["genero", "sexo"],
  celular: ["celular", "telefono", "numero de celular", "movil"],
  correo: ["correo", "email", "mail", "correo electronico"],
  tieneRut: ["rut"],
  comoSeEntero: ["como se entero", "como me entere", "enteraste"],
  departamento: ["departamento"],
  ciudad: ["ciudad", "municipio"],
  medioContacto: ["contacto", "contactado", "como me contactan", "medio de contacto"],
  perteneceMinoria: ["minoria"],
  actividadEconomica: ["actividad", "ciiu", "actividad economica", "a que me dedico"],
  anioVentas: ["ano de ventas", "ano"],
  ventasUltimoAnio: ["ventas", "cuanto vendi", "valor de ventas"],
  aceptaPoliticaDatos: ["politica", "politica de datos"],
  aceptaTerminos: ["terminos", "terminos y condiciones"],
};

export function campoMencionado(texto: string): CampoId | null {
  const t = normalizar(texto);
  let mejor: { c: CampoId; largo: number } | null = null;
  for (const c of ORDEN) {
    for (const p of PALABRAS_CAMPO[c]) {
      if (new RegExp(`(^| )${p}( |$)`).test(t) && (!mejor || p.length > mejor.largo)) mejor = { c, largo: p.length };
    }
  }
  return mejor?.c ?? null;
}

// ---------- construcción del turno ----------

export class Turnero {
  e: EstadoConversacion;
  mensajes: MensajeBot[] = [];
  chips: Chip[] | null = null;
  eventos: EventoMotor[] = [];
  ui: Turno["ui"] = undefined;
  /** Paso del formulario al empezar el turno, para anunciar el cambio de paso. */
  private pasoInicial: number;

  constructor(
    e: EstadoConversacion,
    private ctx: ContextoMotor,
  ) {
    this.e = e;
    const c = campoActual(e);
    this.pasoInicial = c ? CAMPO[c].paso : 2;
  }

  t(usted: string, tu: string) {
    return trato(this.e.tratamiento, usted, tu);
  }

  decir(texto: string, bloque?: Bloque) {
    this.mensajes.push({ texto, bloque });
  }

  resultado(): Turno {
    return { estado: this.e, mensajes: this.mensajes, chips: this.chips ?? [], eventos: this.eventos, ui: this.ui };
  }

  // ----- guardar valores -----

  /** Valida y guarda. Devuelve true si quedó guardado. */
  guardar(campo: CampoId, crudo: unknown, origen: "respuesta" | "extraccion" | "boton" | "ia"): { ok: true } | { ok: false; error: string } {
    const r = interpretarCampo(campo, crudo, this.e.valores, { aprendidosCiiu: this.ctx.aprendidosCiiu, hoy: this.ctx.hoy });
    if (!r.ok) {
      this.e = sumarIntento(this.e, campo);
      this.eventos.push({ tipo: "error_validacion", campo, codigo: r.codigo });
      return { ok: false, error: r.error };
    }
    this.e = asignar(this.e, campo, r.valor, r.extra);
    this.eventos.push({ tipo: "campo_completado", campo, origen });
    for (const k of Object.keys(r.extra ?? {})) if (esCampo(k)) this.eventos.push({ tipo: "campo_completado", campo: k, origen });
    return { ok: true };
  }

  // ----- preguntar lo siguiente -----

  preguntarSiguiente(prefijo?: string) {
    const e = this.e;
    if (e.fase === "enviado" || e.fase === "encuesta" || e.fase === "fin") {
      if (prefijo) this.decir(prefijo);
      this.chips = [];
      return;
    }
    const c = campoActual(e);
    if (!c) {
      if (listoParaRevision(e)) return this.mostrarResumen(prefijo);
      return;
    }
    const cambioDePaso = this.pasoInicial === 1 && CAMPO[c].paso === 2 && !e.enfoque;
    const intro = [prefijo, cambioDePaso ? this.t("¡Terminamos la primera parte! Ahora, los datos de su negocio.", "¡Terminamos la primera parte! Ahora, los datos de tu negocio.") : ""]
      .filter(Boolean)
      .join("\n\n");
    this.pasoInicial = CAMPO[c].paso;

    switch (c) {
      case "confirmacionDocumento":
        this.e = { ...this.e, subdialogo: { tipo: "confirmarDocumento" } };
        this.decir(
          [intro, `Le leo el número para confirmar: **${agruparDocumento(e.valores.numeroDocumento!)}**. ¿Es correcto?`].filter(Boolean).join("\n\n"),
        );
        this.chips = [
          { etiqueta: "Sí, es correcto", texto: "Sí, es correcto", accion: { tipo: "confirmarDocumento", correcto: true }, variante: "primario" },
          { etiqueta: "No, corregir", texto: "No, quiero corregirlo", accion: { tipo: "confirmarDocumento", correcto: false } },
        ];
        return;
      case "actividadEconomica":
        if (e.pistaActividad && !e.enfoque) {
          const pista = e.pistaActividad;
          this.e = { ...this.e, pistaActividad: undefined };
          if (this.sugerirActividad(pista, intro)) return;
        }
        break;
      case "aceptaPoliticaDatos":
      case "aceptaTerminos":
        return this.pedirConsentimiento(c, intro);
    }

    const valorActual = e.enfoque && e.valores[c] !== undefined ? `\n(Valor actual: ${valorLegible(c, e.valores)})` : "";
    this.decir([intro, `${preguntaDe(c, e.tratamiento)}${valorActual}`].filter(Boolean).join("\n\n"));
    this.chips = this.chipsDe(c);
  }

  chipsDe(c: CampoId): Chip[] {
    const e = this.e;
    const omitir: Chip = { etiqueta: "Prefiero no responder", texto: "Prefiero no responder", accion: { tipo: "omitir", campo: c } };
    const explicar = (etiqueta: string): Chip => ({ etiqueta, texto: etiqueta, accion: { tipo: "explicar", campo: c } });
    switch (c) {
      case "tipoDocumento":
        return chipsOpciones(c, TIPOS_DOCUMENTO);
      case "genero":
        return [...chipsOpciones(c, GENEROS), explicar("¿Por qué lo preguntan?")];
      case "correo":
        return [{ etiqueta: "No tengo correo", texto: "No tengo correo", accion: { tipo: "ayudaCorreo" } }];
      case "tieneRut":
        return [
          { etiqueta: "Sí", texto: "Sí", accion: { tipo: "responder", campo: c, valor: "Sí" } },
          { etiqueta: "No", texto: "No", accion: { tipo: "responder", campo: c, valor: "No" } },
          explicar("¿Qué es el RUT?"),
        ];
      case "comoSeEntero":
        return [...chipsOpciones(c, CANALES), omitir];
      case "departamento":
        return [
          ...DEPARTAMENTOS_FRECUENTES.map((cod) => ({
            etiqueta: nombreDepartamento(cod),
            texto: nombreDepartamento(cod),
            accion: { tipo: "responder", campo: c, valor: cod } as Accion,
          })),
          { etiqueta: "Ver todos los departamentos", texto: "", accion: { tipo: "abrirCampo", campo: c } },
        ];
      case "ciudad": {
        // Mismo tipo y número de botones para todos los departamentos (ver tests/unit/equidad.test.ts).
        const dep = e.valores.departamento;
        const principal = dep ? municipioPrincipal(dep) : undefined;
        return [
          ...(principal
            ? [{ etiqueta: tipoTitulo(nombreMunicipio(principal)), texto: tipoTitulo(nombreMunicipio(principal)), accion: { tipo: "responder", campo: c, valor: principal } as Accion }]
            : []),
          { etiqueta: "Ver todos los municipios", texto: "", accion: { tipo: "abrirCampo", campo: c } },
        ];
      }
      case "medioContacto":
        return chipsOpciones(c, MEDIOS_CONTACTO);
      case "perteneceMinoria":
        return [
          { etiqueta: "Sí", texto: "Sí", accion: { tipo: "responder", campo: c, valor: "Sí" } },
          { etiqueta: "No", texto: "No", accion: { tipo: "responder", campo: c, valor: "No" } },
          omitir,
          explicar("¿Para qué lo preguntan?"),
        ];
      case "actividadEconomica":
        return [
          ...CIIU_POPULARES.map((cod) => {
            const s = sugerenciaDe(cod)!;
            return { etiqueta: s.corto, texto: s.corto, accion: { tipo: "elegirCiiu", codigo: cod } as Accion };
          }),
          explicar("¿Qué es el CIIU?"),
        ];
      case "anioVentas":
        return aniosVentas(this.ctx.hoy).map((a) => ({ etiqueta: String(a), texto: String(a), accion: { tipo: "responder", campo: c, valor: String(a) } }));
      case "ventasUltimoAnio":
        return [
          {
            etiqueta: this.t("No sé, ayúdeme a calcular", "No sé, ayúdame a calcular"),
            texto: this.t("No sé, ayúdeme a calcular", "No sé, ayúdame a calcular"),
            accion: { tipo: "estimarVentas" },
            variante: "primario",
          },
        ];
      default:
        return [];
    }
  }

  pedirConsentimiento(campo: "aceptaPoliticaDatos" | "aceptaTerminos", intro = "") {
    const politica = campo === "aceptaPoliticaDatos";
    this.decir([intro, preguntaDe(campo, this.e.tratamiento) + " En resumen:"].filter(Boolean).join("\n\n"), {
      tipo: "consentimiento",
      campo,
      vinetas: politica ? VINETAS_POLITICA : VINETAS_TERMINOS,
      enlace: politica ? CONFIG.enlaces.politicaDatos : CONFIG.enlaces.terminos,
    });
    this.chips = [
      {
        etiqueta: politica ? "Acepto la política de datos" : "Acepto los términos",
        texto: politica ? "Acepto la política de tratamiento de datos personales" : "Acepto los términos y condiciones",
        accion: { tipo: "aceptar", campo },
        variante: "primario",
      },
      { etiqueta: "Leer el texto completo", texto: "", enlace: politica ? CONFIG.enlaces.politicaDatos : CONFIG.enlaces.terminos },
      { etiqueta: "No acepto", texto: "No acepto", accion: { tipo: "rechazar", campo } },
    ];
  }

  mostrarResumen(prefijo?: string) {
    this.e = { ...this.e, fase: "revision", subdialogo: null, enfoque: null };
    this.decir(
      [prefijo, this.t("¡Ya tenemos todo! Revise sus datos. Si algo está mal, toque el dato para corregirlo.", "¡Ya tenemos todo! Revisa tus datos. Si algo está mal, toca el dato para corregirlo.")]
        .filter(Boolean)
        .join("\n\n"),
      { tipo: "resumen" },
    );
    this.chips = [
      { etiqueta: "Finalizar registro", texto: "Finalizar registro", accion: { tipo: "finalizar" }, variante: "primario" },
      { etiqueta: "Corregir un dato", texto: "Quiero corregir un dato", accion: { tipo: "corregir" } },
    ];
  }

  sugerirActividad(descripcion: string, intro = ""): boolean {
    const opciones = sugerirCiiu(descripcion, this.ctx.aprendidosCiiu, 3);
    if (!opciones.length) return false;
    this.e = { ...this.e, subdialogo: { tipo: "elegirCiiu", descripcion, opciones } };
    this.decir(
      [
        intro,
        this.t(
          `Por lo que me cuenta («${descripcion}»), estas son las actividades que más se parecen. Elija la que mejor describe su negocio:`,
          `Por lo que me cuentas («${descripcion}»), estas son las actividades que más se parecen. Elige la que mejor describe tu negocio:`,
        ),
      ]
        .filter(Boolean)
        .join("\n\n"),
      { tipo: "opcionesCiiu", descripcion, opciones },
    );
    this.chips = [
      ...opciones.map((o, i) => ({ etiqueta: `${i + 1}. ${o.corto}`, texto: `${o.codigo} - ${o.corto}`, accion: { tipo: "elegirCiiu", codigo: o.codigo } as Accion })),
      { etiqueta: "Ninguna se parece", texto: "Ninguna se parece", accion: { tipo: "ningunCiiu" } },
    ];
    return true;
  }

  explicar(campo: CampoId | null) {
    const c = campo ?? campoActual(this.e);
    this.eventos.push({ tipo: "ayuda", campo: c });
    if (!c) return this.preguntarSiguiente();
    const ayuda = CAMPO[c].ayuda + (CAMPO[c].ejemplo ? ` Por ejemplo: ${CAMPO[c].ejemplo}.` : "");
    if (c === "genero" || c === "perteneceMinoria") {
      // Campos sensibles: explicación neutral, mismas opciones, sin insistir.
      this.decir(ayuda);
      this.chips = this.chipsDe(c);
      return;
    }
    if (campoActual(this.e) === c) {
      this.decir(`${ayuda}\n\n${preguntaDe(c, this.e.tratamiento)}`);
      this.chips = this.chipsDe(c);
    } else {
      this.decir(ayuda);
      this.preguntarSiguiente();
    }
  }

  escalar(motivo: string) {
    this.eventos.push({ tipo: "escalamiento", motivo });
    this.decir(
      this.t(
        `Con gusto. Puede hablar con un asesor por WhatsApp o al teléfono ${CONFIG.asesor.telefono} (${CONFIG.asesor.horario}). Lo que ya llenó queda guardado aquí.`,
        `Con gusto. Puedes hablar con un asesor por WhatsApp o al teléfono ${CONFIG.asesor.telefono} (${CONFIG.asesor.horario}). Lo que ya llenaste queda guardado aquí.`,
      ),
      { tipo: "asesor" },
    );
    this.chips = [
      { etiqueta: "Abrir WhatsApp", texto: "", enlace: enlaceWhatsAppAsesor(), variante: "primario" },
      { etiqueta: "Seguir con el asistente", texto: "Sigamos", accion: { tipo: "responder", campo: campoActual(this.e) ?? "primerNombre", valor: "__continuar__" } },
    ];
  }

  // ----- acciones estructuradas -----

  accion(a: Accion, textoVisible?: string) {
    const e = this.e;
    switch (a.tipo) {
      case "iniciar":
        this.decir(
          this.t(
            `¡Hola! Soy ${CONFIG.nombreAsistente}, un asistente con inteligencia artificial. Le ayudo a llenar su registro en Neocrédito paso a paso, en unos 5 minutos.\n\nPuede escribir o hablar, como le quede más fácil. Por ejemplo: «Me llamo Ana Pérez y mi negocio queda en Cali».\n\nRecuerde: Neocrédito **no cobra** por el trámite y yo **nunca** le pediré claves ni códigos.`,
            `¡Hola! Soy ${CONFIG.nombreAsistente}, un asistente con inteligencia artificial. Te ayudo a llenar tu registro en Neocrédito paso a paso, en unos 5 minutos.\n\nPuedes escribir o hablar, como te quede más fácil. Por ejemplo: «Me llamo Ana Pérez y mi negocio queda en Cali».\n\nRecuerda: Neocrédito **no cobra** por el trámite y yo **nunca** te pediré claves ni códigos.`,
          ),
        );
        return this.preguntarSiguiente();

      case "responder": {
        if (a.valor === "__continuar__") return this.preguntarSiguiente(this.t("Sigamos.", "Sigamos."));
        this.e = { ...this.e, subdialogo: null };
        const r = this.guardar(a.campo, a.valor, "boton");
        if (!r.ok) {
          this.decir(r.error);
          this.chips = this.chipsDe(a.campo);
          return;
        }
        return this.trasGuardar([a.campo]);
      }

      case "omitir":
        if (CAMPO[a.campo].obligatorio) {
          this.decir("Este dato es obligatorio en el formulario.");
          return this.preguntarSiguiente();
        }
        this.e = { ...omitir(this.e, a.campo), subdialogo: null };
        this.eventos.push({ tipo: "campo_omitido", campo: a.campo });
        return this.preguntarSiguiente(this.t("Entendido, no hay problema.", "Entendido, no hay problema."));

      case "explicar":
        return this.explicar(a.campo);

      case "confirmarDocumento":
        this.e = { ...this.e, subdialogo: null };
        if (a.correcto && e.valores.numeroDocumento) {
          this.guardar("confirmacionDocumento", true, "boton");
          return this.preguntarSiguiente(this.t("Perfecto.", "Perfecto."));
        }
        this.e = { ...borrar(this.e, "numeroDocumento"), enfoque: null };
        this.eventos.push({ tipo: "correccion", campo: "numeroDocumento" });
        this.decir(this.t("Escriba de nuevo su número de documento, despacio y sin puntos.", "Escribe de nuevo tu número de documento, despacio y sin puntos."));
        this.chips = [];
        return;

      case "confirmarNombreApellido": {
        const sub = e.subdialogo;
        this.e = { ...this.e, subdialogo: null };
        if (sub?.tipo !== "confirmarNombreApellido") return this.preguntarSiguiente();
        if (a.correcto) {
          this.guardar("primerNombre", sub.nombre, "boton");
          this.guardar("primerApellido", sub.apellido, "boton");
          return this.preguntarSiguiente(`Mucho gusto, ${tipoTitulo(sub.nombre)}.`);
        }
        this.guardar("primerNombre", `${sub.nombre} ${sub.apellido}`, "boton");
        return this.preguntarSiguiente(`Mucho gusto, ${tipoTitulo(`${sub.nombre} ${sub.apellido}`)}.`);
      }

      case "elegirCiiu": {
        const sub = e.subdialogo;
        const descripcion = sub?.tipo === "elegirCiiu" ? sub.descripcion : "";
        const posicion = sub?.tipo === "elegirCiiu" ? sub.opciones.findIndex((o) => o.codigo === a.codigo) : -1;
        this.e = { ...this.e, subdialogo: null };
        const r = this.guardar("actividadEconomica", a.codigo, "boton");
        if (!r.ok) {
          this.decir(r.error);
          return this.preguntarSiguiente();
        }
        if (descripcion) this.eventos.push({ tipo: "ciiu_confirmado", descripcion, codigo: a.codigo, posicion: posicion >= 0 ? posicion + 1 : null });
        return this.trasGuardar(["actividadEconomica"]);
      }

      case "ningunCiiu":
        this.e = { ...this.e, subdialogo: null };
        this.eventos.push({ tipo: "ayuda", campo: "actividadEconomica" });
        this.decir(
          this.t(
            "Cuénteme con otras palabras qué vende o qué servicio presta. Por ejemplo: «arreglo celulares» o «vendo ropa por WhatsApp». Si tiene el RUT a la mano, el código CIIU aparece ahí.",
            "Cuéntame con otras palabras qué vendes o qué servicio prestas. Por ejemplo: «arreglo celulares» o «vendo ropa por WhatsApp». Si tienes el RUT a la mano, el código CIIU aparece ahí.",
          ),
        );
        this.chips = [chipAsesor()];
        return;

      case "estimarVentas":
        this.eventos.push({ tipo: "ayuda", campo: "ventasUltimoAnio" });
        this.e = { ...this.e, subdialogo: { tipo: "estimarVentas", paso: "diaria" } };
        this.decir(
          this.t(
            "Hagamos la cuenta juntos. ¿Cuánto vende en un **día normal**, más o menos? (Si le queda más fácil, dígame cuánto vende a la semana o al mes).",
            "Hagamos la cuenta juntos. ¿Cuánto vendes en un **día normal**, más o menos? (Si te queda más fácil, dime cuánto vendes a la semana o al mes).",
          ),
        );
        this.chips = [];
        return;

      case "usarVentas": {
        this.e = { ...this.e, subdialogo: null };
        const r = this.guardar("ventasUltimoAnio", a.valor, "boton");
        if (!r.ok) {
          this.decir(r.error);
          return this.preguntarSiguiente();
        }
        return this.trasGuardar(["ventasUltimoAnio"]);
      }

      case "rechazarVentas":
        this.e = { ...this.e, subdialogo: null };
        this.decir(this.t("Listo. Escriba la cifra de ventas del año que usted considere.", "Listo. Escribe la cifra de ventas del año que consideres."));
        this.chips = this.chipsDe("ventasUltimoAnio");
        return;

      case "aceptar": {
        const r = this.guardar(a.campo, true, "boton");
        if (!r.ok) return this.preguntarSiguiente();
        return this.preguntarSiguiente(this.t("Gracias.", "Gracias."));
      }

      case "rechazar":
        this.decir(
          this.t(
            "Lo entiendo. Sin esta aceptación no es posible finalizar el registro. Puede leer el texto con calma y aceptar cuando quiera, o hablar con un asesor.",
            "Lo entiendo. Sin esta aceptación no es posible finalizar el registro. Puedes leer el texto con calma y aceptar cuando quieras, o hablar con un asesor.",
          ),
        );
        this.chips = [
          { etiqueta: "Acepto", texto: "Acepto", accion: { tipo: "aceptar", campo: a.campo }, variante: "primario" },
          chipAsesor(),
        ];
        return;

      case "ayudaCorreo":
        this.eventos.push({ tipo: "ayuda", campo: "correo" });
        this.e = { ...this.e, subdialogo: { tipo: "ayudaCorreo" } };
        this.decir(
          this.t(
            "No se preocupe. El formulario pide un correo, y hay tres caminos:\n• Crear uno gratis ahora (le explico cómo).\n• Usar el correo de un familiar de confianza que le avise.\n• Pedir ayuda a un asesor.",
            "No te preocupes. El formulario pide un correo, y hay tres caminos:\n• Crear uno gratis ahora (te explico cómo).\n• Usar el correo de un familiar de confianza que te avise.\n• Pedir ayuda a un asesor.",
          ),
        );
        this.chips = [
          { etiqueta: "¿Cómo creo un correo?", texto: "¿Cómo creo un correo?", accion: { tipo: "crearCorreo" }, variante: "primario" },
          {
            etiqueta: "Usaré el de un familiar",
            texto: "Usaré el correo de un familiar",
            accion: { tipo: "responder", campo: "correo", valor: "__continuar__" },
          },
          chipAsesor(),
        ];
        return;

      case "crearCorreo":
        this.e = { ...this.e, subdialogo: null };
        this.decir(this.t("Así se crea un correo gratis en Gmail:", "Así se crea un correo gratis en Gmail:"), { tipo: "pasosCorreo", pasos: PASOS_CORREO });
        this.chips = [{ etiqueta: "Abrir Gmail", texto: "", enlace: "https://accounts.google.com/signup" }, chipAsesor()];
        return;

      case "corregir": {
        if (a.campo && esCampo(a.campo)) {
          const campo = a.campo === "confirmacionDocumento" ? "numeroDocumento" : a.campo;
          this.eventos.push({ tipo: "correccion", campo });
          this.e = { ...this.e, enfoque: campo, subdialogo: null, fase: "recolectando" };
          if (campo === "aceptaPoliticaDatos" || campo === "aceptaTerminos") return this.pedirConsentimiento(campo);
          return this.preguntarSiguiente();
        }
        this.e = { ...this.e, subdialogo: { tipo: "elegirCorreccion" } };
        this.decir(this.t("¿Qué dato quiere corregir? También puede tocarlo en el formulario.", "¿Qué dato quieres corregir? También puedes tocarlo en el formulario."));
        this.chips = ORDEN.filter((c) => c !== "confirmacionDocumento" && c !== "aceptaPoliticaDatos" && c !== "aceptaTerminos").map((c) => ({
          etiqueta: CAMPO[c].etiqueta,
          texto: `Corregir: ${CAMPO[c].etiqueta}`,
          accion: { tipo: "corregir", campo: c },
        }));
        return;
      }

      case "revisar":
        if (!listoParaRevision(this.e)) {
          this.decir("Todavía faltan datos obligatorios.");
          return this.preguntarSiguiente();
        }
        return this.mostrarResumen();

      case "finalizar": {
        if (!listoParaRevision(this.e)) {
          this.decir("Todavía faltan datos obligatorios.");
          return this.preguntarSiguiente();
        }
        const ok = esquemaRegistroCompleto.safeParse(this.e.valores);
        if (!ok.success) {
          this.decir("Hay un dato que no pasó la validación. Revisémoslo.");
          const campo = ok.error.issues[0]?.path[0];
          if (esCampo(campo)) this.e = { ...borrar(this.e, campo), fase: "recolectando" };
          return this.preguntarSiguiente();
        }
        const radicado = generarRadicado(this.ctx.hoy);
        this.e = { ...this.e, fase: "encuesta", radicado, subdialogo: null };
        this.eventos.push({ tipo: "finalizado", radicado });
        this.decir(
          this.t(
            `¡Listo, ${this.e.valores.primerNombre}! Su registro quedó completo. Número de radicado: **${radicado}**.\n\nLas entidades aliadas podrán contactarle por ${valorLegible("medioContacto", this.e.valores)}. Recuerde: las ofertas no son en firme y solo puede aceptar una.`,
            `¡Listo, ${this.e.valores.primerNombre}! Tu registro quedó completo. Número de radicado: **${radicado}**.\n\nLas entidades aliadas podrán contactarte por ${valorLegible("medioContacto", this.e.valores)}. Recuerda: las ofertas no son en firme y solo puedes aceptar una.`,
          ),
          { tipo: "confirmacion", radicado },
        );
        this.decir(
          this.t("Una última pregunta, para mejorar: ¿cómo le pareció este asistente?", "Una última pregunta, para mejorar: ¿cómo te pareció este asistente?"),
          { tipo: "encuesta" },
        );
        this.chips = [];
        return;
      }

      case "abrirCampo":
        // Lo resuelve la interfaz (abre la lista en el formulario); el motor solo repite la pregunta.
        this.ui = { abrirCampo: a.campo };
        return this.preguntarSiguiente();

      case "asesor":
        return this.escalar(textoVisible ?? "boton");

      case "formularioManual":
        this.eventos.push({ tipo: "formulario_manual" });
        this.ui = { abrirFormulario: true };
        this.decir(
          this.t(
            "Listo. Abrí el formulario para que lo llene directamente; lo que ya respondió sigue ahí. Puede volver al chat cuando quiera.",
            "Listo. Abrí el formulario para que lo llenes directamente; lo que ya respondiste sigue ahí. Puedes volver al chat cuando quieras.",
          ),
        );
        this.chips = [];
        return;
    }
  }

  /** Mensaje corto después de guardar y siguiente pregunta. */
  trasGuardar(campos: CampoId[]) {
    const v = this.e.valores;
    let prefijo = "";
    if (campos.length > 2) prefijo = `¡Gracias${v.primerNombre ? `, ${v.primerNombre}` : ""}! Anoté ${campos.length} datos. Puede revisarlos en el formulario.`;
    else if (campos.includes("primerNombre") && v.primerNombre) prefijo = `Mucho gusto, ${v.primerNombre}.`;
    else if (campos.includes("actividadEconomica")) prefijo = `Anoté: ${valorLegible("actividadEconomica", v)}.`;
    else if (campos.includes("ventasUltimoAnio")) prefijo = `Anoté ventas por ${valorLegible("ventasUltimoAnio", v)}.`;
    else if (campos.includes("ciudad") && campos.length === 1) prefijo = `Anoté: ${tipoTitulo(nombreMunicipio(v.ciudad))}.`;
    if (this.e.tratamiento === "tu") prefijo = prefijo.replace("Puede revisarlos", "Puedes revisarlos");
    this.preguntarSiguiente(prefijo || undefined);
  }

  // ----- texto libre -----

  texto(crudo: string) {
    if (this.intentarDeterminista(crudo)) return;
    this.responderCampo(crudo.trim().slice(0, 1000));
  }

  /**
   * Lo que siempre se resuelve con reglas, con o sin IA: seguridad, asesor, formulario manual,
   * correcciones, subdiálogos (confirmar documento, elegir CIIU, confirmar ventas…), revisión
   * final y consentimientos. Devuelve false si el mensaje necesita comprensión de lenguaje.
   */
  intentarDeterminista(crudo: string): boolean {
    const texto = crudo.trim().slice(0, 1000);
    const t = normalizar(texto);

    // 1. Seguridad: nunca se guardan claves, códigos ni tarjetas; no se cambian las reglas.
    const prohibido = detectarDatoProhibido(texto);
    if (prohibido) {
      this.eventos.push({ tipo: "seguridad", motivo: "dato_prohibido" });
      this.decir(
        this.t(
          "⚠️ Por su seguridad, **no comparta claves, contraseñas, códigos que le lleguen por mensaje ni números de tarjeta**. No los necesito y no los guardé. Neocrédito nunca se los pedirá.",
          "⚠️ Por tu seguridad, **no compartas claves, contraseñas, códigos que te lleguen por mensaje ni números de tarjeta**. No los necesito y no los guardé. Neocrédito nunca te los pedirá.",
        ),
      );
      this.preguntarSiguiente();
      return true;
    }
    if (detectarInyeccion(texto)) {
      this.eventos.push({ tipo: "seguridad", motivo: "inyeccion" });
      this.decir(this.t("Solo puedo ayudarle con su registro en Neocrédito, y mis reglas no se pueden cambiar desde el chat.", "Solo puedo ayudarte con tu registro en Neocrédito, y mis reglas no se pueden cambiar desde el chat."));
      this.preguntarSiguiente(this.t("Sigamos.", "Sigamos."));
      return true;
    }

    // 2. Intenciones que funcionan en cualquier momento.
    if (/\b(asesor|asesora|humano|persona real|hablar con alguien|agente|operador|hablar con una persona)\b/.test(t)) {
      this.escalar("texto");
      return true;
    }
    if (/\b(formulario manual|llenar(lo)? yo|prefiero el formulario|llenarlo solo|llenarlo sola|sin chat|formulario normal)\b/.test(t)) {
      this.accion({ tipo: "formularioManual" });
      return true;
    }
    const correccion = t.match(/^(?:quiero |necesito |me gustaria )?(corregir|cambiar|editar|modificar|me equivoque en|me equivoque|arreglar)\b(.*)$/);
    if (correccion) {
      this.accion({ tipo: "corregir", campo: campoMencionado(correccion[2]) ?? undefined });
      return true;
    }
    if (/\bno tengo (correo|email|e mail|mail)\b/.test(t) && !texto.includes("@")) {
      this.accion({ tipo: "ayudaCorreo" });
      return true;
    }

    // 3. Subdiálogo activo.
    if (this.e.subdialogo && this.subdialogo(texto)) return true;
    this.e = { ...this.e, subdialogo: null };

    // 4. Registro ya enviado.
    if (this.e.fase === "encuesta" || this.e.fase === "enviado" || this.e.fase === "fin") {
      if (this.responderPregunta(texto, false)) return true;
      this.decir(
        this.t(
          `Su registro ya quedó listo (radicado **${this.e.radicado}**). Si tiene otra pregunta, escríbala.`,
          `Tu registro ya quedó listo (radicado **${this.e.radicado}**). Si tienes otra pregunta, escríbela.`,
        ),
      );
      this.chips = [];
      return true;
    }

    // 5. Revisión final.
    if (this.e.fase === "revision") {
      const si = interpretarSiNo(texto);
      if (si === true || /\bfinaliz/.test(t)) {
        this.accion({ tipo: "finalizar" });
        return true;
      }
      if (si === false) {
        this.accion({ tipo: "corregir" });
        return true;
      }
    }

    // 6. Consentimientos: solo con una aceptación explícita de la persona.
    const c = campoActual(this.e);
    if (c === "aceptaPoliticaDatos" || c === "aceptaTerminos") {
      if (/^(si |)acepto\b|^(si|de acuerdo|ok|listo|dale)$/.test(t)) {
        this.accion({ tipo: "aceptar", campo: c });
        return true;
      }
      if (/^no\b/.test(t)) {
        this.accion({ tipo: "rechazar", campo: c });
        return true;
      }
    }
    return false;
  }

  /** Maneja la respuesta dentro de un subdiálogo. Devuelve false si no aplica. */
  subdialogo(texto: string): boolean {
    const sub = this.e.subdialogo!;
    const t = normalizar(texto);
    const si = interpretarSiNo(texto);
    switch (sub.tipo) {
      case "confirmarDocumento": {
        if (si !== null && soloDigitos(texto).length < 5) {
          this.accion({ tipo: "confirmarDocumento", correcto: si });
          return true;
        }
        const digitos = soloDigitos(texto);
        if (digitos.length >= 5) {
          this.e = { ...this.e, subdialogo: null };
          if (digitos === this.e.valores.numeroDocumento) {
            this.accion({ tipo: "confirmarDocumento", correcto: true });
            return true;
          }
          const r = this.guardar("numeroDocumento", texto, "respuesta");
          if (!r.ok) {
            this.decir(r.error);
            this.chips = [];
            return true;
          }
          this.preguntarSiguiente(this.t("Cambié el número.", "Cambié el número."));
          return true;
        }
        return false;
      }
      case "confirmarNombreApellido":
        if (si === null) return false;
        this.accion({ tipo: "confirmarNombreApellido", correcto: si });
        return true;
      case "elegirOpcion": {
        const n = Number(t.match(/^(\d)\b/)?.[1] ?? NaN);
        const porNumero = Number.isInteger(n) && n >= 1 && n <= sub.opciones.length ? sub.opciones[n - 1] : undefined;
        const porNombre = sub.opciones.find((o) => normalizar(o.etiqueta).startsWith(t) || t.includes(normalizar(o.etiqueta).split(" (")[0]));
        const elegida = porNumero ?? porNombre;
        if (!elegida) return false;
        this.e = { ...this.e, subdialogo: null };
        this.accion({ tipo: "responder", campo: sub.campo, valor: elegida.valor });
        return true;
      }
      case "elegirCiiu": {
        const ordinales: Record<string, number> = { "1": 1, primera: 1, primero: 1, "2": 2, segunda: 2, segundo: 2, "3": 3, tercera: 3, tercero: 3 };
        const ord = t.match(/\b(1|2|3|primera|primero|segunda|segundo|tercera|tercero)\b/)?.[1];
        if (ord && t.split(" ").length <= 4) {
          const o = sub.opciones[ordinales[ord] - 1];
          if (o) {
            this.accion({ tipo: "elegirCiiu", codigo: o.codigo });
            return true;
          }
        }
        const codigo = texto.match(/\b(\d{4})\b/)?.[1];
        if (codigo) {
          this.accion({ tipo: "elegirCiiu", codigo });
          return true;
        }
        const porNombre = sub.opciones.find((o) => normalizar(o.corto) === t || t.includes(normalizar(o.corto)));
        if (porNombre) {
          this.accion({ tipo: "elegirCiiu", codigo: porNombre.codigo });
          return true;
        }
        if (/\b(ninguna|ninguno|otra|otro|no es|no se parece)\b/.test(t)) {
          this.accion({ tipo: "ningunCiiu" });
          return true;
        }
        if (parecePregunta(texto)) return false;
        // Nueva descripción del negocio.
        if (!this.sugerirActividad(texto)) {
          this.decir(this.t("No encontré una actividad parecida. Descríbala con otras palabras, por favor.", "No encontré una actividad parecida. Descríbela con otras palabras, por favor."));
          this.chips = [chipAsesor()];
        }
        return true;
      }
      case "estimarVentas": {
        if (sub.paso === "diaria") {
          const m = interpretarMonto(texto);
          if (!m || m.valor < 500) {
            this.decir(this.t("No entendí la cifra. Escríbala en pesos, por ejemplo «150 mil» o «150.000».", "No entendí la cifra. Escríbela en pesos, por ejemplo «150 mil» o «150.000»."));
            this.chips = [];
            return true;
          }
          if (m.periodo === "semana" || m.periodo === "mes" || m.periodo === "quincena") return this.proponerVentas(m.valor, m.periodo), true;
          if (m.periodo === "anio") {
            this.accion({ tipo: "usarVentas", valor: m.valor });
            return true;
          }
          this.e = { ...this.e, subdialogo: { tipo: "estimarVentas", paso: "dias", ventaDiaria: m.valor } };
          this.decir(this.t("¿Y cuántos días a la semana trabaja?", "¿Y cuántos días a la semana trabajas?"));
          this.chips = ["5", "6", "7"].map((d) => ({ etiqueta: `${d} días`, texto: `${d} días` }));
          return true;
        }
        const diasTexto = /\btodos los dias\b|\btoda la semana\b/.test(t)
          ? 7
          : /\blunes a viernes\b/.test(t)
            ? 5
            : /\blunes a sabado\b/.test(t)
              ? 6
              : Number(soloDigitos(texto).slice(0, 1));
        if (!diasTexto || diasTexto > 7) {
          this.decir("Dígame un número de 1 a 7.");
          this.chips = ["5", "6", "7"].map((d) => ({ etiqueta: `${d} días`, texto: `${d} días` }));
          return true;
        }
        const est = estimarVentasAnuales({ ventaDiaria: sub.ventaDiaria, diasPorSemana: diasTexto });
        if (!est) return false;
        this.proponerVentasCalculadas(est.total, est.pasos);
        return true;
      }
      case "confirmarVentas": {
        if (si === true) {
          this.accion({ tipo: "usarVentas", valor: sub.propuesta });
          return true;
        }
        if (si === false && !/\d/.test(texto)) {
          this.accion({ tipo: "rechazarVentas" });
          return true;
        }
        return false;
      }
      case "ayudaCorreo":
        if (/\b(como|crear|creo|hacer|abrir)\b/.test(t) && !texto.includes("@")) {
          this.accion({ tipo: "crearCorreo" });
          return true;
        }
        return false;
      case "elegirCorreccion": {
        const campo = campoMencionado(texto);
        if (!campo) return false;
        this.accion({ tipo: "corregir", campo });
        return true;
      }
    }
  }

  proponerVentas(valor: number, periodo: Periodo) {
    const meses = { semana: "× 52 semanas", quincena: "× 24 quincenas", mes: "× 12 meses", dia: "", anio: "" }[periodo];
    const factor = { semana: 52, quincena: 24, mes: 12, dia: 1, anio: 1 }[periodo];
    const total = Math.round(valor * factor);
    const etiquetaPeriodo = { semana: "a la semana", quincena: "a la quincena", mes: "al mes", dia: "al día", anio: "al año" }[periodo];
    this.proponerVentasCalculadas(total, [`${formatoCOP(valor)} ${etiquetaPeriodo} ${meses} = ${formatoCOP(total)} al año`]);
  }

  proponerVentasCalculadas(total: number, pasos: string[]) {
    this.e = { ...this.e, subdialogo: { tipo: "confirmarVentas", propuesta: total, pasos } };
    this.decir(
      this.t(
        `Según la cuenta, en el año vendió cerca de **${formatoCOP(total)}**. ¿Uso esa cifra?`,
        `Según la cuenta, en el año vendiste cerca de **${formatoCOP(total)}**. ¿Uso esa cifra?`,
      ),
      { tipo: "calculoVentas", pasos, total },
    );
    this.chips = [
      { etiqueta: `Sí, usar ${formatoCOP(total)}`, texto: `Sí, usar ${formatoCOP(total)}`, accion: { tipo: "usarVentas", valor: total }, variante: "primario" },
      { etiqueta: "No, la cifra es otra", texto: "No, la cifra es otra", accion: { tipo: "rechazarVentas" } },
    ];
  }

  /** Responde preguntas frecuentes o explica un campo. Devuelve true si respondió. */
  responderPregunta(texto: string, reanudar = true): boolean {
    if (!parecePregunta(texto)) return false;
    const t = normalizar(texto);
    const actual = campoActual(this.e);
    const mencionado = campoMencionado(texto);
    // "¿para qué piden el género?", "¿qué pongo aquí?"
    if (/\b(para que|por que|porque|que significa|que pongo|que es eso|no entiendo|como asi)\b/.test(t) && (mencionado ?? actual)) {
      const campo = mencionado ?? actual;
      if (campo && (mencionado || /\b(que pongo|que es eso|no entiendo|como asi|para que|por que)\b/.test(t))) {
        this.explicar(campo);
        return true;
      }
    }
    const faq = buscarFaq(texto, this.ctx.faqExtra);
    if (faq) {
      this.eventos.push({ tipo: "pregunta_faq", id: faq.entrada.id });
      this.decir(faq.entrada.respuesta);
      if (reanudar) this.preguntarSiguiente(this.t("Sigamos con su registro.", "Sigamos con tu registro."));
      else this.chips = [];
      return true;
    }
    if (mencionado && reanudar) {
      this.explicar(mencionado);
      return true;
    }
    // Sin respuesta: va a la bandeja para que un humano la revise.
    this.eventos.push({ tipo: "pregunta_sin_respuesta", texto });
    this.decir(
      this.t(
        "Todavía no tengo una buena respuesta para eso. Anoté su pregunta (sin sus datos personales) para que el equipo la revise y yo aprenda. Si la necesita ya, un asesor le puede ayudar.",
        "Todavía no tengo una buena respuesta para eso. Anoté tu pregunta (sin tus datos personales) para que el equipo la revise y yo aprenda. Si la necesitas ya, un asesor te puede ayudar.",
      ),
    );
    if (reanudar) {
      this.preguntarSiguiente();
      this.chips = [...(this.chips ?? []), chipAsesor()];
    } else this.chips = [chipAsesor()];
    return true;
  }

  responderCampo(texto: string) {
    const c = campoActual(this.e);
    const t = normalizar(texto);
    if (!c) return this.preguntarSiguiente();

    // Las preguntas se responden; no se extraen datos de ellas.
    if (parecePregunta(texto) && (t.split(" ").length > 3 || /\bque es\b/.test(t)) && this.responderPregunta(texto)) return;

    // "No sé" en los campos difíciles abre la ayuda específica.
    if (/^(no se|no sabria|no estoy seguro|no estoy segura|ni idea|no me acuerdo|no recuerdo)\b/.test(t)) {
      if (c === "ventasUltimoAnio") return this.accion({ tipo: "estimarVentas" });
      if (c === "actividadEconomica") return this.accion({ tipo: "ningunCiiu" });
      if (!CAMPO[c].obligatorio) return this.accion({ tipo: "omitir", campo: c });
      return this.explicar(c);
    }
    if (/^(prefiero no (decir|responder|decirlo|contestar)|omitir|saltar|siguiente|paso)$/.test(t) && !CAMPO[c].obligatorio)
      return this.accion({ tipo: "omitir", campo: c });
    if (c === "aceptaPoliticaDatos" || c === "aceptaTerminos") {
      if (this.responderPregunta(texto)) return;
      return this.pedirConsentimiento(c);
    }

    const ext = extraerCampos(texto);
    const extraidos = Object.entries(ext.campos).filter(([k]) => esCampo(k)) as [CampoId, string][];
    if (ext.descripcionActividad && c !== "actividadEconomica") this.e = { ...this.e, pistaActividad: ext.descripcionActividad };

    // Varios datos en un solo mensaje.
    if (extraidos.length >= 2 || (extraidos.length === 1 && extraidos[0][0] !== c && !this.respuestaDirectaValida(c, texto))) {
      const guardados: CampoId[] = [];
      const errores: string[] = [];
      for (const campo of ORDEN) {
        const valor = ext.campos[campo];
        if (valor === undefined || campo === "confirmacionDocumento" || campo === "aceptaPoliticaDatos" || campo === "aceptaTerminos") continue;
        const r = this.guardar(campo, valor, "extraccion");
        if (r.ok) guardados.push(campo);
        else errores.push(`${CAMPO[campo].etiqueta}: ${r.error}`);
      }
      if (ext.ventasConPeriodo && this.e.valores.ventasUltimoAnio === undefined) {
        const m = interpretarMonto(ext.ventasConPeriodo);
        if (m?.periodo && m.periodo !== "anio" && campoActual(this.e) === "ventasUltimoAnio") {
          this.proponerVentas(m.valor, m.periodo);
          return;
        }
      }
      if (guardados.length) {
        if (errores.length) this.decir(`Hay ${errores.length === 1 ? "un dato" : "datos"} por revisar:\n• ${errores.join("\n• ")}`);
        return this.trasGuardar(guardados);
      }
    }

    // Caso especial: nombre y apellido juntos cuando se pregunta el nombre.
    if (c === "primerNombre" && !this.e.valores.primerApellido) {
      const palabras = texto.replace(/^(me llamo|mi nombre es|soy)\s+/i, "").trim().split(/\s+/);
      if (palabras.length === 2 && palabras.every((p) => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}$/.test(p))) {
        const [nombre, apellido] = palabras.map(tipoTitulo);
        this.e = { ...this.e, subdialogo: { tipo: "confirmarNombreApellido", nombre, apellido } };
        this.decir(
          this.t(
            `¿Su primer nombre es **${nombre}** y su primer apellido **${apellido}**?`,
            `¿Tu primer nombre es **${nombre}** y tu primer apellido **${apellido}**?`,
          ),
        );
        this.chips = [
          { etiqueta: "Sí, así es", texto: "Sí, así es", accion: { tipo: "confirmarNombreApellido", correcto: true }, variante: "primario" },
          { etiqueta: `No, «${nombre} ${apellido}» es mi nombre`, texto: `«${nombre} ${apellido}» es mi primer nombre`, accion: { tipo: "confirmarNombreApellido", correcto: false } },
        ];
        return;
      }
    }

    // Actividad económica: descripción libre → sugerencias para elegir.
    if (c === "actividadEconomica") {
      const r = interpretarCampo(c, texto, this.e.valores);
      if (r.ok) {
        this.guardar(c, texto, "respuesta");
        return this.trasGuardar([c]);
      }
      if (this.responderPregunta(texto)) return;
      // Se busca con el texto completo: los verbos importan ("arreglo" vs "vendo").
      if (this.sugerirActividad(texto)) return;
      this.eventos.push({ tipo: "error_validacion", campo: c, codigo: "no_encontrado" });
      this.e = sumarIntento(this.e, c);
      return this.accion({ tipo: "ningunCiiu" });
    }

    // Ventas: entiende "2 millones al mes" y pide confirmar el cálculo anual.
    if (c === "ventasUltimoAnio") {
      const r = interpretarCampo(c, texto, this.e.valores);
      if (!r.ok && r.codigo === "periodo" && r.periodo) {
        const m = interpretarMonto(texto)!;
        return this.proponerVentas(m.valor, r.periodo);
      }
      if (r.ok && typeof r.valor === "number" && (r.valor < 1_000_000 || r.valor > 5_000_000_000)) {
        // Cifra poco usual: se confirma, nunca se corrige sola.
        this.e = { ...this.e, subdialogo: { tipo: "confirmarVentas", propuesta: r.valor, pasos: [] } };
        this.decir(
          r.valor < 1_000_000
            ? `¿Seguro? **${formatoCOP(r.valor)}** en todo el año es poco. Si es lo que vende al mes, el año serían ${formatoCOP(r.valor * 12)}.`
            : `Quiero confirmar: **${formatoCOP(r.valor)}** en ventas del año. ¿Es correcto?`,
        );
        this.chips = [
          { etiqueta: `Sí, ${formatoCOP(r.valor)} al año`, texto: `Sí, ${formatoCOP(r.valor)} al año`, accion: { tipo: "usarVentas", valor: r.valor } },
          ...(r.valor < 1_000_000
            ? [{ etiqueta: `Es al mes: usar ${formatoCOP(r.valor * 12)}`, texto: `Es al mes: usar ${formatoCOP(r.valor * 12)}`, accion: { tipo: "usarVentas", valor: r.valor * 12 } as Accion }]
            : [{ etiqueta: "No, corregir", texto: "No, corregir", accion: { tipo: "rechazarVentas" } as Accion }]),
        ];
        return;
      }
    }

    const r = this.guardar(c, texto, "respuesta");
    if (r.ok) return this.trasGuardar([c]);

    // No era una respuesta válida: ¿era una pregunta?
    if (this.responderPregunta(texto)) {
      // La respuesta fallida no cuenta como intento si era una pregunta.
      this.e = { ...this.e, intentos: { ...this.e.intentos, [c]: Math.max(0, (this.e.intentos[c] ?? 1) - 1) } };
      return;
    }
    // Campos sensibles opcionales: nunca se insiste.
    if (CAMPO[c].sensible && !CAMPO[c].obligatorio) {
      this.e = omitir(this.e, c);
      this.eventos.push({ tipo: "campo_omitido", campo: c });
      return this.preguntarSiguiente(this.t("No hay problema, lo dejamos sin responder.", "No hay problema, lo dejamos sin responder."));
    }
    const resultado = interpretarCampo(c, texto, this.e.valores);
    const opciones = !resultado.ok ? resultado.opciones : undefined;
    const intentos = this.e.intentos[c] ?? 0;
    let mensaje = r.error;
    if (intentos >= 2 && !opciones?.length) mensaje += `\n\n${CAMPO[c].ayuda}${CAMPO[c].ejemplo ? ` Ejemplo: ${CAMPO[c].ejemplo}.` : ""}`;
    this.decir(mensaje);
    if (opciones?.length && !resultado.ok && resultado.codigo === "ambiguo") {
      this.e = { ...this.e, subdialogo: { tipo: "elegirOpcion", campo: c === "departamento" ? "ciudad" : c, opciones } };
      this.chips = chipsSugeridas(c === "departamento" ? "ciudad" : c, opciones);
    } else if (opciones?.length) {
      this.chips = chipsSugeridas(c, opciones);
    } else {
      this.chips = this.chipsDe(c);
    }
    if (intentos >= 3) this.chips = [...this.chips, chipAsesor(), { etiqueta: "Llenar el formulario yo", texto: "Prefiero llenar el formulario yo", accion: { tipo: "formularioManual" } }];
  }

  /** Botones del subdiálogo activo (modo IA: la IA redacta el texto, el código pone los botones). */
  chipsDeSubdialogo(): boolean {
    const sub = this.e.subdialogo;
    if (!sub) return false;
    switch (sub.tipo) {
      case "elegirCiiu":
        this.chips = [
          ...sub.opciones.map((o, i) => ({ etiqueta: `${i + 1}. ${o.corto}`, texto: `${o.codigo} - ${o.corto}`, accion: { tipo: "elegirCiiu", codigo: o.codigo } as Accion })),
          { etiqueta: "Ninguna se parece", texto: "Ninguna se parece", accion: { tipo: "ningunCiiu" } },
        ];
        return true;
      case "confirmarVentas":
        this.chips = [
          { etiqueta: `Sí, usar ${formatoCOP(sub.propuesta)}`, texto: `Sí, usar ${formatoCOP(sub.propuesta)}`, accion: { tipo: "usarVentas", valor: sub.propuesta }, variante: "primario" },
          { etiqueta: "No, la cifra es otra", texto: "No, la cifra es otra", accion: { tipo: "rechazarVentas" } },
        ];
        return true;
      case "elegirOpcion":
        this.chips = chipsSugeridas(sub.campo, sub.opciones);
        return true;
      default:
        return false;
    }
  }

  respuestaDirectaValida(c: CampoId, texto: string) {
    return interpretarCampo(c, texto, this.e.valores).ok;
  }
}

/**
 * Procesa un turno de la conversación. Función pura: recibe el estado y la entrada y
 * devuelve el nuevo estado, los mensajes del asistente, los botones y los eventos de analítica.
 */
export function procesarTurno(estado: EstadoConversacion, entrada: Entrada, ctx: ContextoMotor = {}): Turno {
  const turno = new Turnero(estado, ctx);
  if (entrada.accion?.tipo === "iniciar") {
    turno.accion(entrada.accion);
    return turno.resultado();
  }
  if (entrada.texto?.trim() || entrada.accion) {
    turno.e = { ...turno.e, mensajesUsuario: turno.e.mensajesUsuario + 1 };
    if (turno.e.mensajesUsuario > CONFIG.maxMensajesSesion) {
      turno.eventos.push({ tipo: "limite_mensajes" });
      turno.decir(
        "Llegamos al límite de mensajes de esta conversación. Lo que ya llenó está guardado: puede terminar en el formulario o hablar con un asesor.",
      );
      turno.chips = [chipAsesor(), { etiqueta: "Abrir el formulario", texto: "Abrir el formulario", accion: { tipo: "formularioManual" } }];
      return turno.resultado();
    }
  }
  if (entrada.accion) turno.accion(entrada.accion, entrada.texto);
  else if (entrada.texto?.trim()) turno.texto(entrada.texto);
  else turno.preguntarSiguiente();
  return turno.resultado();
}

/**
 * Para el modo con IA: resuelve con reglas todo lo que no requiere comprensión de lenguaje.
 * Devuelve `turno` si ya quedó resuelto; si no, `estado` (con el contador actualizado) para la IA.
 */
export function resolverSinIA(
  estado: EstadoConversacion,
  entrada: Entrada,
  ctx: ContextoMotor = {},
): { turno: Turno } | { estado: EstadoConversacion } {
  if (entrada.accion || !entrada.texto?.trim()) return { turno: procesarTurno(estado, entrada, ctx) };
  const e = { ...estado, mensajesUsuario: estado.mensajesUsuario + 1 };
  if (e.mensajesUsuario > CONFIG.maxMensajesSesion) return { turno: procesarTurno(estado, entrada, ctx) };
  const turno = new Turnero(e, ctx);
  if (turno.intentarDeterminista(entrada.texto)) return { turno: turno.resultado() };
  return { estado: e };
}

/** Botones y bloques que corresponden al estado actual (para el modo IA, que redacta el texto). */
export function interfazPara(estado: EstadoConversacion, ctx: ContextoMotor = {}) {
  const turno = new Turnero(estado, ctx);
  if (!turno.chipsDeSubdialogo()) turno.preguntarSiguiente();
  const r = turno.resultado();
  return { estado: r.estado, chips: r.chips, bloque: r.mensajes.find((m) => m.bloque)?.bloque, pregunta: r.mensajes.at(-1)?.texto ?? "" };
}

