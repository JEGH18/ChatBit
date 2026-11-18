-- CreateTable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "creadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadaEn" DATETIME NOT NULL,
    "modo" TEXT NOT NULL DEFAULT 'guiado',
    "ultimoCampo" TEXT,
    "camposCompletos" INTEGER NOT NULL DEFAULT 0,
    "mensajes" INTEGER NOT NULL DEFAULT 0,
    "finalizada" BOOLEAN NOT NULL DEFAULT false,
    "finalizadaEn" DATETIME,
    "usoVoz" BOOLEAN NOT NULL DEFAULT false,
    "usoFormulario" BOOLEAN NOT NULL DEFAULT false,
    "escalada" BOOLEAN NOT NULL DEFAULT false,
    "rangoEdad" TEXT,
    "sintetica" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sesionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "campo" TEXT,
    "detalle" TEXT,
    "canal" TEXT,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evento_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "Sesion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Encuesta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sesionId" TEXT NOT NULL,
    "puntaje" INTEGER NOT NULL,
    "comentario" TEXT,
    "rangoEdad" TEXT,
    "creadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Encuesta_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "Sesion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PreguntaPendiente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "texto" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "veces" INTEGER NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "preguntaAprobada" TEXT,
    "respuesta" TEXT,
    "palabras" TEXT,
    "creadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisadaEn" DATETIME
);

-- CreateTable
CREATE TABLE "SinonimoCiiu" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descripcion" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "veces" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Evento_sesionId_idx" ON "Evento"("sesionId");

-- CreateIndex
CREATE INDEX "Evento_tipo_campo_idx" ON "Evento"("tipo", "campo");

-- CreateIndex
CREATE UNIQUE INDEX "Encuesta_sesionId_key" ON "Encuesta"("sesionId");

-- CreateIndex
CREATE UNIQUE INDEX "PreguntaPendiente_clave_key" ON "PreguntaPendiente"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "SinonimoCiiu_descripcion_codigo_key" ON "SinonimoCiiu"("descripcion", "codigo");
