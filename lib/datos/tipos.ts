// Contrato de persistencia. Ninguna de estas filas contiene datos personales del formulario.
import type { EntradaFaq } from "@/lib/conocimiento/faq";
import type { SinonimoAprendido } from "@/lib/form/ciiu";

export type FilaSesion = {
  id: string;
  creadaEn: Date;
  actualizadaEn: Date;
  modo: string;
  ultimoCampo: string | null;
  camposCompletos: number;
  mensajes: number;
  finalizada: boolean;
  finalizadaEn: Date | null;
  usoVoz: boolean;
  usoFormulario: boolean;
  escalada: boolean;
  rangoEdad: string | null;
  sintetica: boolean;
};

export type FilaEvento = {
  sesionId: string;
  tipo: string;
  campo: string | null;
  detalle: string | null;
  canal: string | null;
  creadoEn: Date;
};

export type FilaEncuesta = { sesionId: string; puntaje: number; comentario: string | null; rangoEdad: string | null; creadaEn: Date };

export type FilaPregunta = {
  id: number;
  texto: string;
  clave: string;
  veces: number;
  estado: string;
  preguntaAprobada: string | null;
  respuesta: string | null;
  palabras: string | null;
  sintetica?: boolean;
  creadaEn: Date;
  revisadaEn: Date | null;
};

export type FilaSinonimo = { descripcion: string; codigo: string; veces: number; sintetica?: boolean };

/** Todo lo que se guarda después de un turno de conversación. */
export type RegistroTurno = {
  fecha: Date;
  sesion: {
    id: string;
    modo: string;
    ultimoCampo: string | null;
    camposCompletos: number;
    mensaje: boolean;
    usoVoz: boolean;
    usoFormulario: boolean;
    escalada: boolean;
    finalizada: boolean;
    sintetica?: boolean;
  };
  eventos: Omit<FilaEvento, "sesionId" | "creadoEn">[];
  /** Preguntas sin respuesta, ya anonimizadas. */
  preguntas: { texto: string; clave: string }[];
  /** Pares descripción anonimizada → código CIIU confirmado. */
  sinonimos: { descripcion: string; codigo: string }[];
};

export type NuevaEncuesta = { sesionId: string; puntaje: number; comentario?: string; rangoEdad?: string; fecha?: Date; sintetica?: boolean };

export type DatosPanel = {
  sesiones: FilaSesion[];
  eventos: FilaEvento[];
  encuestas: FilaEncuesta[];
  preguntas: FilaPregunta[];
  sinonimos: FilaSinonimo[];
};

export interface Repositorio {
  readonly nombre: "sqlite" | "postgres" | "memoria";
  guardarTurno(r: RegistroTurno): Promise<void>;
  guardarEncuesta(e: NuevaEncuesta): Promise<void>;
  revisarPregunta(id: number, cambio: { estado: "aprobada" | "descartada"; preguntaAprobada?: string; respuesta?: string; palabras?: string }): Promise<void>;
  faqAprobadas(): Promise<EntradaFaq[]>;
  sinonimos(limite?: number): Promise<SinonimoAprendido[]>;
  datosPanel(): Promise<DatosPanel>;
  borrarSinteticos(): Promise<void>;
}

export function aEntradaFaq(p: FilaPregunta): EntradaFaq {
  return {
    id: `aprobada-${p.id}`,
    pregunta: p.preguntaAprobada || p.texto,
    palabras: (p.palabras ?? "").split(",").map((x) => x.trim()).filter(Boolean),
    respuesta: p.respuesta ?? "",
    fuente: "bandeja de preguntas (aprobada por un humano)",
  };
}
