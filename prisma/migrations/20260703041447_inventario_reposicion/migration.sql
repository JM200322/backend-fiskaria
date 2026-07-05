-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "costo_ultimo" DECIMAL(18,2);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "cantidad" DECIMAL(18,3) NOT NULL,
    "costo_unitario" DECIMAL(18,2) NOT NULL,
    "costo_total" DECIMAL(18,2) NOT NULL,
    "iva_credito" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "referencia" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimientos_inventario_contribuyente_id_producto_id_idx" ON "movimientos_inventario"("contribuyente_id", "producto_id");

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
