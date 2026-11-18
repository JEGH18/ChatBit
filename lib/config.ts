// Configuración del prototipo. Lo que dependa del despliegue se lee de variables de entorno
// públicas (NEXT_PUBLIC_*) para que el navegador y el servidor vean los mismos valores.

export type Tratamiento = "usted" | "tu";

export const CONFIG = {
  nombreAsistente: "Neo",
  nombreProducto: "Asistente Neo",
  /** Trato por defecto. "usted" es más respetuoso para el público objetivo. */
  tratamiento: (process.env.NEXT_PUBLIC_TRATAMIENTO === "tu" ? "tu" : "usted") as Tratamiento,
  /** Si el formulario real permite "Prefiero no decir" en género. */
  generoPermitePrefieroNoDecir: process.env.NEXT_PUBLIC_GENERO_PREFIERO_NO_DECIR !== "false",
  asesor: {
    whatsapp: process.env.NEXT_PUBLIC_ASESOR_WHATSAPP || "573000000000",
    telefono: process.env.NEXT_PUBLIC_ASESOR_TELEFONO || "601 000 0000",
    horario: process.env.NEXT_PUBLIC_ASESOR_HORARIO || "lunes a viernes de 8:00 a. m. a 5:00 p. m.",
  },
  enlaces: {
    politicaDatos:
      process.env.NEXT_PUBLIC_POLITICA_DATOS_URL ||
      "https://www.bancoldex.com/sites/default/files/politica_de_tratamiento_de_datos_personales_para_internet.pdf",
    terminos: process.env.NEXT_PUBLIC_TERMINOS_URL || "https://neocredito.bancoldex.com/neocredito/home",
    neocredito: "https://neocredito.bancoldex.com/neocredito/home",
  },
  /** Límite de mensajes del usuario por sesión (protección de costos y abuso). */
  maxMensajesSesion: Number(process.env.NEXT_PUBLIC_MAX_MENSAJES_SESION || 80),
  /** Horas que se conserva una sesión en el navegador antes de borrarse sola. */
  horasRetencionLocal: 24,
} as const;

export function enlaceWhatsAppAsesor(texto = "Hola, necesito ayuda con mi registro en Neocrédito.") {
  return `https://wa.me/${CONFIG.asesor.whatsapp}?text=${encodeURIComponent(texto)}`;
}
