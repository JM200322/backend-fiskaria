-- AlterTable
ALTER TABLE "movimientos_inventario" ADD COLUMN     "compra_item_id" TEXT;

-- CreateTable
CREATE TABLE "compra_items" (
    "id" TEXT NOT NULL,
    "compra_id" TEXT NOT NULL,
    "producto_id" TEXT NOT NULL,
    "cantidad" DECIMAL(18,3) NOT NULL,
    "costo_unitario" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compra_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compra_items_compra_id_idx" ON "compra_items"("compra_id");

-- CreateIndex
CREATE INDEX "compra_items_producto_id_idx" ON "compra_items"("producto_id");

-- CreateIndex
CREATE INDEX "movimientos_inventario_compra_item_id_idx" ON "movimientos_inventario"("compra_item_id");

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_compra_item_id_fkey" FOREIGN KEY ("compra_item_id") REFERENCES "compra_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_items" ADD CONSTRAINT "compra_items_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_items" ADD CONSTRAINT "compra_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
