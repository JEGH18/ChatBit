// Definición de los campos del "Formulario de registro persona natural" de Neocrédito,
// en el mismo orden y con las mismas etiquetas del formulario real.
import { CONFIG, type Tratamiento } from "@/lib/config";

export type CampoId =
  | "primerNombre"
  | "primerApellido"
  | "tipoDocumento"
  | "numeroDocumento"
  | "confirmacionDocumento"
  | "genero"
  | "celular"
  | "correo"
  | "tieneRut"
  | "comoSeEntero"
  | "departamento"
  | "ciudad"
  | "medioContacto"
  | "perteneceMinoria"
  | "actividadEconomica"
  | "anioVentas"
  | "ventasUltimoAnio"
  | "aceptaPoliticaDatos"
  | "aceptaTerminos";

export type TipoControl = "texto" | "email" | "select" | "radio" | "numero" | "checkbox";

export type Paso = 1 | 2;

export type DefinicionCampo = {
  id: CampoId;
  etiqueta: string;
  paso: Paso;
  obligatorio: boolean;
  control: TipoControl;
  /** Dato sensible: se explica con neutralidad, se respeta "prefiero no decir" y nunca se insiste. */
  sensible?: boolean;
  /** Pregunta del asistente en trato de usted / tú. */
  pregunta: Record<Tratamiento, string>;
  /** Explicación en lenguaje sencillo (una o dos frases). */
  ayuda: string;
  ejemplo?: string;
};

export const PASOS: Record<Paso, { titulo: string; subtitulo: string }> = {
  1: { titulo: "Información general", subtitulo: "Datos generales" },
  2: { titulo: "Información financiera", subtitulo: "Información financiera" },
};

