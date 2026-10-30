import type { Metadata } from "next";
import { Demo } from "@/components/demo/Demo";

export const metadata: Metadata = { title: "Modo demo · Asistente Neo" };

export default function PaginaDemo() {
  return <Demo />;
}
