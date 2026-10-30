/**
 * Compila la base de conocimiento (data/faq/*.md) a data/faq/indice.json.
 * Los Markdown son la fuente versionada; el índice JSON es lo que importa la app
 * (así funciona igual en local y en Vercel, sin leer el disco en tiempo de ejecución).
 *
 * Uso: npx tsx scripts/datos/compilar-faq.ts   (se ejecuta solo antes de dev y build)
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DIR = "data/faq";

async function main() {
  const archivos = (await readdir(DIR)).filter((f) => f.endsWith(".md")).sort();
  const entradas = [];
  for (const archivo of archivos) {
    const texto = await readFile(join(DIR, archivo), "utf8");
    const m = texto.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) throw new Error(`${archivo}: falta el encabezado --- ... ---`);
    const meta = Object.fromEntries(
      m[1].split("\n").map((l) => {
        const i = l.indexOf(":");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
      }),
    );
    if (!meta.id || !meta.pregunta) throw new Error(`${archivo}: id y pregunta son obligatorios`);
    entradas.push({
      id: meta.id,
      pregunta: meta.pregunta,
      palabras: (meta.palabras ?? "").split(",").map((p: string) => p.trim()).filter(Boolean),
      respuesta: m[2].trim(),
      fuente: `data/faq/${archivo}`,
    });
  }
  await writeFile(join(DIR, "indice.json"), JSON.stringify({ entradas }, null, 1));
  console.log(`Base de conocimiento: ${entradas.length} preguntas → ${DIR}/indice.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
