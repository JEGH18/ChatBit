import { describe, expect, it } from "vitest";
import { anualizar, estimarVentasAnuales, interpretarMonto } from "@/lib/form/dinero";

const valor = (s: string) => interpretarMonto(s)?.valor;

describe("parser de montos", () => {
  it.each([
    ["1.500.000", 1_500_000],
    ["10.000.000", 10_000_000],
    ["10,000,000", 10_000_000],
    ["$ 10 millones", 10_000_000],
    ["2 millones", 2_000_000],
    ["10 palos", 10_000_000],
    ["un palo", 1_000_000],
    ["palo y medio", 1_500_000],
    ["2,5 millones", 2_500_000],
    ["1.5 millones", 1_500_000],
    ["800 mil", 800_000],
    ["500 lucas", 500_000],
    ["15M", 15_000_000],
    ["800k", 800_000],
    ["1.200 millones", 1_200_000_000],
    ["dos millones", 2_000_000],
    ["dos millones y medio", 2_500_000],
    ["un millón doscientos mil", 1_200_000],
    ["quinientos mil pesos", 500_000],
    ["ciento veinte millones", 120_000_000],
    ["medio millón", 500_000],
    ["24000000", 24_000_000],
    ["24 000 000", 24_000_000],
    ["mil millones", 1_000_000_000],
  ])("%s → %d", (texto, esperado) => {
    expect(valor(texto)).toBe(esperado);
  });

  it("detecta el periodo", () => {
    expect(interpretarMonto("unos 2 millones al mes")).toEqual({ valor: 2_000_000, periodo: "mes" });
    expect(interpretarMonto("150 mil diarios")).toEqual({ valor: 150_000, periodo: "dia" });
    expect(interpretarMonto("como 600 mil a la semana")).toEqual({ valor: 600_000, periodo: "semana" });
    expect(interpretarMonto("30 millones en el año")).toEqual({ valor: 30_000_000, periodo: "anio" });
    expect(interpretarMonto("10 palos")?.periodo).toBeNull();
  });

  it("devuelve null si no hay cifra", () => {
    expect(interpretarMonto("no sé")).toBeNull();
    expect(interpretarMonto("")).toBeNull();
  });

  it("anualiza y estima con pasos visibles", () => {
    expect(anualizar(2_000_000, "mes")).toBe(24_000_000);
    expect(anualizar(500_000, "semana")).toBe(26_000_000);
    const est = estimarVentasAnuales({ ventaDiaria: 150_000, diasPorSemana: 6 })!;
    expect(est.total).toBe(Math.round(150_000 * 6 * 4.33 * 12));
    expect(est.pasos).toHaveLength(3);
  });
});
