/**
 * Compara los resultados de `npm run evals` con los mínimos de evals/umbrales.json.
 * Sale con código 1 si alguna métrica queda por debajo (regresión). Lo usa el CI.
 *
 *   npm run evals && npm run evals -- --dataset evals/dataset-prueba.json && npm run evals:umbrales
 */
import { readFile } from "node:fs/promises";

const umbrales = JSON.parse(await readFile("evals/umbrales.json", "utf8"));
let fallos = 0;

for (const [archivo, metricas] of Object.entries(umbrales)) {
  if (archivo.startsWith("_")) continue;
  const { informe } = JSON.parse(await readFile(archivo, "utf8"));
  for (const [ruta, minimo] of Object.entries(metricas)) {
    const valor = ruta.split(".").reduce((o, k) => o?.[k], informe);
    const ok = typeof valor === "number" && valor + 1e-9 >= minimo;
    if (!ok) fallos++;
    console.log(`${ok ? "✔" : "✘"} ${archivo} › ${ruta}: ${valor?.toFixed?.(3) ?? valor} (mínimo ${minimo})`);
  }
}

if (fallos) {
  console.error(`\n${fallos} métrica(s) por debajo del umbral.`);
  process.exit(1);
}
