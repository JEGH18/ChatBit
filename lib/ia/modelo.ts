// Configuración de los modelos de Claude (vía Vercel AI SDK + @ai-sdk/anthropic).
import { anthropic, type AnthropicLanguageModelOptions } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export const MODELO_PRINCIPAL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
export const MODELO_CLASIFICACION = process.env.ANTHROPIC_MODEL_CLASIFICACION || "claude-haiku-5-5";

/** Hay IA si existe la clave y no se forzó el modo guiado. */
export function iaDisponible(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && process.env.ASISTENTE_MODO !== "guiado";
}

export function modeloPrincipal(): LanguageModel {
  return anthropic(MODELO_PRINCIPAL);
}

export function modeloClasificacion(): LanguageModel {
  return anthropic(MODELO_CLASIFICACION);
}

type Esfuerzo = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Opciones del proveedor:
 * - effort bajo para conversación (menor latencia y costo; ajustable con ANTHROPIC_EFFORT).
 * - fallbacks "default": si los clasificadores de seguridad del modelo rechazan un turno, la API
 *   lo reintenta en el modelo de respaldo recomendado (solo Claude API, modelos que lo admiten).
 * - No se envía temperature: los modelos actuales rechazan valores distintos al predeterminado.
 */
export function opcionesProveedor(modelo: string, esfuerzo?: Esfuerzo) {
  const anthropicOpts: { effort: Esfuerzo; fallbacks?: "default" } = {
    effort: esfuerzo ?? ((process.env.ANTHROPIC_EFFORT as Esfuerzo | undefined) || "low"),
  };
  if (/sonnet-5-5|opus-5|fable-5/.test(modelo) && process.env.ANTHROPIC_FALLBACKS !== "off") anthropicOpts.fallbacks = "default";
  return { anthropic: anthropicOpts satisfies AnthropicLanguageModelOptions };
}
