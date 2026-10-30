// Repositorio con Prisma 7 (SQLite en local o Postgres en Vercel), mediante driver adapters.
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { DatosPanel, NuevaEncuesta, RegistroTurno, Repositorio } from "./tipos";
import { aEntradaFaq } from "./tipos";

export async function crearClientePrisma(driver: "sqlite" | "postgres"): Promise<PrismaClient> {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (driver === "postgres") {
    const [{ PrismaClient: ClientePg }, { PrismaPg }] = await Promise.all([import("@/lib/generated/prisma-pg/client"), import("@prisma/adapter-pg")]);
    return new ClientePg({ adapter: new PrismaPg({ connectionString: url }) }) as unknown as PrismaClient;
  }
  const [{ PrismaClient: ClienteSqlite }, { PrismaBetterSqlite3 }] = await Promise.all([
    import("@/lib/generated/prisma/client"),
    import("@prisma/adapter-better-sqlite3"),
  ]);
  return new ClienteSqlite({ adapter: new PrismaBetterSqlite3({ url }) });
}

export class RepositorioPrisma implements Repositorio {
  constructor(
    private db: PrismaClient,
    readonly nombre: "sqlite" | "postgres",
  ) {}

  async guardarTurno(r: RegistroTurno) {
    const s = r.sesion;
    const previa = await this.db.sesion.findUnique({ where: { id: s.id }, select: { finalizada: true } });
    await this.db.sesion.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        creadaEn: r.fecha,
        modo: s.modo,
        ultimoCampo: s.ultimoCampo,
        camposCompletos: s.camposCompletos,
        mensajes: s.mensaje ? 1 : 0,
        finalizada: s.finalizada,
        finalizadaEn: s.finalizada ? r.fecha : null,
        usoVoz: s.usoVoz,
        usoFormulario: s.usoFormulario,
        escalada: s.escalada,
        sintetica: s.sintetica ?? false,
      },
      update: {
        actualizadaEn: r.fecha,
        modo: s.modo,
        ultimoCampo: s.ultimoCampo,
        camposCompletos: s.camposCompletos,
        ...(s.mensaje ? { mensajes: { increment: 1 } } : {}),
        ...(s.finalizada && !previa?.finalizada ? { finalizada: true, finalizadaEn: r.fecha } : {}),
        ...(s.usoVoz ? { usoVoz: true } : {}),
        ...(s.usoFormulario ? { usoFormulario: true } : {}),
        ...(s.escalada ? { escalada: true } : {}),
      },
    });
    if (r.eventos.length) await this.db.evento.createMany({ data: r.eventos.map((e) => ({ ...e, sesionId: s.id, creadoEn: r.fecha })) });
    for (const p of r.preguntas) {
      await this.db.preguntaPendiente.upsert({
        where: { clave: p.clave },
        create: { texto: p.texto, clave: p.clave, creadaEn: r.fecha, sintetica: !!s.sintetica },
        update: { veces: { increment: 1 } },
      });
    }
    for (const x of r.sinonimos) {
      const sintetica = !!s.sintetica;
      await this.db.sinonimoCiiu.upsert({
        where: { descripcion_codigo_sintetica: { descripcion: x.descripcion, codigo: x.codigo, sintetica } },
        create: { ...x, sintetica },
        update: { veces: { increment: 1 } },
      });
    }
  }

  async guardarEncuesta(e: NuevaEncuesta) {
    const existe = await this.db.sesion.findUnique({ where: { id: e.sesionId }, select: { id: true } });
    if (!existe) await this.db.sesion.create({ data: { id: e.sesionId, sintetica: e.sintetica ?? false } });
    await this.db.encuesta.upsert({
      where: { sesionId: e.sesionId },
      create: { sesionId: e.sesionId, puntaje: e.puntaje, comentario: e.comentario, rangoEdad: e.rangoEdad, creadaEn: e.fecha ?? new Date() },
      update: { puntaje: e.puntaje, comentario: e.comentario, rangoEdad: e.rangoEdad },
    });
    if (e.rangoEdad) await this.db.sesion.update({ where: { id: e.sesionId }, data: { rangoEdad: e.rangoEdad } });
  }

  async revisarPregunta(id: number, cambio: { estado: "aprobada" | "descartada"; preguntaAprobada?: string; respuesta?: string; palabras?: string }) {
    await this.db.preguntaPendiente.update({ where: { id }, data: { ...cambio, revisadaEn: new Date() } });
  }

  async faqAprobadas() {
    const filas = await this.db.preguntaPendiente.findMany({ where: { estado: "aprobada", respuesta: { not: null } } });
    return filas.map(aEntradaFaq);
  }

  async sinonimos(limite = 300) {
    // Solo lo que confirmaron personas reales alimenta las sugerencias.
    return this.db.sinonimoCiiu.findMany({ where: { sintetica: false }, orderBy: { veces: "desc" }, take: limite, select: { descripcion: true, codigo: true, veces: true } });
  }

  async datosPanel(): Promise<DatosPanel> {
    const [sesiones, eventos, encuestas, preguntas, sinonimos] = await Promise.all([
      this.db.sesion.findMany(),
      this.db.evento.findMany({ select: { sesionId: true, tipo: true, campo: true, detalle: true, canal: true, creadoEn: true } }),
      this.db.encuesta.findMany({ select: { sesionId: true, puntaje: true, comentario: true, rangoEdad: true, creadaEn: true } }),
      this.db.preguntaPendiente.findMany({ orderBy: [{ veces: "desc" }, { creadaEn: "desc" }] }),
      this.db.sinonimoCiiu.findMany({ orderBy: { veces: "desc" }, select: { descripcion: true, codigo: true, veces: true, sintetica: true } }),
    ]);
    return { sesiones, eventos, encuestas, preguntas, sinonimos };
  }

  async borrarSinteticos() {
    await this.db.sesion.deleteMany({ where: { sintetica: true } });
    await this.db.sinonimoCiiu.deleteMany({ where: { sintetica: true } });
    await this.db.preguntaPendiente.deleteMany({ where: { sintetica: true, estado: "pendiente" } });
  }
}
