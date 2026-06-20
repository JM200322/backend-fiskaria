-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'GUIA_DESPACHO', 'RETENCION_IVA', 'RETENCION_ISLR');

-- CreateTable
CREATE TABLE "puntos_emision" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puntos_emision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secuencias_documento" (
    "id" TEXT NOT NULL,
    "punto_emision_id" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "secuencias_documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "puntos_emision_contribuyente_id_idx" ON "puntos_emision"("contribuyente_id");

-- CreateIndex
CREATE UNIQUE INDEX "puntos_emision_contribuyente_id_codigo_key" ON "puntos_emision"("contribuyente_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "secuencias_documento_punto_emision_id_tipo_key" ON "secuencias_documento"("punto_emision_id", "tipo");

-- AddForeignKey
ALTER TABLE "puntos_emision" ADD CONSTRAINT "puntos_emision_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secuencias_documento" ADD CONSTRAINT "secuencias_documento_punto_emision_id_fkey" FOREIGN KEY ("punto_emision_id") REFERENCES "puntos_emision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
