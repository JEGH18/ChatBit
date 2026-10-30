import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AvatarNeo } from "@/components/asistente/Avatar";
import { CONFIG } from "@/lib/config";

export const metadata: Metadata = { title: "Cómo funciona · Asistente Neo" };

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-xl font-bold text-primary">{titulo}</h2>
      <div className="mt-2 space-y-2 text-[1.05rem] leading-relaxed [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </section>
  );
}

export default function ComoFunciona() {
  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Link href="/" className="inline-flex min-h-11 items-center gap-1 font-semibold underline">
        <ArrowLeft className="size-4" aria-hidden /> Volver al asistente
      </Link>
      <header className="flex items-center gap-3">
        <AvatarNeo className="size-14" />
        <div>
          <h1 className="text-3xl font-extrabold">¿Cómo funciona el {CONFIG.nombreProducto}?</h1>
          <p className="text-muted-foreground">Explicado en lenguaje sencillo. Prototipo académico (Universidad Icesi), no es un servicio oficial.</p>
        </div>
      </header>

      <Bloque titulo="¿Qué es?">
        <p>
          Es un asistente con <strong>inteligencia artificial (IA)</strong> que le ayuda a llenar el formulario de registro de persona natural de Neocrédito, paso a paso, conversando. Puede
          escribir o hablar. A la derecha (o en la pestaña «Formulario») ve cómo se llena el formulario y puede corregir cualquier dato tocándolo. Si prefiere no
          verlo, toque «Solo chat»: lo llena conversando y al final revisa todos los datos antes de enviar. Y si prefiere llenarlo usted mismo, toque
          «Formulario»: lo verá completo, sin el chat.
        </p>
        <p>
          Está hablando con una máquina, no con una persona. Si prefiere una persona, escriba <strong>«asesor»</strong> en cualquier momento.
        </p>
      </Bloque>

      <Bloque titulo="¿Qué hace la IA?">
        <ul>
          <li>Entiende lo que usted escribe o dice, aunque lo diga con sus palabras («me llamo Ana y vivo en Cali», «10 palos al mes»).</li>
          <li>Le explica cada pregunta del formulario en palabras sencillas.</li>
          <li>Le propone las 3 actividades económicas (código CIIU) que más se parecen a su negocio, para que usted elija.</li>
          <li>Si no sabe cuánto vendió en el año, le ayuda a calcularlo y le muestra la cuenta.</li>
          <li>Responde preguntas frecuentes sobre Neocrédito.</li>
        </ul>
      </Bloque>

      <Bloque titulo="¿Qué NO hace?">
        <ul>
          <li>
            <strong>No decide si le dan un crédito</strong>, no evalúa su riesgo, no predice si lo aprueban ni cuánto le prestarían, y no le recomienda ninguna entidad u oferta.
          </li>
          <li>No le da un trato diferente por su género, edad, origen étnico, ciudad o tipo de negocio. Esto se revisa con pruebas automáticas.</li>
          <li>No le pide contraseñas, claves, códigos que le lleguen por mensaje ni números de tarjeta. Neocrédito no cobra por el trámite.</li>
          <li>No marca por usted la aceptación de la política de datos ni de los términos: eso siempre lo hace usted con un botón.</li>
        </ul>
      </Bloque>

      <Bloque titulo="¿Quién decide si un dato es válido?">
        <p>
          El programa, no la IA. La IA solo <em>propone</em> lo que entendió; reglas fijas revisan cada dato (por ejemplo, que el celular tenga 10 números y empiece por 3, o que el
          número de documento coincida al confirmarlo). Su número de documento se lee en grupos para que usted lo confirme. Antes de terminar, usted revisa todo en un resumen.
        </p>
      </Bloque>

      <Bloque titulo="¿Qué datos se guardan y dónde?">
        <ul>
          <li>
            <strong>En su celular o computador:</strong> lo que escribe y el formulario, para que pueda seguir si cierra la página. Se borra solo a las 24 horas, o antes con «Borrar
            mis datos de este dispositivo» (menú ⋯).
          </li>
          <li>
            <strong>En el servidor del prototipo:</strong> solo estadísticas sin datos personales (por ejemplo, «en el campo celular hubo un error de formato»), para mejorar el
            asistente. No se guarda su nombre, documento, celular, correo, género ni si pertenece a una minoría.
          </li>
          <li>
            <strong>Para entender sus mensajes</strong>, el texto que usted escribe se envía al servicio de IA (Claude, de Anthropic). El resumen del formulario que recibe la IA no
            incluye su documento, celular, correo, género ni pertenencia a minorías.
          </li>
          <li>En esta demostración el registro <strong>no se envía a Neocrédito</strong>: al final se genera un archivo con la estructura del formulario.</li>
        </ul>
      </Bloque>

      <Bloque titulo="¿Cómo aprende sin usar sus datos?">
        <ul>
          <li>No se entrena con sus datos personales.</li>
          <li>Las preguntas que no supo responder se guardan sin datos personales; una persona del equipo escribe la respuesta y, al aprobarla, el asistente la usa.</li>
          <li>Cuando usted elige su actividad económica, se guarda su descripción sin datos personales junto al código elegido, para sugerir mejor a la siguiente persona.</li>
          <li>Se mide en qué preguntas la gente se demora, se equivoca o abandona, y si el asistente funciona igual de bien para todas las edades y para quienes usan la voz.</li>
        </ul>
      </Bloque>

      <Bloque titulo="Sus derechos">
        <p>
          Según la Ley 1581 de 2012 (protección de datos personales) usted puede conocer, actualizar, corregir y pedir que se borren sus datos, y revocar su autorización. La Ley
          1266 de 2008 protege su información financiera. Este prototipo sigue además la guía de la Superintendencia de Industria y Comercio sobre IA y datos personales
          (Circular Externa 002 de 2024): avisa que usted habla con una IA, pide solo lo necesario y explica cómo funciona.
        </p>
        <p>
          ¿Necesita ayuda de una persona?{" "}
          <a className="font-semibold underline" href={`https://wa.me/${CONFIG.asesor.whatsapp}`} target="_blank" rel="noopener noreferrer">
            Escriba por WhatsApp
          </a>{" "}
          o llame al {CONFIG.asesor.telefono} ({CONFIG.asesor.horario}).
        </p>
      </Bloque>
    </main>
  );
}
