import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { abrir, escribir, esperarRespuesta } from "./ayudas";

test("accesibilidad WCAG 2.1 AA (axe) en el asistente, modo oscuro, demo y Cómo funciona", async ({ page }) => {
  await abrir(page);
  await escribir(page, "Ana");
  for (const ruta of ["/", "/como-funciona", "/demo"]) {
    if (ruta !== "/") await page.goto(ruta);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(r.violations.map((v) => `${ruta}: ${v.id}`)).toEqual([]);
  }
  await page.goto("/");
  await page.getByRole("button", { name: /Modo oscuro/ }).first().click();
  await expect(page.locator("html")).toHaveClass(/alto-contraste/);
  const r = await new AxeBuilder({ page }).withTags(["wcag2aa"]).analyze();
  expect(r.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1] ?? ""}`))).toEqual([]);
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

test("la sesión se puede retomar al recargar y se puede cambiar entre Chat y Formulario", async ({ page }) => {
  await abrir(page);
  await escribir(page, "Luis");
  await page.reload();
  await expect(page.getByText("Retomamos donde iba.")).toBeVisible();
  // El mismo selector lleva al formulario completo (sin chat) y de vuelta.
  await page.getByRole("tab", { name: /Formulario \(/ }).click();
  await expect(page.getByLabel("Chat con el asistente")).toBeHidden();
  await expect(page.getByRole("button", { name: "Siguiente" })).toBeVisible();
  await expect(page.locator("[data-campo=primerNombre]")).toContainText("Luis");
  await page.getByRole("tab", { name: "Chat" }).click();
  await expect(page.getByLabel("Chat con el asistente")).toBeVisible();
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

test("modo solo chat: el formulario se oculta, se ve el avance y al final se revisa todo", async ({ page }) => {
  await abrir(page);
  await page.getByRole("button", { name: "Solo chat" }).click();
  await expect(page.getByLabel("Formulario de registro")).toBeHidden();
  await expect(page.getByText("Formulario oculto")).toBeVisible();
  await escribir(
    page,
    "Soy Andrés Gómez, cédula de ciudadanía 1020304050, género masculino, celular 310 456 7890, correo andres.gomez@ejemplo.com. " +
      "Sí tengo RUT y me enteré por redes sociales. Mi negocio queda en Medellín, Antioquia; prefiero que me contacten por WhatsApp. " +
      "No pertenezco a ninguna minoría. Desarrollo software, CIIU 6201. Mis ventas de 2025 fueron de 180 millones.",
  );
  await expect(page.getByText(/16\/19 datos/)).toBeVisible();
  for (const b of ["Sí, es correcto", "Acepto la política de datos", "Acepto los términos"]) {
    await page.getByRole("group", { name: "Respuestas rápidas" }).getByRole("button", { name: b }).click();
    await esperarRespuesta(page);
  }
  // Revisión final en el chat, con opción de corregir cada dato.
  await expect(page.getByText("¡Ya tenemos todo! Revise sus datos.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Corregir Ventas del último año/ })).toBeVisible();
  // La preferencia se conserva al recargar.
  await page.reload();
  await expect(page.getByText("Formulario oculto")).toBeVisible();
  await page.getByRole("button", { name: "Mostrar formulario" }).first().click();
  await expect(page.getByLabel("Formulario de registro")).toBeVisible();
});

test("la página no crece más que la ventana (sin espacio en blanco debajo)", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1015 });
  await abrir(page);
  await page.getByRole("button", { name: "Agrandar texto" }).click();
  for (const t of ["Ana", "Pérez", "cc", "12345678", "sí"]) await escribir(page, t);
  const { alto, ventana, desplazado } = await page.evaluate(() => ({ alto: document.documentElement.scrollHeight, ventana: innerHeight, desplazado: scrollY }));
  expect(alto).toBe(ventana);
  expect(desplazado).toBe(0);
});

test("vista Formulario: llenarlo uno mismo a pantalla completa, revisar y finalizar", async ({ page }) => {
  await abrir(page);
  await escribir(
    page,
    "Soy Andrés Gómez, cédula de ciudadanía 1020304050, género masculino, celular 310 456 7890, correo andres.gomez@ejemplo.com. " +
      "Sí tengo RUT y me enteré por redes sociales. Mi negocio queda en Medellín, Antioquia; prefiero que me contacten por WhatsApp. " +
      "No pertenezco a ninguna minoría. Desarrollo software, CIIU 6201. Mis ventas de 2025 fueron de 180 millones.",
  );
  await page.getByRole("tab", { name: /Formulario \(/ }).click();
  await expect(page.getByLabel("Chat con el asistente")).toBeHidden();
  await expect(page.getByText(/Está llenando el formulario usted mismo/)).toBeVisible();
  // Abre en el paso donde va la persona: falta confirmar el documento (Información general).
  await expect(page.getByRole("heading", { name: "Información general" })).toBeVisible();

  // Confirma el documento y acepta política y términos desde el formulario.
  await page.locator("[data-campo=numeroDocumento] button").click();
  await page.getByRole("dialog").getByRole("textbox").first().fill("1020304050");
  await page.getByRole("dialog").getByLabel("Confirma tu número de documento").fill("1020304050");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  await esperarRespuesta(page);
  await page.getByRole("button", { name: "Siguiente" }).click();
  await expect(page.getByRole("button", { name: /Revisar y finalizar/ })).toBeDisabled();
  for (const nombre of [/política de tratamiento/, /términos y condiciones/]) {
    await page.getByRole("checkbox", { name: nombre }).click();
    await page.getByRole("dialog").getByRole("checkbox").check();
    await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
    await esperarRespuesta(page);
  }

  // Revisión de todos los datos antes de finalizar, con opción de corregir.
  await page.getByRole("button", { name: /Revisar y finalizar/ }).click();
  const revision = page.getByRole("dialog", { name: "Revise sus datos antes de finalizar" });
  await expect(revision.getByText("$180.000.000")).toBeVisible();
  await expect(revision.getByRole("button", { name: /Corregir Ventas del último año/ })).toBeVisible();
  await revision.getByRole("button", { name: "Finalizar registro" }).click();
  await esperarRespuesta(page);

  // Vuelve al chat con la confirmación, el JSON y la encuesta.
  await expect(page.getByLabel("Chat con el asistente")).toBeVisible();
  await expect(page.getByText("Registro generado (modo demostración)")).toBeVisible();
});
