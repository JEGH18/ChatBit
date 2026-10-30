import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { abrir, escribir, esperarRespuesta } from "./ayudas";

test("accesibilidad WCAG 2.1 AA (axe) en el asistente, alto contraste, demo y Cómo funciona", async ({ page }) => {
  await abrir(page);
  await escribir(page, "Ana");
  for (const ruta of ["/", "/como-funciona", "/demo"]) {
    if (ruta !== "/") await page.goto(ruta);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(r.violations.map((v) => `${ruta}: ${v.id}`)).toEqual([]);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Alto contraste" }).first().click();
  await expect(page.locator("html")).toHaveClass(/alto-contraste/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

test("aviso de IA visible, advertencia de fraude y nunca acepta claves", async ({ page }) => {
  await abrir(page);
  await expect(page.getByText(/asistente de inteligencia artificial/).first()).toBeVisible();
  await escribir(page, "mi clave del banco es 4321");
  await expect(page.getByText(/no comparta claves/i)).toBeVisible();
  await escribir(page, "¿cuánto cobran por el trámite?");
  await expect(page.getByText(/no cobra por el registro/i)).toBeVisible();
});

test("si se cae la red, el asistente sigue funcionando en el navegador", async ({ page }) => {
  await abrir(page);
  await page.route("**/api/chat", (r) => r.abort("internetdisconnected"));
  await escribir(page, "Rosa");
  await expect(page.getByText("Mucho gusto, Rosa.")).toBeVisible();
  await expect(page.getByText("Sin conexión · modo básico")).toBeVisible();
});

test("la sesión se puede retomar al recargar y se puede pasar al formulario manual", async ({ page }) => {
  await abrir(page);
  await escribir(page, "Luis");
  await page.reload();
  await expect(page.getByText("Retomamos donde iba.")).toBeVisible();
  await page.getByRole("button", { name: "Llenar el formulario yo" }).click();
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeVisible();
  await expect(page.locator("[data-campo=primerNombre]")).toContainText("Luis");
});

test("panel /admin: la bandeja convierte una pregunta sin respuesta en conocimiento", async ({ page }) => {
  await abrir(page);
  await escribir(page, "¿ustedes atienden los domingos en la sede de Tunja?");
  await expect(page.getByText(/Todavía no tengo una buena respuesta/)).toBeVisible();

  await page.goto("/admin");
  await page.getByLabel("Contraseña").fill("clave-e2e");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText("Embudo por campo")).toBeVisible();
  const tarjeta = page.locator("li").filter({ hasText: "atienden los domingos" }).first();
  await tarjeta.getByLabel("Respuesta").fill("Neocrédito es un canal digital: no tiene sedes de atención presencial. Puede registrarse aquí cualquier día.");
  await tarjeta.getByLabel("Palabras clave").fill("sede, sedes, oficina, domingos, presencial, atienden");
  await tarjeta.getByRole("button", { name: "Aprobar y agregar a la base" }).click();
  await expect(page.getByRole("heading", { name: "Aprobadas" })).toBeVisible();

  await page.goto("/");
  await esperarRespuesta(page);
  await escribir(page, "¿atienden en alguna sede los domingos?");
  await expect(page.getByText(/no tiene sedes de atención presencial/)).toBeVisible();
});
