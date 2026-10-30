// Tipos compartidos entre el motor, la API y la interfaz.
import type { CampoId } from "@/lib/form/campos";
import type { SugerenciaCiiu } from "@/lib/form/ciiu";
import type { CodigoError } from "@/lib/form/validadores";
import type { EstadoConversacion } from "./estado";

export type CanalEntrada = "texto" | "voz" | "boton" | "formulario";

/** Acciones estructuradas: botones de respuesta rápida, tarjetas y controles de la interfaz. */
export type Accion =
  | { tipo: "iniciar" }
  | { tipo: "responder"; campo: CampoId; valor: string }
  | { tipo: "omitir"; campo: CampoId }
  | { tipo: "explicar"; campo: CampoId }
  | { tipo: "confirmarDocumento"; correcto: boolean }
  | { tipo: "confirmarNombreApellido"; correcto: boolean }
  | { tipo: "elegirCiiu"; codigo: string }
  | { tipo: "ningunCiiu" }
  | { tipo: "estimarVentas" }
  | { tipo: "usarVentas"; valor: number }
  | { tipo: "rechazarVentas" }
  | { tipo: "aceptar"; campo: "aceptaPoliticaDatos" | "aceptaTerminos" }
  | { tipo: "rechazar"; campo: "aceptaPoliticaDatos" | "aceptaTerminos" }
  | { tipo: "ayudaCorreo" }
  | { tipo: "crearCorreo" }
  | { tipo: "corregir"; campo?: CampoId }
  | { tipo: "revisar" }
  | { tipo: "finalizar" }
  | { tipo: "asesor" }
  | { tipo: "abrirCampo"; campo: CampoId }
  | { tipo: "formularioManual" };

export type Entrada = { texto?: string; accion?: Accion; canal?: CanalEntrada };

export type Bloque =
  | { tipo: "opcionesCiiu"; descripcion: string; opciones: SugerenciaCiiu[] }
  | { tipo: "calculoVentas"; pasos: string[]; total: number }
  | { tipo: "resumen" }
  | { tipo: "consentimiento"; campo: "aceptaPoliticaDatos" | "aceptaTerminos"; vinetas: string[]; enlace: string }
  | { tipo: "asesor" }
  | { tipo: "confirmacion"; radicado: string }
  | { tipo: "encuesta" }
  | { tipo: "pasosCorreo"; pasos: string[] };

export type Chip = {
  etiqueta: string;
  /** Texto que se muestra como mensaje de la persona al tocar el botón. */
  texto: string;
  accion?: Accion;
  enlace?: string;
  variante?: "primario" | "secundario";
};

export type MensajeBot = { texto: string; bloque?: Bloque };

export type EventoMotor =
  | { tipo: "campo_completado"; campo: CampoId; origen: "respuesta" | "extraccion" | "boton" | "ia" }
  | { tipo: "error_validacion"; campo: CampoId; codigo: CodigoError }
  | { tipo: "campo_omitido"; campo: CampoId }
  | { tipo: "ayuda"; campo: CampoId | null }
  | { tipo: "pregunta_faq"; id: string }
  | { tipo: "pregunta_sin_respuesta"; texto: string }
  | { tipo: "ciiu_confirmado"; descripcion: string; codigo: string; posicion: number | null }
  | { tipo: "escalamiento"; motivo: string }
  | { tipo: "correccion"; campo: CampoId }
  | { tipo: "finalizado"; radicado: string }
  | { tipo: "seguridad"; motivo: "dato_prohibido" | "inyeccion" }
  | { tipo: "limite_mensajes" }
  | { tipo: "formulario_manual" };

export type Turno = {
  estado: EstadoConversacion;
  mensajes: MensajeBot[];
  chips: Chip[];
  eventos: EventoMotor[];
  ui?: { abrirFormulario?: boolean; abrirCampo?: CampoId };
};
