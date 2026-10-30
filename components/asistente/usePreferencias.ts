"use client";
// Preferencias: tamaño de texto, alto contraste (pastel), lectura en voz alta y modo solo chat.
// Se guardan en localStorage y se leen con useSyncExternalStore (sin desajustes de hidratación).
import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Preferencias = {
  texto: "normal" | "grande" | "muy-grande";
  contraste: boolean;
  leer: boolean;
  /** Oculta la vista previa del formulario: se llena solo conversando y se revisa al final. */
  soloChat: boolean;
};

const CLAVE = "asistente-neo:preferencias";
const INICIAL: Preferencias = { texto: "normal", contraste: false, leer: false, soloChat: false };
const EVENTO = "asistente-neo:preferencias";

let cache: { crudo: string | null; valor: Preferencias } = { crudo: null, valor: INICIAL };

function leer(): Preferencias {
  let crudo: string | null = null;
  try {
    crudo = localStorage.getItem(CLAVE);
  } catch {
    /* almacenamiento bloqueado */
  }
  if (crudo !== cache.crudo) {
    let valor = INICIAL;
    try {
      valor = { ...INICIAL, ...(crudo ? JSON.parse(crudo) : {}) };
    } catch {
      /* valor corrupto: se usan los iniciales */
    }
    cache = { crudo, valor };
  }
  return cache.valor;
}

function suscribir(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}

export function usePreferencias(): [Preferencias, (cambio: Partial<Preferencias>) => void] {
  const pref = useSyncExternalStore(suscribir, leer, () => INICIAL);

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.texto = pref.texto;
    html.classList.toggle("alto-contraste", pref.contraste);
  }, [pref]);

  const cambiar = useCallback((cambio: Partial<Preferencias>) => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ ...leer(), ...cambio }));
    } catch {
      /* nada */
    }
    window.dispatchEvent(new Event(EVENTO));
  }, []);

  return [pref, cambiar];
}
