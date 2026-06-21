-- CreateEnum
CREATE TYPE "EstatusDocumento" AS ENUM ('NO_ENVIADO', 'ENVIADO', 'ANULADO_POR_REVERSO', 'CONTINGENCIA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO_BS', 'DIVISAS', 'PAGO_MOVIL', 'TARJETA');

-- CreateTable
CREATE TABLE "documentos_fiscales" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "punto_emision_id" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "doc_num" TEXT NOT NULL,
    "numero_control" TEXT,
    "estatus" "EstatusDocumento" NOT NULL DEFAULT 'NO_ENVIADO',
    "cliente_tercero_id" TEXT NOT NULL,
    "documento_origen_id" TEXT,
    "reason_to" TEXT,
    "fecha" DATE NOT NULL,
    "hora" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VES',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "total_tax" DECIMAL(18,2) NOT NULL,
    "total_w_taxes" DECIMAL(18,2) NOT NULL,
    "igtf" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "tasa_bcv" DECIMAL(18,6) NOT NULL,
    "tasa_moneda" TEXT NOT NULL DEFAULT 'USD',
    "desglose_iva" JSONB NOT NULL,
    "third_party" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_fiscales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento_items" (
    "id" TEXT NOT NULL,
    "documento_id" TEXT NOT NULL,
    "producto_id" TEXT,
    "tipo_linea" TEXT NOT NULL DEFAULT 'item',
    "descripcion" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "cantidad" DECIMAL(18,3) NOT NULL,
    "costo_unit" DECIMAL(18,2) NOT NULL,
    "costo_total" DECIMAL(18,2) NOT NULL,
    "tax_elm" TEXT NOT NULL,
    "tax_percentage" TEXT NOT NULL,

    CONSTRAINT "documento_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_documento" (
    "id" TEXT NOT NULL,
    "documento_id" TEXT NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "es_divisa" BOOLEAN NOT NULL DEFAULT false,
    "referencia" TEXT,
    "banco" TEXT,
    "lote_pos" TEXT,

    CONSTRAINT "pagos_documento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentos_fiscales_contribuyente_id_idx" ON "documentos_fiscales"("contribuyente_id");

-- CreateIndex
CREATE INDEX "documentos_fiscales_cliente_tercero_id_idx" ON "documentos_fiscales"("cliente_tercero_id");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_fiscales_contribuyente_id_tipo_punto_emision_id__key" ON "documentos_fiscales"("contribuyente_id", "tipo", "punto_emision_id", "doc_num");

-- CreateIndex
CREATE INDEX "documento_items_documento_id_idx" ON "documento_items"("documento_id");

-- CreateIndex
CREATE INDEX "pagos_documento_documento_id_idx" ON "pagos_documento"("documento_id");

-- AddForeignKey
ALTER TABLE "documentos_fiscales" ADD CONSTRAINT "documentos_fiscales_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_fiscales" ADD CONSTRAINT "documentos_fiscales_punto_emision_id_fkey" FOREIGN KEY ("punto_emision_id") REFERENCES "puntos_emision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_fiscales" ADD CONSTRAINT "documentos_fiscales_cliente_tercero_id_fkey" FOREIGN KEY ("cliente_tercero_id") REFERENCES "terceros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_fiscales" ADD CONSTRAINT "documentos_fiscales_documento_origen_id_fkey" FOREIGN KEY ("documento_origen_id") REFERENCES "documentos_fiscales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_items" ADD CONSTRAINT "documento_items_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos_fiscales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_items" ADD CONSTRAINT "documento_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_documento" ADD CONSTRAINT "pagos_documento_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos_fiscales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
