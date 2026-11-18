import { expect, type Page } from "@playwright/test";

/** Espera a que el asistente termine de responder. */
export async function esperarRespuesta(page: Page) {
  await expect(page.locator("[data-ocupado]").first()).toHaveAttribute("data-ocupado", "false");
}

export async function abrir(page: Page, ruta = "/") {
  await page.goto(ruta);
  await expect(page.getByText("¿Cuál es su primer nombre?")).toBeVisible({ timeout: 90_000 }); // primera compilación en modo dev
  await esperarRespuesta(page);
}

export async function escribir(page: Page, texto: string) {
  await page.locator("#mensaje").fill(texto);
  await page.locator("#mensaje").press("Enter");
  await esperarRespuesta(page);
}

/** Toca un botón de respuesta rápida. */
export async function tocar(page: Page, nombre: string | RegExp) {
  await page.getByRole("group", { name: "Respuestas rápidas" }).getByRole("button", { name: nombre }).click();
  await esperarRespuesta(page);
}

/** Simula la Web Speech API: cada vez que se toca el micrófono, "escucha" la siguiente frase. */
export async function simularVoz(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__frases = [] as string[];
    class ReconocimientoFalso {
      lang = "";
      interimResults = false;
      continuous = false;
      maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        const frase = (w.__frases as string[]).shift() ?? "";
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: frase }], { isFinal: true })] });
          this.onend?.();
        }, 150);
      }
      stop() {}
      abort() {}
    }
    w.SpeechRecognition = ReconocimientoFalso;
    w.webkitSpeechRecognition = ReconocimientoFalso;
  });
}

export async function hablar(page: Page, frase: string) {
  await page.evaluate((f) => ((window as unknown as { __frases: string[] }).__frases.push(f)), frase);
  await page.getByRole("button", { name: "Hablar (dictar por voz)" }).click();
  await expect(page.locator("ol li").filter({ hasText: frase }).last()).toBeVisible();
  await esperarRespuesta(page);
}

export async function campo(page: Page, etiqueta: string) {
  return page.locator(`[data-campo]`).filter({ has: page.getByText(etiqueta, { exact: true }) }).first();
}
