/**
 * Genera data/ciiu/catalogo-completo.json con la Clasificación CIIU Rev. 4 A.C.
 *
 * Uso:
 *   npx tsx scripts/datos/importar-ciiu.ts                 # descarga de datos.gov.co (nuke-fusu, 499 clases)
 *   npx tsx scripts/datos/importar-ciiu.ts ruta/dane.csv   # CSV del DANE: columnas "codigo;descripcion" (o con coma)
 *
 * El DANE publica la estructura completa en https://www.dane.gov.co (Clasificaciones → CIIU Rev. 4 A.C.).
 * Descargue el Excel, exporte la hoja de "clases" (4 dígitos) a CSV con dos columnas (código y descripción)
 * y ejecute este script con la ruta. El subconjunto curado data/ciiu/frecuentes.json no se modifica.
 */
import { readFile, writeFile } from "node:fs/promises";

const FUENTE = "https://www.datos.gov.co/resource/nuke-fusu.json?$limit=5000";

type Clase = { codigo: string; descripcion: string };

const limpiar = (s: string) =>
  s.replace(/­/g, "").replace(/\s+/g, " ").trim().replace(/\.$/, "");

function desdeCsv(texto: string): Clase[] {
  const sep = texto.includes(";") ? ";" : ",";
  return texto
    .split(/\r?\n/)
    .map((l) => l.split(sep))
    .filter((c) => /^\d{4}$/.test((c[0] ?? "").replace(/"/g, "").trim()))
    .map((c) => ({ codigo: c[0].replace(/"/g, "").trim(), descripcion: limpiar(c.slice(1).join(sep).replace(/"/g, "")) }));
}

async function main() {
  const ruta = process.argv[2];
  let clases: Clase[];
  if (ruta) {
    clases = desdeCsv(await readFile(ruta, "utf8"));
  } else {
    const filas: { code: string; description: string }[] = await (await fetch(FUENTE)).json();
    clases = filas.map((f) => ({ codigo: f.code.trim(), descripcion: limpiar(f.description) }));
  }
  const unicos = [...new Map(clases.map((c) => [c.codigo, c])).values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  await writeFile(
    "data/ciiu/catalogo-completo.json",
    JSON.stringify({ fuente: ruta ? `archivo local ${ruta}` : "datos.gov.co nuke-fusu (CIIU Rev. 4 A.C.)", generado: new Date().toISOString().slice(0, 10), clases: unicos }, null, 0),
  );
  console.log(`CIIU: ${unicos.length} clases → data/ciiu/catalogo-completo.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
