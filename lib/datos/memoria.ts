// Repositorio en memoria: para pruebas, demos sin base de datos y despliegues sin Postgres.
// Los datos viven mientras el proceso esté activo.
import type { DatosPanel, FilaEncuesta, FilaEvento, FilaPregunta, FilaSesion, FilaSinonimo, NuevaEncuesta, RegistroTurno, Repositorio } from "./tipos";
import { aEntradaFaq } from "./tipos";

export class RepositorioMemoria implements Repositorio {
  readonly nombre = "memoria" as const;
  sesiones = new Map<string, FilaSesion>();
  eventos: FilaEvento[] = [];
  encuestas = new Map<string, FilaEncuesta>();
  preguntas: FilaPregunta[] = [];
  sinonimosFilas: FilaSinonimo[] = [];

  async guardarTurno(r: RegistroTurno) {
    const s = r.sesion;
    const previa = this.sesiones.get(s.id);
    this.sesiones.set(s.id, {
      id: s.id,
      creadaEn: previa?.creadaEn ?? r.fecha,
      actualizadaEn: r.fecha,
      modo: s.modo,
      ultimoCampo: s.ultimoCampo,
      camposCompletos: s.camposCompletos,
      mensajes: (previa?.mensajes ?? 0) + (s.mensaje ? 1 : 0),
      finalizada: (previa?.finalizada ?? false) || s.finalizada,
      finalizadaEn: previa?.finalizadaEn ?? (s.finalizada ? r.fecha : null),
      usoVoz: (previa?.usoVoz ?? false) || s.usoVoz,
      usoFormulario: (previa?.usoFormulario ?? false) || s.usoFormulario,
      escalada: (previa?.escalada ?? false) || s.escalada,
      rangoEdad: previa?.rangoEdad ?? null,
      sintetica: s.sintetica ?? previa?.sintetica ?? false,
    });
    for (const e of r.eventos) this.eventos.push({ ...e, sesionId: s.id, creadoEn: r.fecha });
    for (const p of r.preguntas) {
      const existente = this.preguntas.find((x) => x.clave === p.clave);
      if (existente) existente.veces++;
      else
        this.preguntas.push({
          id: this.preguntas.length + 1, texto: p.texto, clave: p.clave, veces: 1, estado: "pendiente", preguntaAprobada: null,
          respuesta: null, palabras: null, sintetica: !!s.sintetica, creadaEn: r.fecha, revisadaEn: null,
        });
    }
    for (const x of r.sinonimos) {
      const sintetica = !!s.sintetica;
      const existente = this.sinonimosFilas.find((y) => y.descripcion === x.descripcion && y.codigo === x.codigo && !!y.sintetica === sintetica);
      if (existente) existente.veces++;
      else this.sinonimosFilas.push({ ...x, veces: 1, sintetica });
    }
  }

  async guardarEncuesta(e: NuevaEncuesta) {
    const fecha = e.fecha ?? new Date();
    this.encuestas.set(e.sesionId, { sesionId: e.sesionId, puntaje: e.puntaje, comentario: e.comentario ?? null, rangoEdad: e.rangoEdad ?? null, creadaEn: fecha });
    const s = this.sesiones.get(e.sesionId);
    if (s && e.rangoEdad) s.rangoEdad = e.rangoEdad;
  }

  async revisarPregunta(id: number, cambio: { estado: "aprobada" | "descartada"; preguntaAprobada?: string; respuesta?: string; palabras?: string }) {
    const p = this.preguntas.find((x) => x.id === id);
    if (p) Object.assign(p, cambio, { revisadaEn: new Date() });
  }

  async faqAprobadas() {
    return this.preguntas.filter((p) => p.estado === "aprobada" && p.respuesta).map(aEntradaFaq);
  }

  async sinonimos(limite = 300) {
    return this.sinonimosFilas.filter((x) => !x.sintetica).sort((a, b) => b.veces - a.veces).slice(0, limite);
  }

  async datosPanel(): Promise<DatosPanel> {
    return {
      sesiones: [...this.sesiones.values()],
      eventos: this.eventos,
      encuestas: [...this.encuestas.values()],
      preguntas: this.preguntas,
      sinonimos: this.sinonimosFilas,
    };
  }

  async borrarSinteticos() {
    const ids = new Set([...this.sesiones.values()].filter((s) => s.sintetica).map((s) => s.id));
    for (const id of ids) {
      this.sesiones.delete(id);
      this.encuestas.delete(id);
    }
    this.eventos = this.eventos.filter((e) => !ids.has(e.sesionId));
    this.sinonimosFilas = this.sinonimosFilas.filter((x) => !x.sintetica);
    this.preguntas = this.preguntas.filter((p) => !p.sintetica || p.estado !== "pendiente");
  }
}
