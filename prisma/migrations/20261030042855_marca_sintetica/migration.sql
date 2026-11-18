-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PreguntaPendiente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "texto" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "veces" INTEGER NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "preguntaAprobada" TEXT,
    "respuesta" TEXT,
    "palabras" TEXT,
    "sintetica" BOOLEAN NOT NULL DEFAULT false,
    "creadaEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisadaEn" DATETIME
);
INSERT INTO "new_PreguntaPendiente" ("clave", "creadaEn", "estado", "id", "palabras", "preguntaAprobada", "respuesta", "revisadaEn", "texto", "veces") SELECT "clave", "creadaEn", "estado", "id", "palabras", "preguntaAprobada", "respuesta", "revisadaEn", "texto", "veces" FROM "PreguntaPendiente";
DROP TABLE "PreguntaPendiente";
ALTER TABLE "new_PreguntaPendiente" RENAME TO "PreguntaPendiente";
CREATE UNIQUE INDEX "PreguntaPendiente_clave_key" ON "PreguntaPendiente"("clave");
CREATE TABLE "new_SinonimoCiiu" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descripcion" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "veces" INTEGER NOT NULL DEFAULT 1,
    "sintetica" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);
INSERT INTO "new_SinonimoCiiu" ("actualizadoEn", "codigo", "creadoEn", "descripcion", "id", "veces") SELECT "actualizadoEn", "codigo", "creadoEn", "descripcion", "id", "veces" FROM "SinonimoCiiu";
DROP TABLE "SinonimoCiiu";
ALTER TABLE "new_SinonimoCiiu" RENAME TO "SinonimoCiiu";
CREATE UNIQUE INDEX "SinonimoCiiu_descripcion_codigo_sintetica_key" ON "SinonimoCiiu"("descripcion", "codigo", "sintetica");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
