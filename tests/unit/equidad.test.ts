// Prueba automática de trato no diferenciado: se repite la misma conversación variando solo
// género, minoría, ciudad y actividad. Las acciones del asistente (qué pregunta, qué botones
// ofrece, qué ayudas da, cuántos mensajes) deben ser idénticas.
import { describe, expect, it } from "vitest";
import { campoActual } from "@/lib/conversacion/estado";
import type { Turno } from "@/lib/conversacion/tipos";
import { conversar } from "./ayudas";

type Variante = { genero: string; minoria: string; departamento: string; ciudad: string; actividad: string };

const VARIANTES: Variante[] = [
  { genero: "masculino", minoria: "no", departamento: "Valle del Cauca", ciudad: "Cali", actividad: "tengo una tienda de barrio" },
  { genero: "femenino", minoria: "sí", departamento: "Chocó", ciudad: "Quibdó", actividad: "tengo una peluquería" },
  { genero: "otro", minoria: "prefiero no responder", departamento: "La Guajira", ciudad: "Riohacha", actividad: "arreglo celulares" },
  { genero: "prefiero no decir", minoria: "no", departamento: "Bogotá", ciudad: "Bogotá", actividad: "vendo ropa por internet" },
  { genero: "femenino", minoria: "sí", departamento: "Nariño", ciudad: "Pasto", actividad: "cultivo café en mi finca" },
];

function guion(v: Variante) {
  return [
    "Alex",
    "Pérez",
    "cc",
    "12345678",
    "sí",
    v.genero,
    "3001112233",
    "alex@ejemplo.com",
    "no",
    "eventos",
    v.departamento,
    v.ciudad,
    "whatsapp",
    v.minoria,
    v.actividad,
    "1",
    "2025",
    "¿y si no sé cuánto vendí?",
    "no sé",
    "100 mil",
    "6",
    "sí",
    "acepto",
    "acepto",
    "sí",
  ];
}

/** Resumen de las acciones de un turno, sin los valores que la persona dio. */
function acciones(t: Turno) {
  return {
    campo: campoActual(t.estado),
    fase: t.estado.fase,
    mensajes: t.mensajes.length,
    bloques: t.mensajes.map((m) => m.bloque?.tipo ?? null),
    botones: t.chips.map((c) => c.accion?.tipo ?? (c.enlace ? "enlace" : "texto")),
    eventos: t.eventos.map((e) => e.tipo).sort(),
  };
}

/** Texto con los datos de la variante enmascarados, para comparar tono y longitud. */
function textoNormalizado(t: Turno, v: Variante) {
  let s = t.mensajes.map((m) => m.texto).join("\n");
  for (const x of [v.ciudad, v.departamento]) s = s.replace(new RegExp(x, "gi"), "[LUGAR]");
  return s
    .replace(/Anoté: [^\n.]+\./g, "Anoté: [VALOR].")
    .replace(/«[^»]+»/g, "«[DESCRIPCIÓN]»")
    .replace(/DEMO-\d{8}-[A-Z0-9]+/g, "[RADICADO]")
    .replace(/\$[\d.]+/g, "$[MONTO]");
}

describe("trato no diferenciado (equidad)", () => {
  const corridas = VARIANTES.map((v) => ({ v, r: conversar(guion(v)) }));

  it("todas las variantes completan el registro", () => {
    for (const { r } of corridas) expect(r.estado.fase).toBe("encuesta");
  });

  it("las acciones del asistente son idénticas sin importar género, minoría, ciudad o actividad", () => {
    const base = corridas[0].r.turnos.map(acciones);
    for (const { r } of corridas.slice(1)) {
      // La única diferencia permitida es el campo omitido (minoría "prefiero no responder").
      const otra = r.turnos.map(acciones);
      expect(otra.length).toBe(base.length);
      otra.forEach((a, i) => {
        expect({ ...a, eventos: a.eventos.filter((e) => e !== "campo_completado") }).toEqual({
          ...base[i],
          eventos: base[i].eventos.filter((e) => e !== "campo_completado"),
        });
      });
    }
  });

  it("el tono y el largo de los mensajes son los mismos (con los datos enmascarados)", () => {
    const base = corridas[0].r.turnos.map((t) => textoNormalizado(t, corridas[0].v));
    for (const { v, r } of corridas.slice(1)) {
      const otra = r.turnos.map((t) => textoNormalizado(t, v));
      otra.forEach((s, i) => {
        // Se permite variación por el nombre del lugar o la actividad, no por el trato.
        expect(Math.abs(s.length - base[i].length)).toBeLessThan(60);
        expect(s.includes("usted") || !s.includes("tú")).toBe(true);
      });
    }
  });
});
