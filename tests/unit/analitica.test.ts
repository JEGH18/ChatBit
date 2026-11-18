import { describe, expect, it } from "vitest";
import { calcularMetricas } from "@/lib/analitica/metricas";
import { construirRegistroTurno } from "@/lib/analitica/registrar";
import { estadoInicial, type EstadoConversacion } from "@/lib/conversacion/estado";
import { RepositorioMemoria } from "@/lib/datos/memoria";
import { generarSintetico } from "@/lib/datos/sintetico";
import { redactarPII } from "@/lib/seguridad";

const conDatos: EstadoConversacion = {
  ...estadoInicial(),
  valores: { primerNombre: "Domiciano", primerApellido: "Rincón", numeroDocumento: "110367969", celular: "3104567890", correo: "domi@ejemplo.com" },
};

describe("analítica sin datos personales", () => {
  it("redacta correo, celular, documento y nombres conocidos", () => {
    const t = redactarPII("Soy Domiciano Rincón, cc 110.367.969, cel 310 456 7890, domi@ejemplo.com ¿tienen oficina?", ["Domiciano", "Rincón"]);
    for (const dato of ["Domiciano", "Rincón", "110.367.969", "310 456 7890", "domi@ejemplo.com"]) expect(t).not.toContain(dato);
    expect(t).toContain("¿tienen oficina?");
  });

  it("los eventos de un turno solo llevan códigos; la pregunta sin respuesta va anonimizada", () => {
    const r = construirRegistroTurno({
      sesionId: "s1",
      antes: conDatos,
      despues: conDatos,
      entrada: { texto: "Domiciano pregunta: ¿atienden en Pasto? mi cel es 3104567890", canal: "voz" },
      eventos: [
        { tipo: "pregunta_sin_respuesta", texto: "Domiciano pregunta: ¿atienden en Pasto? mi cel es 3104567890" },
        { tipo: "ciiu_confirmado", descripcion: "Rincón vende empanadas", codigo: "5619", posicion: 1 },
        { tipo: "error_validacion", campo: "celular", codigo: "formato" },
      ],
      modo: "guiado",
    });
    const serializado = JSON.stringify(r);
    for (const dato of ["Domiciano", "Rincón", "3104567890", "110367969", "domi@"]) expect(serializado).not.toContain(dato);
    expect(r.preguntas[0].texto).toContain("Pasto");
    expect(r.sinonimos[0]).toEqual({ descripcion: "vende empanadas", codigo: "5619" });
    expect(r.sesion.usoVoz).toBe(true);
  });
});

describe("métricas del panel", () => {
  it("calcula el embudo, la fricción y la completitud por segmento con datos sintéticos", async () => {
    const repo = new RepositorioMemoria();
    const { turnos, encuestas } = generarSintetico(40, 11, new Date("2026-10-29T12:00:00Z"));
    for (const t of turnos) await repo.guardarTurno(t);
    for (const e of encuestas) await repo.guardarEncuesta(e);
    const m = calcularMetricas(await repo.datosPanel(), new Date("2026-10-30T12:00:00Z"));
    expect(m.totales.sesiones).toBe(40);
    expect(m.totales.tasaFinalizacion).toBeGreaterThan(40);
    expect(m.embudo).toHaveLength(19);
    expect(m.embudo[0].llegaron).toBe(40);
    expect(m.completitud.segmentos[0].sesiones).toBe(40);
    expect(m.ciiu.confirmaciones).toBeGreaterThan(0);
    // Ningún evento guardado contiene un correo o un número largo.
    for (const e of (await repo.datosPanel()).eventos) expect(`${e.detalle ?? ""}`).not.toMatch(/@|\d{6,}/);
  });

  it("los sinónimos de datos sintéticos no alimentan el aprendizaje", async () => {
    const repo = new RepositorioMemoria();
    const { turnos } = generarSintetico(10, 3);
    for (const t of turnos) await repo.guardarTurno(t);
    expect((await repo.datosPanel()).sinonimos.length).toBeGreaterThan(0);
    expect(await repo.sinonimos()).toHaveLength(0);
    await repo.borrarSinteticos();
    expect((await repo.datosPanel()).sesiones).toHaveLength(0);
  });

  it("las respuestas aprobadas por un humano entran a la base de conocimiento", async () => {
    const repo = new RepositorioMemoria();
    await repo.guardarTurno({
      fecha: new Date(),
      sesion: { id: "s", modo: "guiado", ultimoCampo: null, camposCompletos: 0, mensaje: true, usoVoz: false, usoFormulario: false, escalada: false, finalizada: false },
      eventos: [],
      preguntas: [{ texto: "¿tienen oficina en Pasto?", clave: "tienen oficina en pasto" }],
      sinonimos: [],
    });
    await repo.revisarPregunta(1, { estado: "aprobada", respuesta: "Neocrédito es un canal digital: no tiene oficinas de atención.", palabras: "oficina, sede, presencial" });
    const faq = await repo.faqAprobadas();
    expect(faq[0].respuesta).toMatch(/canal digital/);
  });
});