export const CAMPOS: DefinicionCampo[] = [
  {
    id: "primerNombre",
    etiqueta: "Primer nombre",
    paso: 1,
    obligatorio: true,
    control: "texto",
    pregunta: { usted: "¿Cuál es su primer nombre?", tu: "¿Cuál es tu primer nombre?" },
    ayuda: "Es el primer nombre que aparece en su documento de identidad. Si tiene dos nombres (por ejemplo «María José»), escriba solo el primero: «María».",
    ejemplo: "María",
  },
  {
    id: "primerApellido",
    etiqueta: "Primer apellido",
    paso: 1,
    obligatorio: true,
    control: "texto",
    pregunta: { usted: "¿Cuál es su primer apellido?", tu: "¿Cuál es tu primer apellido?" },
    ayuda: "Es el primer apellido que aparece en su documento de identidad. Si tiene dos apellidos, escriba solo el primero.",
    ejemplo: "Rincón",
  },
  {
    id: "tipoDocumento",
    etiqueta: "Tipo de documento",
    paso: 1,
    obligatorio: true,
    control: "select",
    pregunta: { usted: "¿Qué documento de identidad tiene?", tu: "¿Qué documento de identidad tienes?" },
    ayuda: "La mayoría de colombianos tiene cédula de ciudadanía. Si es extranjero, puede ser cédula de extranjería, pasaporte o PPT.",
  },
  {
    id: "numeroDocumento",
    etiqueta: "Número de documento",
    paso: 1,
    obligatorio: true,
    control: "texto",
    pregunta: {
      usted: "Escriba o diga su número de documento, sin puntos.",
      tu: "Escribe o di tu número de documento, sin puntos.",
    },
    ayuda: "Es el número que aparece en su documento. Se escribe solo con números, sin puntos ni espacios.",
    ejemplo: "1103679690",
  },
  {
    id: "confirmacionDocumento",
    etiqueta: "Confirma tu número de documento",
    paso: 1,
    obligatorio: true,
    control: "texto",
    pregunta: { usted: "¿El número de documento es correcto?", tu: "¿El número de documento es correcto?" },
    ayuda: "Leemos el número en grupos para evitar errores de digitación.",
  },
  {
    id: "genero",
    etiqueta: "Género",
    paso: 1,
    obligatorio: true,
    control: "select",
    sensible: true,
    pregunta: { usted: "¿Con qué género se identifica?", tu: "¿Con qué género te identificas?" },
    ayuda:
      "El formulario lo pide con fines estadísticos. No cambia la evaluación ni el trato que recibe. Puede elegir “Prefiero no decir”.",
  },
  {
    id: "celular",
    etiqueta: "Número de celular",
    paso: 1,
    obligatorio: true,
    control: "texto",
    pregunta: { usted: "¿Cuál es su número de celular?", tu: "¿Cuál es tu número de celular?" },
    ayuda: "Son 10 números y empieza por 3. Por ahí le contactarán las entidades.",
    ejemplo: "3104567890",
  },
  {
    id: "correo",
    etiqueta: "Correo electrónico",
    paso: 1,
    obligatorio: true,
    control: "email",
    pregunta: { usted: "¿Cuál es su correo electrónico?", tu: "¿Cuál es tu correo electrónico?" },
    ayuda: "Es la dirección donde recibe mensajes, por ejemplo nombre@gmail.com. Si no tiene, le ayudo.",
    ejemplo: "nombre@gmail.com",
  },
  {
    id: "tieneRut",
    etiqueta: "¿Tiene RUT?",
    paso: 1,
    obligatorio: false,
    control: "radio",
    pregunta: { usted: "¿Tiene RUT?", tu: "¿Tienes RUT?" },
    ayuda: "El RUT es el registro de la DIAN que identifica a quien tiene un negocio; no es obligatorio para registrarse aquí.",
  },
  {
    id: "comoSeEntero",
    etiqueta: "¿Cómo te enteraste de neocrédito?",
    paso: 1,
    obligatorio: false,
    control: "select",
    pregunta: { usted: "¿Cómo se enteró de Neocrédito?", tu: "¿Cómo te enteraste de Neocrédito?" },
    ayuda: "Nos ayuda a saber por dónde llega la gente. Es opcional.",
  },
  {
    id: "departamento",
    etiqueta: "Departamento donde está tu negocio",
    paso: 2,
    obligatorio: true,
    control: "select",
    pregunta: { usted: "¿En qué departamento está su negocio?", tu: "¿En qué departamento está tu negocio?" },
    ayuda: "Es el departamento donde funciona su negocio, aunque usted viva en otro lugar.",
  },
  {
    id: "ciudad",
    etiqueta: "Ciudad donde está tu negocio",
    paso: 2,
    obligatorio: true,
    control: "select",
    pregunta: { usted: "¿En qué ciudad o municipio está su negocio?", tu: "¿En qué ciudad o municipio está tu negocio?" },
    ayuda: "Es el municipio donde funciona su negocio.",
  },
  {
    id: "medioContacto",
    etiqueta: "¿Cómo deseas ser contactado?",
    paso: 2,
    obligatorio: true,
    control: "select",
    pregunta: { usted: "¿Cómo prefiere que le contacten?", tu: "¿Cómo prefieres que te contacten?" },
    ayuda: "Es el medio que usarán las entidades para hablarle de las ofertas.",
  },
  {
    id: "perteneceMinoria",
    etiqueta: "¿Pertenece a alguna minoría?",
    paso: 2,
    obligatorio: false,
    control: "radio",
    sensible: true,
    pregunta: {
      usted: "Esta pregunta es opcional: ¿pertenece a alguna minoría?",
      tu: "Esta pregunta es opcional: ¿perteneces a alguna minoría?",
    },
    ayuda:
      "Se pregunta para medir si los programas llegan a grupos como comunidades étnicas o víctimas del conflicto. No afecta la evaluación y puede no responder.",
  },
  {
    id: "actividadEconomica",
    etiqueta: "Actividad económica",
    paso: 2,
    obligatorio: true,
    control: "select",
    pregunta: {
      usted: "Cuénteme con sus palabras: ¿a qué se dedica su negocio?",
      tu: "Cuéntame con tus palabras: ¿a qué se dedica tu negocio?",
    },
    ayuda:
      "Es el código CIIU que describe su negocio. Si no lo conoce, cuénteme qué hace (por ejemplo “vendo empanadas”) y le propongo las opciones.",
  },
  {
    id: "anioVentas",
    etiqueta: "Año de ventas",
    paso: 2,
    obligatorio: true,
    control: "select",
    pregunta: {
      usted: "¿De qué año son las ventas que va a reportar?",
      tu: "¿De qué año son las ventas que vas a reportar?",
    },
    ayuda: "Normalmente es el año pasado completo.",
  },
  {
    id: "ventasUltimoAnio",
    etiqueta: "Ventas del último año",
    paso: 2,
    obligatorio: true,
    control: "numero",
    pregunta: {
      usted: "¿Cuánto vendió su negocio en todo ese año, más o menos? Si no sabe, le ayudo a calcularlo.",
      tu: "¿Cuánto vendió tu negocio en todo ese año, más o menos? Si no sabes, te ayudo a calcularlo.",
    },
    ayuda: "Es el total de lo que entró por ventas en el año, antes de descontar gastos. Una cifra aproximada sirve.",
    ejemplo: "24.000.000",
  },
  {
    id: "aceptaPoliticaDatos",
    etiqueta: "Al seleccionar, aceptas nuestra política de tratamiento de datos personales.",
    paso: 2,
    obligatorio: true,
    control: "checkbox",
    pregunta: {
      usted: "Para terminar, necesito que lea y acepte la política de tratamiento de datos personales.",
      tu: "Para terminar, necesito que leas y aceptes la política de tratamiento de datos personales.",
    },
    ayuda: "Explica cómo se guardan y usan sus datos personales, según la Ley 1581 de 2012.",
  },
  {
    id: "aceptaTerminos",
    etiqueta: "Al seleccionar, aceptas nuestros términos y condiciones.",
    paso: 2,
    obligatorio: true,
    control: "checkbox",
    pregunta: {
      usted: "Y los términos y condiciones de Neocrédito.",
      tu: "Y los términos y condiciones de Neocrédito.",
    },
    ayuda: "Son las reglas de uso de la plataforma.",
  },
];

export const CAMPO: Record<CampoId, DefinicionCampo> = Object.fromEntries(CAMPOS.map((c) => [c.id, c])) as Record<
  CampoId,
  DefinicionCampo
>;

export const ORDEN: CampoId[] = CAMPOS.map((c) => c.id);

/** Campos visibles en la vista previa (la confirmación se muestra junto al número). */
export const CAMPOS_VISIBLES = CAMPOS;

export const CONSENTIMIENTOS: CampoId[] = ["aceptaPoliticaDatos", "aceptaTerminos"];

/** Campos que la IA nunca puede llenar: requieren una acción explícita de la persona. */
export const CAMPOS_SOLO_ACCION_EXPLICITA: CampoId[] = ["confirmacionDocumento", "aceptaPoliticaDatos", "aceptaTerminos"];

export function preguntaDe(id: CampoId, trato: Tratamiento = CONFIG.tratamiento) {
  return CAMPO[id].pregunta[trato];
}

export function esCampo(id: unknown): id is CampoId {
  return typeof id === "string" && id in CAMPO;
}
