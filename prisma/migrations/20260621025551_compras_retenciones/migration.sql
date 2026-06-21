-- CreateEnum
CREATE TYPE "EstatusCompra" AS ENUM ('REGISTRADA', 'PAGADA_PARCIAL', 'PAGADA_TOTAL');

-- CreateEnum
CREATE TYPE "TipoRetencion" AS ENUM ('IVA', 'ISLR');

-- CreateTable
CREATE TABLE "compras" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "proveedor_tercero_id" TEXT NOT NULL,
    "numero_factura" TEXT NOT NULL,
    "numero_control" TEXT,
    "fecha" DATE NOT NULL,
    "base" DECIMAL(18,2) NOT NULL,
    "iva_credito" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "estado" "EstatusCompra" NOT NULL DEFAULT 'REGISTRADA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_proveedor" (
    "id" TEXT NOT NULL,
    "compra_id" TEXT NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "referencia" TEXT,
    "fecha" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobantes_retencion" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "compra_id" TEXT,
    "tipo" "TipoRetencion" NOT NULL,
    "doc_num" TEXT NOT NULL,
    "numero_control" TEXT,
    "estatus" "EstatusDocumento" NOT NULL DEFAULT 'NO_ENVIADO',
    "periodo_year" TEXT NOT NULL,
    "periodo_month" TEXT NOT NULL,
    "beneficiario_tercero_id" TEXT NOT NULL,
    "fac_document_num" TEXT NOT NULL,
    "fac_control_num" TEXT NOT NULL,
    "base" DECIMAL(18,2) NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "monto_retenido" DECIMAL(18,2) NOT NULL,
    "concepto_islr" TEXT,
    "fecha" DATE NOT NULL,
    "hora" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobantes_retencion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compras_contribuyente_id_idx" ON "compras"("contribuyente_id");

-- CreateIndex
CREATE INDEX "pagos_proveedor_compra_id_idx" ON "pagos_proveedor"("compra_id");

-- CreateIndex
CREATE INDEX "comprobantes_retencion_contribuyente_id_idx" ON "comprobantes_retencion"("contribuyente_id");

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_retencion_contribuyente_id_tipo_doc_num_key" ON "comprobantes_retencion"("contribuyente_id", "tipo", "doc_num");

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_tercero_id_fkey" FOREIGN KEY ("proveedor_tercero_id") REFERENCES "terceros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_proveedor" ADD CONSTRAINT "pagos_proveedor_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_retencion" ADD CONSTRAINT "comprobantes_retencion_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_retencion" ADD CONSTRAINT "comprobantes_retencion_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_retencion" ADD CONSTRAINT "comprobantes_retencion_beneficiario_tercero_id_fkey" FOREIGN KEY ("beneficiario_tercero_id") REFERENCES "terceros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
