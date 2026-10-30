import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Download } from "lucide-react";
import { BarraSegmentada, Barras, BarrasDobles, MapaCalor, SERIE_1, SERIE_2, Tile, VerTabla, fmtPct } from "@/components/admin/Graficos";
import { Ingreso } from "@/components/admin/Ingreso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminConfigurado, esAdmin } from "@/lib/admin/sesion";
import { calcularMetricas } from "@/lib/analitica/metricas";
import { repositorio } from "@/lib/datos";
import { claseCiiu } from "@/lib/form/ciiu";
import { aprobarPregunta, borrarSinteticos, cargarSinteticos, descartarPregunta, salir } from "./acciones";

export const metadata: Metadata = { title: "Panel · Asistente Neo" };
export const dynamic = "force-dynamic";

function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{titulo}</h2>
      {descripcion && <p className="mt-0.5 text-sm text-muted-foreground">{descripcion}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function PanelAdmin() {
  if (!(await esAdmin())) return <Ingreso configurado={adminConfigurado()} />;
  const repo = await repositorio();
  const m = calcularMetricas(await repo.datosPanel());
  const t = m.totales;

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="flex flex-wrap items-center gap-3 bg-[var(--neo-morado)] px-5 py-3 text-white">
        <div className="flex-1">
          <h1 className="text-xl font-extrabold">Panel del Asistente Neo</h1>
          <p className="text-sm text-white/85">
            Analítica anonimizada · almacenamiento: {repo.nombre}
            {m.sinteticas > 0 && ` · incluye ${m.sinteticas} sesiones sintéticas de demostración`}
          </p>
        </div>
        <form action={cargarSinteticos}>
          <Button size="sm" variant="secondary">
            Cargar datos sintéticos
          </Button>
        </form>
        {m.sinteticas > 0 && (
          <form action={borrarSinteticos}>
            <Button size="sm" variant="secondary">
              Borrar sintéticos
            </Button>
          </form>
        )}
        <form action={salir}>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
            Salir
          </Button>
        </form>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 p-5">
        <p className="rounded-xl border border-border bg-card p-3 text-sm">
          🔒 Aquí no hay datos personales: los eventos solo registran el campo, el tipo de error y el canal. Las preguntas y descripciones se guardan anonimizadas.{" "}
          <Link href="/como-funciona" className="font-semibold underline">
            Cómo funciona
          </Link>
        </p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Tile etiqueta="Sesiones iniciadas" valor={t.sesiones.toLocaleString("es-CO")} />
          <Tile etiqueta="Tasa de finalización" valor={fmtPct(t.tasaFinalizacion)} detalle={`${t.finalizadas} registros`} />
          <Tile etiqueta="Tiempo mediano" valor={t.tiempoMedianoMin === null ? "—" : `${t.tiempoMedianoMin.toFixed(1)} min`} detalle="de inicio a registro" />
          <Tile etiqueta="Satisfacción (🙂)" valor={fmtPct(t.csatPositivo)} detalle={`${t.respuestasEncuesta} respuestas · prom. ${t.csatPromedio ?? "—"}/3`} />
          <Tile etiqueta="Escalamiento a asesor" valor={fmtPct(t.escalamiento)} />
          <Tile etiqueta="Ventas diligenciadas" valor={fmtPct(t.completitudVentas)} />
          <Tile etiqueta="CIIU diligenciado" valor={fmtPct(t.completitudCiiu)} />
          <Tile etiqueta="Usó voz" valor={fmtPct(t.usoVoz)} />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Seccion titulo="Embudo por campo" descripcion="Porcentaje de sesiones que completaron cada campo, en el orden del formulario. A la derecha, cuántas abandonaron en ese campo.">
            <Barras
              filas={m.embudo.map((e) => ({
                etiqueta: `${e.paso}. ${e.etiqueta.replace(/^Al seleccionar, aceptas (nuestra|nuestros) /, "Acepta ")}`,
                valor: t.sesiones ? Math.round((e.completaron / t.sesiones) * 1000) / 10 : null,
                pista: `${e.etiqueta}: llegaron ${e.llegaron}, completaron ${e.completaron}, abandonaron ${e.abandonaron}${e.tiempoMedianoSeg !== null ? `, tiempo mediano ${Math.round(e.tiempoMedianoSeg)} s` : ""}`,
                extra: (
                  <span className={`inline-flex w-16 items-center justify-end gap-1 text-xs ${e.abandonaron ? "font-semibold" : "text-muted-foreground"}`}>
                    {e.abandonaron > 0 && <AlertTriangle className="size-3.5 text-[#b7791f]" aria-label="abandono" />}
                    {e.abandonaron} aband.
                  </span>
                ),
              }))}
            />
            <VerTabla>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th>Campo</th>
                    <th>Llegaron</th>
                    <th>Completaron</th>
                    <th>Abandonaron</th>
                    <th>Tiempo mediano</th>
                  </tr>
                </thead>
                <tbody>
                  {m.embudo.map((e) => (
                    <tr key={e.campo} className="border-t border-border">
                      <td>{e.etiqueta}</td>
                      <td>{e.llegaron}</td>
                      <td>{e.completaron}</td>
                      <td>{e.abandonaron}</td>
                      <td>{e.tiempoMedianoSeg === null ? "—" : `${Math.round(e.tiempoMedianoSeg)} s`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </VerTabla>
          </Seccion>

          <Seccion titulo="Campos con más fricción" descripcion="Errores de validación y solicitudes de ayuda por campo (conteos).">
            {m.friccion.length ? (
              <BarrasDobles
                filas={m.friccion.slice(0, 10).map((f) => ({ etiqueta: f.etiqueta, valores: [f.errores, f.ayudas] }))}
                series={[
                  { nombre: "Errores de validación", color: SERIE_1 },
                  { nombre: "Solicitudes de ayuda", color: SERIE_2 },
                ]}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
            )}
          </Seccion>
        </div>

        <Seccion
          titulo="Desempeño por segmento (justicia algorítmica)"
          descripcion="Porcentaje de sesiones de cada segmento que completaron cada campo. La edad solo se conoce si la persona la dio, de forma opcional y anónima, en la encuesta final: por eso los segmentos de edad solo incluyen a quienes terminaron (sesgo de supervivencia). El canal (voz o texto) sí cubre a todas las sesiones."
        >
          {m.completitud.alertas.length > 0 ? (
            <ul className="mb-4 space-y-1.5">
              {m.completitud.alertas.slice(0, 8).map((a) => (
                <li key={a} className="flex items-start gap-2 rounded-lg bg-[#fff6e0] p-2 text-sm text-[#5c3d00]">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <strong>Posible brecha:</strong> {a}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">Sin brechas de 15 puntos o más entre segmentos con al menos 5 sesiones.</p>
          )}
          <MapaCalor
            columnas={[...m.completitud.campos.map((c) => c.etiqueta.replace(/^Al seleccionar, aceptas (nuestra|nuestros) /, "Acepta ")), "Finalizó"]}
            filas={m.completitud.segmentos.map((s) => ({
              etiqueta: s.etiqueta,
              detalle: `${s.sesiones} sesiones`,
              valores: [...m.completitud.campos.map((c) => s.valores[c.campo]), s.finalizacion],
            }))}
          />
        </Seccion>

        <div className="grid gap-5 lg:grid-cols-2">
          <Seccion titulo="Satisfacción (CSAT)" descripcion="Respuestas a la encuesta de una pregunta al final del registro.">
            <BarraSegmentada
              etiqueta="Satisfacción"
              partes={[
                { nombre: "😞 Mala", valor: m.csat[1], color: "#c4502f" },
                { nombre: "😐 Regular", valor: m.csat[2], color: "#a3a19a", textoOscuro: true },
                { nombre: "🙂 Buena", valor: m.csat[3], color: SERIE_2 },
              ]}
            />
          </Seccion>
          <Seccion titulo="Finalización: chat vs. formulario manual" descripcion="Sesiones que usaron el formulario manual en algún momento, frente a las que solo conversaron.">
            <div className="grid grid-cols-2 gap-3">
              <Tile etiqueta="Solo chat" valor={fmtPct(m.finalizacionPorCanal.chat.tasa)} detalle={`${m.finalizacionPorCanal.chat.finalizadas} de ${m.finalizacionPorCanal.chat.sesiones}`} />
              <Tile etiqueta="Con formulario manual" valor={fmtPct(m.finalizacionPorCanal.manual.tasa)} detalle={`${m.finalizacionPorCanal.manual.finalizadas} de ${m.finalizacionPorCanal.manual.sesiones}`} />
            </div>
          </Seccion>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Seccion titulo="Bandeja de preguntas sin resolver" descripcion="Humano en el bucle: al aprobar una respuesta, el asistente la usa de inmediato. Descárguela en Markdown para versionarla en data/faq/.">
            {m.sinResolver.length === 0 && <p className="text-sm text-muted-foreground">No hay preguntas pendientes.</p>}
            <ul className="space-y-3">
              {m.sinResolver.slice(0, 12).map((p) => (
                <li key={p.id} className="rounded-xl border border-border p-3">
                  <p className="font-semibold">
                    «{p.texto}» <span className="text-sm font-normal text-muted-foreground">· {p.veces} {p.veces === 1 ? "vez" : "veces"}</span>
                  </p>
                  <form action={aprobarPregunta} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={p.id} />
                    <Input name="pregunta" defaultValue={p.texto.replace(/^¿?/, "¿").replace(/\??$/, "?")} aria-label="Pregunta como quedará en la base" />
                    <Textarea name="respuesta" required minLength={10} placeholder="Respuesta en lenguaje sencillo (sin prometer crédito)" aria-label="Respuesta" rows={2} />
                    <Input name="palabras" placeholder="Palabras clave separadas por coma" aria-label="Palabras clave" />
                    <div className="flex gap-2">
                      <Button size="sm" type="submit">
                        Aprobar y agregar a la base
                      </Button>
                      <Button size="sm" variant="ghost" formAction={descartarPregunta}>
                        Descartar
                      </Button>
                    </div>
                  </form>
                </li>
              ))}
            </ul>
            {m.aprobadas.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-bold">Aprobadas</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {m.aprobadas.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <span className="flex-1">{p.preguntaAprobada || p.texto}</span>
                      <a href={`/api/admin/faq/${p.id}`} className="inline-flex items-center gap-1 font-semibold underline">
                        <Download className="size-4" aria-hidden /> .md
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Seccion>

          <div className="space-y-5">
            <Seccion titulo="Preguntas frecuentes respondidas" descripcion="Veces que el asistente respondió con la base de conocimiento.">
              {m.faq.length ? (
                <Barras max={Math.max(...m.faq.map((f) => f.veces))} sufijo="" filas={m.faq.slice(0, 8).map((f) => ({ etiqueta: f.pregunta, valor: f.veces, pista: `${f.pregunta}: ${f.veces}` }))} />
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
              )}
            </Seccion>
            <Seccion titulo="Aprendizaje de actividades (CIIU)" descripcion="Pares descripción anonimizada → código que la persona confirmó. Mejoran las sugerencias siguientes (few-shot dinámico).">
              <div className="mb-3 grid grid-cols-3 gap-3">
                <Tile etiqueta="Confirmaciones" valor={String(m.ciiu.confirmaciones)} />
                <Tile etiqueta="Eligió la 1.ª opción" valor={fmtPct(m.ciiu.top1)} />
                <Tile etiqueta="Eligió entre las 3" valor={fmtPct(m.ciiu.top3)} />
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th>Descripción</th>
                    <th>Código</th>
                    <th className="text-right">Veces</th>
                  </tr>
                </thead>
                <tbody>
                  {m.ciiu.sinonimos.map((s) => (
                    <tr key={`${s.descripcion}-${s.codigo}-${s.sintetica ? "s" : "r"}`} className="border-t border-border">
                      <td>
                        {s.descripcion}
                        {s.sintetica && <span className="ml-1 rounded bg-muted px-1 text-xs text-muted-foreground">sintético · no alimenta el aprendizaje</span>}
                      </td>
                      <td title={claseCiiu(s.codigo)?.descripcion}>
                        {s.codigo} · {claseCiiu(s.codigo)?.corto ?? ""}
                      </td>
                      <td className="text-right tabular-nums">{s.veces}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Seccion>
          </div>
        </div>
      </main>
    </div>
  );
}
