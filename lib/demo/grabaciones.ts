// Conversaciones pregrabadas (npm run demo:grabar). Se empaquetan con la app: el modo demo
// funciona aunque falle internet durante la presentación.
import andres from "@/data/demo/andres.json";
import domiciano from "@/data/demo/domiciano.json";
import marcela from "@/data/demo/marcela.json";
import type { EstadoConversacion } from "@/lib/conversacion/estado";
import type { Bloque, Chip } from "@/lib/conversacion/tipos";

export type Grabacion = {
  persona: { id: string; nombre: string; descripcion: string };
  modo: "ia" | "guiado";
  grabado: string;
  pasos: {
    usuario?: { texto: string; canal?: string; nota?: string };
    respuesta: { mensajes: { texto: string; bloque?: Bloque }[]; chips: Chip[]; estado: EstadoConversacion };
  }[];
};

export const GRABACIONES = [domiciano, marcela, andres] as unknown as Grabacion[];
