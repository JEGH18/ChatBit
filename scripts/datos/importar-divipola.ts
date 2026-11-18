/**
 * Descarga la lista DIVIPOLA (DANE) de departamentos y municipios desde datos.gov.co
 * y genera data/divipola.json en un formato compacto.
 *
 * Uso: npx tsx scripts/datos/importar-divipola.ts [ruta-a-json-local]
 * Fuente: https://www.datos.gov.co/resource/gdxc-w37w.json (DIVIPOLA – códigos municipios)
 */
import { readFile, writeFile } from "node:fs/promises";

const FUENTE = "https://www.datos.gov.co/resource/gdxc-w37w.json?$limit=2000";

type Fila = { cod_dpto: string; dpto: string; cod_mpio: string; nom_mpio: string };

async function main() {
  const local = process.argv[2];
  const filas: Fila[] = local
    ? JSON.parse(await readFile(local, "utf8"))
    : await (await fetch(FUENTE)).json();

  const deptos = new Map<string, { codigo: string; nombre: string; municipios: [string, string][] }>();
  for (const f of filas) {
    const d = deptos.get(f.cod_dpto) ?? { codigo: f.cod_dpto, nombre: f.dpto.trim(), municipios: [] };
    d.municipios.push([f.cod_mpio, f.nom_mpio.trim()]);
    deptos.set(f.cod_dpto, d);
  }
  const departamentos = [...deptos.values()]
    .map((d) => ({ ...d, municipios: d.municipios.sort((a, b) => a[1].localeCompare(b[1], "es")) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const total = departamentos.reduce((n, d) => n + d.municipios.length, 0);
  await writeFile(
    "data/divipola.json",
    JSON.stringify({ fuente: "DANE – DIVIPOLA (datos.gov.co gdxc-w37w)", generado: new Date().toISOString().slice(0, 10), departamentos }),
  );
  console.log(`DIVIPOLA: ${departamentos.length} departamentos, ${total} municipios → data/divipola.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
