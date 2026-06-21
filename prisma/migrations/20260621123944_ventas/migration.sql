-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('COTIZACION', 'CONFIRMADA', 'FACTURADA', 'ANULADA');

-- CreateTable
CREATE TABLE "ventas" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "tercero_id" TEXT NOT NULL,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'COTIZACION',
    "total_estimado" DECIMAL(18,2) NOT NULL,
    "documento_fiscal_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta_items" (
    "id" TEXT NOT NULL,
    "venta_id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(18,3) NOT NULL,
    "precio" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "venta_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ventas_contribuyente_id_idx" ON "ventas"("contribuyente_id");

-- CreateIndex
CREATE INDEX "venta_items_venta_id_idx" ON "venta_items"("venta_id");

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_tercero_id_fkey" FOREIGN KEY ("tercero_id") REFERENCES "terceros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_items" ADD CONSTRAINT "venta_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
