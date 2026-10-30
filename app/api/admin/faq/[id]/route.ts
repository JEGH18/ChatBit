// Descarga una respuesta aprobada en la bandeja como archivo Markdown, listo para versionar en data/faq/.
import { esAdmin } from "@/lib/admin/sesion";
import { repositorio } from "@/lib/datos";
import { normalizar } from "@/lib/texto";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await esAdmin())) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const repo = await repositorio();
  const p = (await repo.datosPanel()).preguntas.find((x) => x.id === Number(id) && x.estado === "aprobada");
  if (!p) return new Response("No encontrada", { status: 404 });
  const slug = normalizar(p.preguntaAprobada || p.texto).replace(/ /g, "-").slice(0, 50) || `pregunta-${p.id}`;
  const md = `---\nid: ${slug}\npregunta: ${p.preguntaAprobada || p.texto}\npalabras: ${p.palabras ?? ""}\n---\n${p.respuesta}\n`;
  return new Response(md, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.md"` },
  });
}
