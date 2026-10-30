// Datos sintéticos para demostrar el panel administrativo SIN datos reales de personas.
// No se inventan cifras: se simulan conversaciones completas contra el motor real con
// "personas simuladas" (nombres y documentos ficticios) y se registra su analítica igual que
// en producción. Todo queda marcado como sintético y se puede borrar desde /admin.
import { construirRegistroTurno } from "@/lib/analitica/registrar";
import { campoActual, estadoInicial, type EstadoConversacion } from "@/lib/conversacion/estado";
import { procesarTurno } from "@/lib/conversacion/motor";
import type { Entrada } from "@/lib/conversacion/tipos";
import type { NuevaEncuesta, RegistroTurno } from "./tipos";

function aleatorio(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOMBRES = ["Rosa", "Luis", "Marta", "Jorge", "Ana", "Pedro", "Luz", "Carlos", "Gloria", "Javier", "Diana", "Hernán", "Sandra", "Óscar", "Nidia", "Fabio"];
const APELLIDOS = ["Gómez", "Rodríguez", "Martínez", "López", "García", "Ramírez", "Torres", "Moreno", "Castro", "Rojas", "Vargas", "Mosquera"];
const LUGARES: [string, string][] = [
  ["Valle", "Cali"], ["Antioquia", "Medellín"], ["Bogotá", "Bogotá"], ["Atlántico", "Barranquilla"], ["Nariño", "Pasto"],
  ["Chocó", "Quibdó"], ["Santander", "Bucaramanga"], ["Cundinamarca", "Soacha"], ["Bolívar", "Cartagena"], ["Huila", "Neiva"],
];
const NEGOCIOS = [
  "vendo empanadas en la esquina", "tengo una tienda de barrio", "arreglo celulares", "tengo una peluquería", "vendo ropa por WhatsApp",
  "hago arepas para vender", "tengo un taller de motos", "vendo almuerzos", "hago tortas y postres", "tengo una miscelánea",
  "confecciono uniformes", "vendo frutas en la plaza",
];
const PREGUNTAS = [
  "¿cuánto me cobran por el trámite?", "¿me van a aprobar el crédito?", "¿qué es el RUT?", "¿qué pasa después de registrarme?",
  "¿puedo aceptar dos ofertas?", "¿ustedes tienen oficina en Pasto?", "¿me sirve si estoy reportado en Datacrédito?",
  "¿el crédito sirve para comprar una moto?", "¿cuánto se demora el desembolso?", "¿puedo registrar el negocio de mi esposa?",
];
const RANGOS = ["Menos de 30", "30 a 44", "45 a 59", "60 o más"] as const;

type Perfil = {
  rango: (typeof RANGOS)[number] | null;
  voz: boolean;
  errores: number;
  abandonaEn: string | null;
  pregunta: string | null;
  asesor: boolean;
  manual: boolean;
};

function perfil(r: () => number): Perfil {
  const u = r();
  const rango = u < 0.22 ? RANGOS[0] : u < 0.5 ? RANGOS[1] : u < 0.75 ? RANGOS[2] : RANGOS[3];
  const mayor = rango === "60 o más";
  const abandono = r();
  const puntosDificiles = ["ventasUltimoAnio", "actividadEconomica", "correo", "numeroDocumento", "departamento"];
  return {
    rango: r() < 0.7 ? rango : null, // no todas las personas responden la encuesta
    voz: r() < (mayor ? 0.45 : 0.12),
    errores: mayor ? 0.35 : 0.15,
    abandonaEn: abandono < (mayor ? 0.3 : 0.18) ? puntosDificiles[Math.floor(r() * puntosDificiles.length)] : null,
    pregunta: r() < 0.35 ? PREGUNTAS[Math.floor(r() * PREGUNTAS.length)] : null,
    asesor: r() < (mayor ? 0.12 : 0.05),
    manual: r() < 0.06,
  };
}

/** Respuesta de la persona simulada según lo que el asistente le está pidiendo. */
function responder(e: EstadoConversacion, p: Perfil, r: () => number, datos: Record<string, string>, usados: Set<string>): Entrada | null {
  const canal = p.voz ? "voz" : "texto";
  const t = (texto: string): Entrada => ({ texto, canal });
  const falla = (clave: string) => !usados.has(clave) && r() < p.errores && (usados.add(clave), true);
  const sub = e.subdialogo;
  if (sub?.tipo === "confirmarDocumento") return t("sí");
  if (sub?.tipo === "confirmarNombreApellido") return t("sí");
  if (sub?.tipo === "elegirCiiu") {
    const x = r();
    const o = sub.opciones[x < 0.68 ? 0 : x < 0.88 ? 1 : 2] ?? sub.opciones[0];
    return { accion: { tipo: "elegirCiiu", codigo: o.codigo }, texto: o.corto, canal: "boton" };
  }
  if (sub?.tipo === "estimarVentas") return t(sub.paso === "diaria" ? `${[80, 120, 150, 200, 250][Math.floor(r() * 5)]} mil` : String(5 + Math.floor(r() * 3)));
  if (sub?.tipo === "confirmarVentas") return { accion: { tipo: "usarVentas", valor: sub.propuesta }, texto: "Sí", canal: "boton" };
  if (sub?.tipo === "ayudaCorreo") return t(datos.correo);
  if (sub?.tipo === "elegirOpcion") return { accion: { tipo: "responder", campo: sub.campo, valor: sub.opciones[0].valor }, canal: "boton" };
  if (e.fase === "revision") return { accion: { tipo: "finalizar" }, texto: "Finalizar registro", canal: "boton" };

  const c = campoActual(e);
  if (!c || c === p.abandonaEn) return null;
  if (p.pregunta && !usados.has("pregunta") && r() < 0.25) {
    usados.add("pregunta");
    return t(p.pregunta);
  }
  if (p.asesor && !usados.has("asesor") && (c === "ventasUltimoAnio" || c === "actividadEconomica" || c === "correo")) {
    usados.add("asesor");
    return t("quiero hablar con un asesor");
  }
  switch (c) {
    case "primerNombre":
      return t(datos.nombre);
    case "primerApellido":
      return t(datos.apellido);
    case "tipoDocumento":
      return { accion: { tipo: "responder", campo: c, valor: "CC" }, texto: "Cédula", canal: "boton" };
    case "numeroDocumento":
      return t(falla("doc") ? datos.documento.slice(0, 4) : datos.documento);
    case "genero":
      return t(["femenino", "masculino", "femenino", "masculino", "prefiero no decir"][Math.floor(r() * 5)]);
    case "celular":
      return t(falla("cel") ? datos.celular.slice(0, 8) : datos.celular);
    case "correo":
      if (falla("correo")) return t(r() < 0.5 ? "no tengo correo" : datos.correo.replace("@", " "));
      return t(datos.correo);
    case "tieneRut":
      return t(r() < 0.4 ? "sí" : "no");
    case "comoSeEntero":
      return t(["por facebook", "en un evento", "me lo recomendó un vecino", "en el banco", "otro"][Math.floor(r() * 5)]);
    case "departamento":
      return t(falla("dep") ? "mi barrio" : datos.departamento);
    case "ciudad":
      return t(datos.ciudad);
    case "medioContacto":
      return t(["whatsapp", "whatsapp", "llamada", "correo"][Math.floor(r() * 4)]);
    case "perteneceMinoria":
      return t(["no", "no", "sí", "prefiero no responder"][Math.floor(r() * 4)]);
    case "actividadEconomica":
      return t(datos.negocio);
    case "anioVentas":
      return t("el año pasado");
    case "ventasUltimoAnio": {
      const x = r();
      if (x < 0.4) return t("no sé");
      if (x < 0.7) return t(`unos ${1 + Math.floor(r() * 4)} millones al mes`);
      return t(`${12 + Math.floor(r() * 60)} millones`);
    }
    case "aceptaPoliticaDatos":
    case "aceptaTerminos":
      return { accion: { tipo: "aceptar", campo: c }, texto: "Acepto", canal: "boton" };
    default:
      return t("sí");
  }
}

export function generarSintetico(n = 150, semilla = 2026, hoy = new Date()) {
  const r = aleatorio(semilla);
  const turnos: RegistroTurno[] = [];
  const encuestas: NuevaEncuesta[] = [];
  for (let i = 0; i < n; i++) {
    const p = perfil(r);
    const sesionId = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    const nombre = NOMBRES[Math.floor(r() * NOMBRES.length)];
    const apellido = APELLIDOS[Math.floor(r() * APELLIDOS.length)];
    const [departamento, ciudad] = LUGARES[Math.floor(r() * LUGARES.length)];
    const datos = {
      nombre,
      apellido,
      documento: String(10_000_000 + Math.floor(r() * 89_999_999)),
      celular: `3${String(Math.floor(r() * 999_999_999)).padStart(9, "0")}`,
      correo: `${nombre}.${apellido}${i}@ejemplo.com`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
      departamento,
      ciudad,
      negocio: NEGOCIOS[Math.floor(r() * NEGOCIOS.length)],
    };
    let fecha = new Date(hoy.getTime() - (1 + r() * 14) * 86_400_000);
    let estado = estadoInicial("usted");
    const usados = new Set<string>();
    const paso = (entrada: Entrada, segundos: number) => {
      const turno = procesarTurno(estado, entrada, { hoy });
      fecha = new Date(fecha.getTime() + segundos * 1000);
      turnos.push(construirRegistroTurno({ sesionId, antes: estado, despues: turno.estado, entrada, eventos: turno.eventos, modo: "guiado", fecha, sintetica: true }));
      estado = turno.estado;
    };
    paso({ accion: { tipo: "iniciar" } }, 0);
    if (p.manual) paso({ accion: { tipo: "formularioManual" }, canal: "boton" }, 5);
    for (let k = 0; k < 70 && estado.fase !== "encuesta"; k++) {
      const entrada = responder(estado, p, r, datos, usados);
      if (!entrada) break;
      if (p.manual && entrada.texto && !entrada.accion) entrada.canal = "formulario";
      const c = campoActual(estado);
      const lento = c === "ventasUltimoAnio" || c === "actividadEconomica" ? 40 : 12;
      paso(entrada, lento + r() * (p.voz ? 30 : 20));
      if (entrada.texto === "quiero hablar con un asesor") paso({ accion: { tipo: "responder", campo: c ?? "primerNombre", valor: "__continuar__" }, canal: "boton" }, 20);
    }
    if (estado.fase === "encuesta" && r() < 0.75) {
      const mayor = p.rango === "60 o más";
      const x = r();
      encuestas.push({
        sesionId,
        puntaje: x < (mayor ? 0.62 : 0.74) ? 3 : x < 0.92 ? 2 : 1,
        rangoEdad: p.rango ?? undefined,
        fecha: new Date(fecha.getTime() + 20_000),
        sintetica: true,
      });
    }
  }
  return { turnos, encuestas };
}
