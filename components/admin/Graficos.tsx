// Gráficos ligeros del panel, sin librerías: barras horizontales, barras agrupadas, barra
// segmentada y mapa de calor. Paleta validada (CVD, contraste y croma) con el validador dataviz:
// serie 1 #5b4fc0, serie 2 #0f9e83. El texto siempre usa tintas de texto, nunca el color del dato.
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export const SERIE_1 = "#5b4fc0";
export const SERIE_2 = "#0f9e83";
/** Rampa secuencial (un solo tono, claro → oscuro) para el mapa de calor. */
const RAMPA = ["#f1effb", "#ddd9f5", "#c2bbee", "#a196e3", "#7d6fd4", "#5b4fc0", "#43399a", "#2f2870"];

function Pista({ texto, children, className, style }: { texto: string; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span tabIndex={0} style={style} className={cn("group/pista relative inline-flex outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} aria-label={texto}>
      {children}
      <span role="tooltip" className="pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-1 w-max max-w-64 -translate-x-1/2 rounded-md bg-[#1d1c2e] px-2 py-1 text-xs text-white shadow group-hover/pista:visible group-focus/pista:visible">
        {texto}
      </span>
    </span>
  );
}

export function Tile({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{etiqueta}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-muted-foreground">{detalle}</p>}
    </div>
  );
}

export const fmtPct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${x.toLocaleString("es-CO", { maximumFractionDigits: 1 })}%`);

/** Barras horizontales de una sola serie (sin leyenda: el título dice qué se grafica). */
export function Barras({
  filas,
  max = 100,
  color = SERIE_1,
  sufijo = "%",
}: {
  filas: { etiqueta: string; valor: number | null; pista: string; extra?: ReactNode }[];
  max?: number;
  color?: string;
  sufijo?: string;
}) {
  return (
    <ul className="space-y-1.5">
      {filas.map((f) => (
        <li key={f.etiqueta} className="grid grid-cols-[minmax(8rem,14rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-muted-foreground" title={f.etiqueta}>
            {f.etiqueta}
          </span>
          <span className="relative flex h-5 border-l border-border">
            <Pista texto={f.pista} className="h-full" style={{ width: `${Math.max(0, Math.min(100, ((f.valor ?? 0) / (max || 1)) * 100))}%`, minWidth: f.valor ? 2 : 0 }}>
              <span className="block h-full w-full rounded-r-[4px]" style={{ backgroundColor: color }} />
            </Pista>
          </span>
          <span className="flex min-w-14 items-center justify-end gap-2 tabular-nums">
            {f.valor === null ? "—" : `${f.valor.toLocaleString("es-CO", { maximumFractionDigits: 1 })}${sufijo}`}
            {f.extra}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Dos series por fila (p. ej. errores y ayudas). Leyenda siempre visible. */
export function BarrasDobles({ filas, series }: { filas: { etiqueta: string; valores: number[] }[]; series: { nombre: string; color: string }[] }) {
  const max = Math.max(1, ...filas.flatMap((f) => f.valores));
  return (
    <div>
      <Leyenda series={series} />
      <ul className="mt-2 space-y-2.5">
        {filas.map((f) => (
          <li key={f.etiqueta} className="grid grid-cols-[minmax(8rem,14rem)_1fr] items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground" title={f.etiqueta}>
              {f.etiqueta}
            </span>
            <span className="space-y-[2px] border-l border-border">
              {series.map((s, i) => (
                <span key={s.nombre} className="flex items-center gap-2">
                  <Pista texto={`${f.etiqueta} · ${s.nombre}: ${f.valores[i]}`} className="h-3.5" >
                    <span className="block h-3.5 rounded-r-[4px]" style={{ width: `${(f.valores[i] / max) * 18}rem`, minWidth: f.valores[i] ? 2 : 0, backgroundColor: s.color }} />
                  </Pista>
                  <span className="text-xs tabular-nums text-muted-foreground">{f.valores[i]}</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Leyenda({ series }: { series: { nombre: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-4 text-sm" aria-label="Leyenda">
      {series.map((s) => (
        <li key={s.nombre} className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
          {s.nombre}
        </li>
      ))}
    </ul>
  );
}

/** Una totalidad dividida en partes (≤ 6). Barra alta de 28 px con la proporción impresa si cabe. */
export function BarraSegmentada({ partes, etiqueta }: { partes: { nombre: string; valor: number; color: string; textoOscuro?: boolean }[]; etiqueta: string }) {
  const total = partes.reduce((a, p) => a + p.valor, 0);
  if (!total) return <p className="text-sm text-muted-foreground">Sin respuestas todavía.</p>;
  return (
    <div>
      <div className="flex h-7 w-full gap-[2px]" role="img" aria-label={`${etiqueta}: ${partes.map((p) => `${p.nombre} ${Math.round((p.valor / total) * 100)}%`).join(", ")}`}>
        {partes
          .filter((p) => p.valor > 0)
          .map((p) => {
            const share = Math.round((p.valor / total) * 100);
            return (
              <Pista key={p.nombre} texto={`${p.nombre}: ${p.valor} (${share}%)`} className="h-full" style={{ width: `${(p.valor / total) * 100}%`, minWidth: 4 }}>
                <span
                  className={cn("flex h-full w-full items-center rounded-[4px] px-2 text-xs font-semibold", p.textoOscuro ? "text-[#0b0b0b]" : "text-white")}
                  style={{ backgroundColor: p.color }}
                >
                  {share >= 12 ? `${share}%` : ""}
                </span>
              </Pista>
            );
          })}
      </div>
      <div className="mt-2">
        <Leyenda series={partes.map((p) => ({ nombre: p.nombre, color: p.color }))} />
      </div>
    </div>
  );
}

/** Mapa de calor: filas × columnas con una rampa secuencial; el texto cambia de tinta según el fondo. */
export function MapaCalor({
  filas,
  columnas,
}: {
  filas: { etiqueta: string; detalle?: string; valores: (number | null)[] }[];
  columnas: string[];
}) {
  const color = (v: number) => RAMPA[Math.min(RAMPA.length - 1, Math.floor((v / 100) * RAMPA.length))];
  const oscuro = (v: number) => Math.floor((v / 100) * RAMPA.length) < 4;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card p-1 text-left font-semibold">Segmento</th>
            {columnas.map((c) => (
              <th key={c} className="max-w-20 p-1 text-left align-bottom font-normal text-muted-foreground">
                <span className="line-clamp-3">{c}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.etiqueta}>
              <th scope="row" className="sticky left-0 bg-card p-1 text-left font-semibold whitespace-nowrap">
                {f.etiqueta}
                {f.detalle && <span className="block font-normal text-muted-foreground">{f.detalle}</span>}
              </th>
              {f.valores.map((v, i) => (
                <td
                  key={i}
                  className={cn("min-w-11 rounded-[4px] p-1 text-center tabular-nums", v === null ? "bg-muted text-muted-foreground" : oscuro(v) ? "text-[#0b0b0b]" : "text-white")}
                  style={v === null ? undefined : { backgroundColor: color(v) }}
                  title={`${f.etiqueta} · ${columnas[i]}: ${v === null ? "sin datos" : `${v}%`}`}
                >
                  {v === null ? "—" : Math.round(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VerTabla({ children }: { children: ReactNode }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer font-semibold text-muted-foreground">Ver como tabla</summary>
      <div className="mt-2 overflow-x-auto">{children}</div>
    </details>
  );
}
