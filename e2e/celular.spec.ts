import { expect, test } from "@playwright/test";
import { abrir, escribir } from "./ayudas";

test("en celular: pestañas Chat / Formulario y objetivos táctiles grandes", async ({ page }) => {
  await abrir(page);
  await escribir(page, "Gloria");
  await page.getByRole("tab", { name: /Formulario \(1\/19\)/ }).click();
  await expect(page.locator("[data-campo=primerNombre]")).toContainText("Gloria");
  await page.getByRole("tab", { name: "Chat" }).click();
  const botones = page.getByRole("group", { name: "Respuestas rápidas" }).getByRole("button");
  for (const b of await botones.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
