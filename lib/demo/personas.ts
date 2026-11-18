// Guiones de las 3 personas de prueba (datos ficticios). Se usan para el modo demo,
// las pruebas E2E y las pruebas del motor. Nunca use datos reales de personas.
import type { Accion, CanalEntrada } from "@/lib/conversacion/tipos";

export type PasoGuion = { texto?: string; accion?: Accion; canal?: CanalEntrada; nota?: string };

export type Persona = { id: "domiciano" | "marcela" | "andres"; nombre: string; descripcion: string; pasos: PasoGuion[] };

const voz = (texto: string, nota?: string): PasoGuion => ({ texto, canal: "voz", nota });
const txt = (texto: string, nota?: string): PasoGuion => ({ texto, canal: "texto", nota });
const boton = (accion: Accion, texto: string, nota?: string): PasoGuion => ({ accion, texto, canal: "boton", nota });

export const PERSONAS: Persona[] = [
  {
    id: "domiciano",
    nombre: "Don Domiciano, 67 años",
    descripcion: "Poca experiencia digital, respuestas cortas y con errores de digitación. Usa la voz.",
    pasos: [
      voz("domiciano", "Responde por voz, solo el nombre."),
      voz("rincon"),
      voz("cedula"),
      voz("uno uno cero tres seis siete nueve seis nueve", "Dicta el documento número por número."),
      voz("si", "El asistente le leyó el número en grupos."),
      voz("masculino"),
      txt("310 456 78 9", "Error de digitación: le falta un número."),
      txt("3104567890"),
      voz("no tengo correo", "El asistente le ofrece ayuda."),
      voz("domiciano punto rincon arroba gmail punto com", "Dicta el correo de su hija."),
      voz("no"),
      voz("un vecino me conto"),
      voz("valle"),
      voz("cali"),
      voz("wasap"),
      voz("no"),
      voz("tengo una tienda de barrio", "Describe su negocio con sus palabras."),
      voz("la primera"),
      voz("el año pasado"),
      voz("no se", "No sabe sus ventas anuales: el asistente le ayuda a calcular."),
      voz("doscientos mil"),
      voz("siete"),
      voz("si"),
      voz("acepto"),
      voz("acepto"),
      boton({ tipo: "finalizar" }, "Finalizar registro"),
    ],
  },
  {
    id: "marcela",
    nombre: "Marcela, emprendedora informal",
    descripcion: "Vende comida desde su casa. No sabe qué es el CIIU ni cuánto vende al año.",
    pasos: [
      txt("Marcela Ospina"),
      txt("sí"),
      txt("cc"),
      txt("1020304050"),
      boton({ tipo: "confirmarDocumento", correcto: true }, "Sí, es correcto"),
      txt("femenino"),
      txt("3009876543"),
      txt("marcela.ospina@ejemplo.com"),
      txt("¿qué es el RUT?", "Pregunta antes de responder."),
      txt("no"),
      txt("por facebook"),
      txt("Antioquia"),
      txt("Bello"),
      txt("llamada"),
      boton({ tipo: "omitir", campo: "perteneceMinoria" }, "Prefiero no responder", "Se respeta sin insistir."),
      txt("¿qué es eso del CIIU?"),
      txt("vendo almuerzos y empanadas desde mi casa"),
      boton({ tipo: "elegirCiiu", codigo: "5619" }, "Comidas rápidas o venta de comida en la calle"),
      txt("2025"),
      txt("como 2 millones al mes", "Expresión coloquial y mensual."),
      boton({ tipo: "usarVentas", valor: 24_000_000 }, "Sí, usar $24.000.000"),
      boton({ tipo: "aceptar", campo: "aceptaPoliticaDatos" }, "Acepto la política de datos"),
      boton({ tipo: "aceptar", campo: "aceptaTerminos" }, "Acepto los términos"),
      boton({ tipo: "finalizar" }, "Finalizar registro"),
    ],
  },
  {
    id: "andres",
    nombre: "Andrés, usuario experto",
    descripcion: "Entrega todos sus datos en un solo mensaje.",
    pasos: [
      txt(
        "Hola, soy Andrés Gómez, cédula de ciudadanía 1020304050, género masculino, celular 310 456 7890, correo andres.gomez@ejemplo.com. " +
          "Sí tengo RUT y me enteré por redes sociales. Mi negocio queda en Medellín, Antioquia; prefiero que me contacten por WhatsApp. " +
          "No pertenezco a ninguna minoría. Desarrollo software, CIIU 6201. Mis ventas de 2025 fueron de 180 millones.",
        "Un solo mensaje con todo.",
      ),
      boton({ tipo: "confirmarDocumento", correcto: true }, "Sí, es correcto"),
      boton({ tipo: "aceptar", campo: "aceptaPoliticaDatos" }, "Acepto la política de datos"),
      boton({ tipo: "aceptar", campo: "aceptaTerminos" }, "Acepto los términos"),
      boton({ tipo: "finalizar" }, "Finalizar registro"),
    ],
  },
];
