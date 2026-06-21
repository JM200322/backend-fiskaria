-- CreateTable
CREATE TABLE "retenciones_recibidas" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "tipo" "TipoRetencion" NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "agente_rif" TEXT NOT NULL,
    "agente_nombre" TEXT,
    "factura_ref" TEXT,
    "base" DECIMAL(18,2) NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retenciones_recibidas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "retenciones_recibidas_contribuyente_id_idx" ON "retenciones_recibidas"("contribuyente_id");

-- AddForeignKey
ALTER TABLE "retenciones_recibidas" ADD CONSTRAINT "retenciones_recibidas_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
