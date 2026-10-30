// Clasificación CIIU asistida: la búsqueda léxica (con sinónimos aprendidos) propone candidatos y
// un modelo pequeño (Claude Haiku) los re-ordena según la descripción de la persona. El modelo solo
// puede elegir entre los candidatos del catálogo: nunca inventa códigos.
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { candidatosCiiu, sugerirCiiu, type SinonimoAprendido, type SugerenciaCiiu } from "@/lib/form/ciiu";
import { MODELO_CLASIFICACION, modeloClasificacion, opcionesProveedor } from "./modelo";

const esquema = z.object({
  codigos: z.array(z.string().regex(/^\d{4}$/)).min(1).max(3).describe("Los 3 códigos más probables, del más al menos probable"),
});

export async function clasificarCiiu(
  descripcion: string,
  aprendidos: SinonimoAprendido[] = [],
  modelo: LanguageModel | null = modeloClasificacion(),
): Promise<SugerenciaCiiu[]> {
  const candidatos = candidatosCiiu(descripcion, aprendidos, 12);
  if (candidatos.length <= 3 || !modelo) return sugerirCiiu(descripcion, aprendidos, 3);
  try {
    const { output } = await generateText({
      model: modelo,
      output: Output.object({ schema: esquema }),
      providerOptions: opcionesProveedor(MODELO_CLASIFICACION, "low"),
      maxOutputTokens: 2000,
      prompt: `Clasifica la actividad económica de un microempresario colombiano según la CIIU Rev. 4 A.C.
Descripción de la persona (puede tener errores o lenguaje coloquial): «${descripcion.slice(0, 300)}»

Elige los 3 códigos más probables, SOLO entre estos candidatos:
${candidatos.map((c) => `${c.codigo} - ${c.descripcion} (${c.simple})`).join("\n")}

Prefiere la actividad principal que la persona describe. Si vende comida preparada en la calle o en puestos, eso es 5619; si la prepara para que otros la vendan, es elaboración de alimentos.`,
    });
    const permitidos = new Map(candidatos.map((c) => [c.codigo, c]));
    const elegidos = [...new Set(output.codigos)].filter((c) => permitidos.has(c)).map((c) => permitidos.get(c)!);
    if (!elegidos.length) return sugerirCiiu(descripcion, aprendidos, 3);
    for (const c of candidatos) if (elegidos.length < 3 && !elegidos.includes(c)) elegidos.push(c);
    return elegidos.slice(0, 3);
  } catch {
    // Si el modelo de clasificación falla, la búsqueda léxica sigue funcionando.
    return sugerirCiiu(descripcion, aprendidos, 3);
  }
}
