// Las 3 personas de prueba completan el registro de punta a punta en la interfaz real.
import { expect, test, type Page } from "@playwright/test";
import { abrir, escribir, esperarRespuesta, hablar, simularVoz, tocar } from "./ayudas";

async function finalizarYVerificar(page: Page, esperado: Record<string, unknown>) {
  await expect(page.getByText("¡Ya tenemos todo! Revise sus datos.")).toBeVisible();
  await tocar(page, "Finalizar registro");
  await expect(page.getByText("Registro generado (modo demostración)")).toBeVisible();
  await expect(page.getByText(/Radicado DEMO-\d{8}-/)).toBeVisible();
  // El JSON descargado tiene la estructura del formulario y los datos esperados.
  const descarga = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar JSON" }).click();
  const archivo = await descarga;
  const json = JSON.parse(await (await archivo.createReadStream()).toArray().then((b) => Buffer.concat(b).toString("utf8")));
  expect(json).toMatchObject(esperado);
  // Encuesta de una pregunta.
  await page.getByRole("radio", { name: /Buena/ }).click();
  await page.getByRole("button", { name: "Enviar opinión" }).click();
  await expect(page.getByText("¡Gracias! Su opinión nos ayuda a mejorar.")).toBeVisible();
}

test("Don Domiciano (67 años): respuestas cortas, errores de digitación y voz", async ({ page }) => {
  await simularVoz(page);
  await abrir(page);
  // Accesibilidad: agranda el texto y activa la lectura en voz alta.
  await page.getByRole("button", { name: "Agrandar texto" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-texto", "grande");

  await hablar(page, "domiciano");
  await hablar(page, "rincon");
  await hablar(page, "cedula");
  await hablar(page, "uno uno cero tres seis siete nueve seis nueve");
  await expect(page.getByText("110.367.969")).toBeVisible(); // lee el número en grupos
  await hablar(page, "si");
  await hablar(page, "masculino");
  await escribir(page, "310 456 78 9");
  await expect(page.getByText(/10 números y empezar por 3/)).toBeVisible();
  await escribir(page, "3104567890");
  await hablar(page, "no tengo correo");
  await expect(page.getByRole("button", { name: "¿Cómo creo un correo?" })).toBeVisible();
  await hablar(page, "domiciano punto rincon arroba gmail punto com");
  await hablar(page, "no");
  await hablar(page, "un vecino me conto");
  await hablar(page, "valle");
  await hablar(page, "cali");
  await hablar(page, "wasap");
  await hablar(page, "no");
  await hablar(page, "tengo una tienda de barrio");
  await expect(page.getByRole("group", { name: "Actividades sugeridas" })).toBeVisible();
  await hablar(page, "la primera");
  await hablar(page, "el año pasado");
  await tocar(page, "No sé, ayúdeme a calcular");
  await hablar(page, "doscientos mil");
  await tocar(page, "7 días");
  await expect(page.getByText("Así hice la cuenta:")).toBeVisible();
  await tocar(page, /^Sí, usar \$/);
  await tocar(page, "Acepto la política de datos");
  await tocar(page, "Acepto los términos");
  await finalizarYVerificar(page, {
    informacionGeneral: { primerNombre: "Domiciano", tipoDocumento: "CC", numeroDocumento: "110367969", numeroCelular: "3104567890", correoElectronico: "domiciano.rincon@gmail.com" },
    informacionFinanciera: { departamentoNegocio: "76", ciudadNegocio: "76001", medioContacto: "WHATSAPP", actividadEconomicaCiiu: "4711", ventasUltimoAnio: Math.round(200_000 * 7 * 4.33 * 12) },
    aceptaPoliticaTratamientoDatos: true,
    aceptaTerminosCondiciones: true,
  });
});

test("Marcela: emprendedora informal que no conoce el CIIU ni sus ventas anuales", async ({ page }) => {
  await abrir(page);
  await escribir(page, "Marcela Ospina");
  await expect(page.getByText(/primer nombre es \*?\*?Marcela/)).toBeVisible();
  await tocar(page, "Sí, así es");
  await tocar(page, "CÉDULA DE CIUDADANÍA");
  await escribir(page, "1020304050");
  await tocar(page, "Sí, es correcto");
  await tocar(page, "FEMENINO");
  await escribir(page, "3009876543");
  await escribir(page, "marcela.ospina@ejemplo.com");
  await tocar(page, "¿Qué es el RUT?");
  await expect(page.getByText(/registro de la DIAN/)).toBeVisible();
  await tocar(page, "No");
  await escribir(page, "por facebook");
  await escribir(page, "Antioquia");
  await escribir(page, "Bello");
  await tocar(page, "Llamada");
  await tocar(page, "Prefiero no responder");
  await escribir(page, "vendo almuerzos y empanadas desde mi casa");
  const tarjetas = page.getByRole("group", { name: "Actividades sugeridas" });
  await expect(tarjetas.getByRole("button")).toHaveCount(3);
  await tarjetas.getByRole("button", { name: /CIIU 5619/ }).click();
  await esperarRespuesta(page);
  await tocar(page, "2025");
  await escribir(page, "como 2 millones al mes");
  await expect(page.getByText("$24.000.000").first()).toBeVisible();
  await tocar(page, "Sí, usar $24.000.000");

  // Corrige un dato tocándolo en el formulario (vista previa).
  await page.locator("[data-campo=celular] button").click();
  await page.getByRole("dialog").getByRole("textbox").fill("3009876544");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar" }).click();
  await esperarRespuesta(page);
  await expect(page.getByText("Formulario · Número de celular: 3009876544")).toBeVisible();

  await tocar(page, "Acepto la política de datos");
  await tocar(page, "Acepto los términos");
  await finalizarYVerificar(page, {
    informacionGeneral: { primerNombre: "Marcela", primerApellido: "Ospina", numeroCelular: "3009876544", tieneRut: false, comoSeEntero: "REDES" },
    informacionFinanciera: { departamentoNegocio: "05", ciudadNegocio: "05088", perteneceMinoria: null, actividadEconomicaCiiu: "5619", ventasUltimoAnio: 24_000_000 },
  });
});

test("Andrés: usuario experto que entrega todo en un solo mensaje", async ({ page }) => {
  await abrir(page);
  await escribir(
    page,
    "Hola, soy Andrés Gómez, cédula de ciudadanía 1020304050, género masculino, celular 310 456 7890, correo andres.gomez@ejemplo.com. " +
      "Sí tengo RUT y me enteré por redes sociales. Mi negocio queda en Medellín, Antioquia; prefiero que me contacten por WhatsApp. " +
      "No pertenezco a ninguna minoría. Desarrollo software, CIIU 6201. Mis ventas de 2025 fueron de 180 millones.",
  );
  await expect(page.getByText(/Anoté 1[5-7] datos/)).toBeVisible();
  await expect(page.getByText("16 de 19 campos")).toBeVisible();
  await tocar(page, "Sí, es correcto");
  await tocar(page, "Acepto la política de datos");
  await tocar(page, "Acepto los términos");
  await finalizarYVerificar(page, {
    informacionGeneral: { primerNombre: "Andrés", primerApellido: "Gómez", tieneRut: true },
    informacionFinanciera: { ciudadNegocio: "05001", actividadEconomicaCiiu: "6201", anioVentas: 2025, ventasUltimoAnio: 180_000_000 },
  });
});
