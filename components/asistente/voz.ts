"use client";
// Entrada por voz (Web Speech API, es-CO) y lectura en voz alta de las respuestas.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { textoPlano } from "@/lib/texto";

type Reconocimiento = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function crearReconocimiento(): Reconocimiento | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Reconocimiento; webkitSpeechRecognition?: new () => Reconocimiento };
  const Clase = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Clase ? new Clase() : null;
}

const sinSuscripcion = () => () => undefined;

export function useReconocimientoVoz(alTerminar: (texto: string) => void) {
  const soportado = useSyncExternalStore(
    sinSuscripcion,
    () => !!(window as unknown as Record<string, unknown>).SpeechRecognition || !!(window as unknown as Record<string, unknown>).webkitSpeechRecognition,
    () => false,
  );
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Reconocimiento | null>(null);
  const finalRef = useRef("");
  const callback = useRef(alTerminar);
  useLayoutEffect(() => {
    callback.current = alTerminar;
  });

  const detener = useCallback(() => rec.current?.stop(), []);

  const iniciar = useCallback(() => {
    const r = crearReconocimiento();
    if (!r) return;
    rec.current?.abort();
    rec.current = r;
    finalRef.current = "";
    r.lang = "es-CO";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let interino = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalRef.current += res[0].transcript;
        else interino += res[0].transcript;
      }
      setParcial((finalRef.current + interino).trim());
    };
    r.onerror = (e) => {
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "No tengo permiso para usar el micrófono. Puede escribir su respuesta."
          : e.error === "no-speech"
            ? "No le escuché. Toque el micrófono e intente de nuevo."
            : "No pude usar el micrófono. Puede escribir su respuesta.",
      );
    };
    r.onend = () => {
      setEscuchando(false);
      const texto = finalRef.current.trim();
      setParcial("");
      if (texto) callback.current(texto);
    };
    setError(null);
    setEscuchando(true);
    try {
      r.start();
    } catch {
      setEscuchando(false);
    }
  }, []);

  return { soportado, escuchando, parcial, error, iniciar, detener };
}

export function useLecturaVoz(activa: boolean) {
  const [hablando, setHablando] = useState(false);
  const voz = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const elegir = () => {
      const voces = window.speechSynthesis.getVoices();
      voz.current = voces.find((v) => v.lang === "es-CO") ?? voces.find((v) => v.lang.startsWith("es-US")) ?? voces.find((v) => v.lang.startsWith("es")) ?? null;
    };
    elegir();
    window.speechSynthesis.addEventListener("voiceschanged", elegir);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", elegir);
  }, []);

  const callar = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setHablando(false);
  }, []);

  const leer = useCallback(
    (texto: string, forzar = false) => {
      if ((!activa && !forzar) || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(textoPlano(texto).replace(/(\d)\.(?=\d{3})/g, "$1"));
      u.lang = "es-CO";
      u.rate = 0.92;
      if (voz.current) u.voice = voz.current;
      u.onstart = () => setHablando(true);
      u.onend = () => setHablando(false);
      u.onerror = () => setHablando(false);
      window.speechSynthesis.speak(u);
    },
    [activa],
  );

  useEffect(() => {
    if (!activa && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, [activa]);

  return { leer, callar, hablando };
}
