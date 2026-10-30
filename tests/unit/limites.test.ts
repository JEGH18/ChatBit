import { describe, expect, it } from "vitest";
import { permitir } from "@/lib/servidor/limites";

describe("límites de uso en el servidor", () => {
  it("corta una sesión que supera el doble del límite visible de mensajes", () => {
    const sesion = crypto.randomUUID();
    let ultimo: ReturnType<typeof permitir> = { ok: true };
    for (let i = 0; i < 200 && ultimo.ok; i++) ultimo = permitir(`ip-${i}`, sesion);
    expect(ultimo).toEqual({ ok: false, motivo: "sesion" });
  });

  it("corta una IP con demasiadas peticiones por minuto", () => {
    let ultimo: ReturnType<typeof permitir> = { ok: true };
    for (let i = 0; i < 500 && ultimo.ok; i++) ultimo = permitir("10.0.0.1", crypto.randomUUID());
    expect(ultimo).toEqual({ ok: false, motivo: "ip" });
  });
});
