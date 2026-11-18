import { describe, expect, it } from "vitest";
import { interpretarCampo, esquemaValores, soloDigitos } from "@/lib/form/validadores";
import { aniosVentas } from "@/lib/form/catalogos";

const ok = (r: ReturnType<typeof interpretarCampo>) => (r.ok ? r.valor : `ERROR:${r.codigo}`);

describe("validadores", () => {
  it("nombres: solo letras, tildes y ñ", () => {
    expect(ok(interpretarCampo("primerNombre", "domiciano", {}))).toBe("Domiciano");
    expect(ok(interpretarCampo("primerApellido", "NUÑEZ", {}))).toBe("Nuñez");
    expect(ok(interpretarCampo("primerNombre", "me llamo José", {}))).toBe("José");
    expect(ok(interpretarCampo("primerNombre", "Ana3", {}))).toBe("ERROR:formato");
    expect(ok(interpretarCampo("primerNombre", "J", {}))).toBe("ERROR:formato");
  });

  it("tipo de documento por alias", () => {
    expect(ok(interpretarCampo("tipoDocumento", "cc", {}))).toBe("CC");
    expect(ok(interpretarCampo("tipoDocumento", "Cédula de extranjería", {}))).toBe("CE");
    expect(ok(interpretarCampo("tipoDocumento", "ppt", {}))).toBe("PPT");
    expect(ok(interpretarCampo("tipoDocumento", "licencia", {}))).toBe("ERROR:no_encontrado");
  });

  it("documento: solo dígitos y 6 a 10 para CC", () => {
    expect(ok(interpretarCampo("numeroDocumento", "1.103.679.690", { tipoDocumento: "CC" }))).toBe("1103679690");
    expect(ok(interpretarCampo("numeroDocumento", "12345", { tipoDocumento: "CC" }))).toBe("ERROR:formato");
    expect(ok(interpretarCampo("numeroDocumento", "12345678901", { tipoDocumento: "CC" }))).toBe("ERROR:formato");
    expect(ok(interpretarCampo("numeroDocumento", "AB12345", { tipoDocumento: "PA" }))).toBe("AB12345");
    expect(soloDigitos("uno cero tres seis")).toBe("1036");
  });

  it("confirmación de documento: debe coincidir", () => {
    const v = { tipoDocumento: "CC" as const, numeroDocumento: "110367969" };
    expect(ok(interpretarCampo("confirmacionDocumento", "110367969", v))).toBe("110367969");
    expect(ok(interpretarCampo("confirmacionDocumento", "sí", v))).toBe("110367969");
    expect(ok(interpretarCampo("confirmacionDocumento", "110367968", v))).toBe("ERROR:no_coincide");
    expect(ok(interpretarCampo("confirmacionDocumento", "110367969", {}))).toBe("ERROR:falta_dependencia");
  });

  it("celular: 10 dígitos que empiezan por 3", () => {
    expect(ok(interpretarCampo("celular", "+57 310 456 7890", {}))).toBe("3104567890");
    expect(ok(interpretarCampo("celular", "310-456-78-90", {}))).toBe("3104567890");
    expect(ok(interpretarCampo("celular", "6021234567", {}))).toBe("ERROR:formato");
    expect(ok(interpretarCampo("celular", "31045678", {}))).toBe("ERROR:formato");
  });

  it("correo: formato y dictado por voz", () => {
    expect(ok(interpretarCampo("correo", "Ana.Perez@Ejemplo.com", {}))).toBe("ana.perez@ejemplo.com");
    expect(ok(interpretarCampo("correo", "domi rincon arroba gmail punto com", {}))).toBe("domirincon@gmail.com");
    expect(ok(interpretarCampo("correo", "ana.perez.ejemplo.com", {}))).toBe("ERROR:formato");
  });

  it("departamento y ciudad con DIVIPOLA", () => {
    expect(ok(interpretarCampo("departamento", "valle", {}))).toBe("76");
    expect(ok(interpretarCampo("departamento", "Antioquia", {}))).toBe("05");
    const cali = interpretarCampo("departamento", "Cali", {});
    expect(cali.ok && cali.extra).toEqual({ ciudad: "76001" });
    expect(ok(interpretarCampo("ciudad", "cali", { departamento: "76" }))).toBe("76001");
    expect(ok(interpretarCampo("ciudad", "Medellín", { departamento: "76" }))).toBe("ERROR:no_encontrado");
    // "La Unión" existe en varios departamentos: se pregunta, no se adivina.
    expect(ok(interpretarCampo("ciudad", "La Unión", {}))).toBe("ERROR:ambiguo");
  });

  it("actividad económica: código válido o sugerencias para elegir", () => {
    expect(ok(interpretarCampo("actividadEconomica", "2620", {}))).toBe("2620");
    expect(ok(interpretarCampo("actividadEconomica", "9999", {}))).toBe("ERROR:no_encontrado");
    const r = interpretarCampo("actividadEconomica", "vendo empanadas en la esquina", {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.codigo).toBe("requiere_accion");
      expect(r.opciones?.map((o) => o.valor)).toContain("5619");
    }
  });

  it("año y ventas", () => {
    const [y1] = aniosVentas();
    expect(ok(interpretarCampo("anioVentas", "el año pasado", {}))).toBe(y1);
    expect(ok(interpretarCampo("anioVentas", "1999", {}))).toBe("ERROR:fuera_de_rango");
    expect(ok(interpretarCampo("ventasUltimoAnio", "10 palos", {}))).toBe(10_000_000);
    const r = interpretarCampo("ventasUltimoAnio", "2 millones al mes", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect([r.codigo, r.propuesta]).toEqual(["periodo", 24_000_000]);
  });

  it("consentimientos: solo aceptación explícita", () => {
    expect(ok(interpretarCampo("aceptaPoliticaDatos", true, {}))).toBe(true);
    expect(ok(interpretarCampo("aceptaPoliticaDatos", "acepto", {}))).toBe(true);
    expect(ok(interpretarCampo("aceptaTerminos", "tal vez", {}))).toBe("ERROR:requiere_accion");
  });

  it("el esquema completo detecta incoherencias entre campos", () => {
    expect(esquemaValores.safeParse({ numeroDocumento: "123", confirmacionDocumento: "124" }).success).toBe(false);
    expect(esquemaValores.safeParse({ departamento: "05", ciudad: "76001" }).success).toBe(false);
    expect(esquemaValores.safeParse({ departamento: "76", ciudad: "76001" }).success).toBe(true);
  });
});

describe("nombres que no son nombres", () => {
  it("rechaza sí/no y saludos como apellido", () => {
    expect(interpretarCampo("primerApellido", "sí", {}).ok).toBe(false);
    expect(interpretarCampo("primerNombre", "hola", {}).ok).toBe(false);
    expect(interpretarCampo("primerApellido", "Silva", {}).ok).toBe(true);
  });
});
