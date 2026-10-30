// Formato ligero y seguro para los mensajes: **negrita**, [enlace](https://…), viñetas "• " y saltos de línea.
// No usa HTML crudo: todo se construye como nodos de React.
import { Fragment, type ReactNode } from "react";

function enLinea(texto: string, clave: string): ReactNode[] {
  const partes: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1]) partes.push(<strong key={`${clave}-b${i++}`}>{m[1]}</strong>);
    else
      partes.push(
        <a key={`${clave}-a${i++}`} href={m[3]} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
          {m[2]}
          <span className="sr-only"> (abre en otra pestaña)</span>
        </a>,
      );
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

export function Markdown({ texto }: { texto: string }) {
  const parrafos = texto.split(/\n{2,}/);
  return (
    <>
      {parrafos.map((p, i) => {
        const lineas = p.split("\n");
        const vinetas = lineas.filter((l) => /^\s*[•\-*]\s+/.test(l));
        if (vinetas.length && vinetas.length === lineas.length - (lineas[0] && !/^\s*[•\-*]\s+/.test(lineas[0]) ? 1 : 0)) {
          const intro = /^\s*[•\-*]\s+/.test(lineas[0]) ? null : lineas[0];
          return (
            <div key={i} className="mt-2 first:mt-0">
              {intro && <p>{enLinea(intro, `p${i}`)}</p>}
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {vinetas.map((l, j) => (
                  <li key={j}>{enLinea(l.replace(/^\s*[•\-*]\s+/, ""), `p${i}l${j}`)}</li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <p key={i} className="mt-2 first:mt-0">
            {lineas.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {enLinea(l, `p${i}l${j}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
