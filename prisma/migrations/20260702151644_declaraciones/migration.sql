-- CreateEnum
CREATE TYPE "EstadoDeclaracion" AS ENUM ('PENDIENTE', 'DECLARADA', 'VERIFICADA');

-- CreateTable
CREATE TABLE "declaraciones" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "tipo" "TipoRetencion" NOT NULL,
    "periodo" TEXT NOT NULL,
    "debito_fiscal" DECIMAL(18,2) NOT NULL,
    "credito_fiscal" DECIMAL(18,2) NOT NULL,
    "retenciones" DECIMAL(18,2) NOT NULL,
    "monto_a_declarar" DECIMAL(18,2) NOT NULL,
    "estado" "EstadoDeclaracion" NOT NULL DEFAULT 'DECLARADA',
    "paquete" JSONB NOT NULL,
    "referencia" TEXT,
    "fecha_declaracion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "declaraciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "declaraciones_contribuyente_id_idx" ON "declaraciones"("contribuyente_id");

-- CreateIndex
CREATE UNIQUE INDEX "declaraciones_contribuyente_id_tipo_periodo_key" ON "declaraciones"("contribuyente_id", "tipo", "periodo");

-- AddForeignKey
ALTER TABLE "declaraciones" ADD CONSTRAINT "declaraciones_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
