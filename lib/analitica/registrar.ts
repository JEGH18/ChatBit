// Convierte un turno de conversación en filas de analítica, sin datos personales.
// - Los eventos solo llevan códigos (campo, tipo de error, id de pregunta frecuente…).
// - Las preguntas sin respuesta y las descripciones de negocio se anonimizan antes de guardarse.
import { campoActual, progreso, type EstadoConversacion } from "@/lib/conversacion/estado";
import type { CanalEntrada, Entrada, EventoMotor } from "@/lib/conversacion/tipos";
import type { RegistroTurno } from "@/lib/datos/tipos";
import { redactarPII } from "@/lib/seguridad";
import { normalizar } from "@/lib/texto";

export function datosConocidos(...estados: EstadoConversacion[]) {
  return estados.flatMap((e) => [e.valores.primerNombre, e.valores.primerApellido, e.valores.numeroDocumento, e.valores.celular, e.valores.correo]);
}

export function construirRegistroTurno(p: {
  sesionId: string;
  antes: EstadoConversacion;
  despues: EstadoConversacion;
  entrada: Entrada;
  eventos: EventoMotor[];
  modo: string;
  fecha?: Date;
  sintetica?: boolean;
}): RegistroTurno {
  const { antes, despues, entrada, eventos } = p;
  const canal: CanalEntrada | null = entrada.canal ?? (entrada.accion ? "boton" : entrada.texto ? "texto" : null);
  const conocidos = datosConocidos(antes, despues);
  const filas: RegistroTurno["eventos"] = [];
  const preguntas: RegistroTurno["preguntas"] = [];
  const sinonimos: RegistroTurno["sinonimos"] = [];

  if (entrada.texto?.trim() && entrada.accion?.tipo !== "iniciar") filas.push({ tipo: "mensaje", campo: campoActual(antes), detalle: null, canal });

  for (const e of eventos) {
    switch (e.tipo) {
      case "campo_completado":
        filas.push({ tipo: e.tipo, campo: e.campo, detalle: e.origen, canal });
        break;
      case "error_validacion":
        filas.push({ tipo: e.tipo, campo: e.campo, detalle: e.codigo, canal });
        break;
      case "ayuda":
      case "correccion":
      case "campo_omitido":
        filas.push({ tipo: e.tipo, campo: e.campo, detalle: null, canal });
        break;
      case "pregunta_faq":
        filas.push({ tipo: e.tipo, campo: campoActual(antes), detalle: e.id, canal });
        break;
      case "pregunta_sin_respuesta": {
        const texto = redactarPII(e.texto, conocidos);
        preguntas.push({ texto, clave: normalizar(texto).slice(0, 200) });
        filas.push({ tipo: e.tipo, campo: campoActual(antes), detalle: null, canal });
        break;
      }
      case "ciiu_confirmado": {
        // Se quitan los marcadores de anonimización ([dato], [número]…) antes de normalizar.
        const descripcion = normalizar(redactarPII(e.descripcion, conocidos).replace(/\[[^\]]+\]/g, " ")).slice(0, 200);
        if (descripcion.length >= 3) sinonimos.push({ descripcion, codigo: e.codigo });
        filas.push({ tipo: e.tipo, campo: "actividadEconomica", detalle: `${e.codigo}:${e.posicion ?? "-"}`, canal });
        break;
      }
      case "escalamiento":
        filas.push({ tipo: e.tipo, campo: campoActual(antes), detalle: e.motivo.slice(0, 60), canal });
        break;
      case "seguridad":
        filas.push({ tipo: e.tipo, campo: null, detalle: e.motivo, canal });
        break;
      case "finalizado":
        filas.push({ tipo: e.tipo, campo: null, detalle: null, canal });
        break;
      default:
        filas.push({ tipo: e.tipo, campo: null, detalle: null, canal });
    }
  }

  // Cuando cambia el campo que se pregunta, se registra cuándo empezó (para medir tiempo y abandono).
  const nuevo = campoActual(despues);
  if (nuevo && (nuevo !== campoActual(antes) || entrada.accion?.tipo === "iniciar") && despues.fase === "recolectando") {
    filas.push({ tipo: "campo_mostrado", campo: nuevo, detalle: null, canal: null });
  }

  return {
    fecha: p.fecha ?? new Date(),
    sesion: {
      id: p.sesionId,
      modo: p.modo,
      ultimoCampo: despues.fase === "recolectando" ? nuevo : despues.fase,
      camposCompletos: progreso(despues).completos,
      mensaje: !!entrada.texto?.trim() && entrada.accion?.tipo !== "iniciar",
      usoVoz: canal === "voz",
      usoFormulario: canal === "formulario" || eventos.some((e) => e.tipo === "formulario_manual"),
      escalada: eventos.some((e) => e.tipo === "escalamiento"),
      finalizada: eventos.some((e) => e.tipo === "finalizado"),
      sintetica: p.sintetica,
    },
    eventos: filas,
    preguntas,
    sinonimos,
  };
}
