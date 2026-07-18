-- CreateIndex
CREATE UNIQUE INDEX "compra_items_compra_id_producto_id_key" ON "compra_items"("compra_id", "producto_id");

-- CreateIndex
CREATE INDEX "compras_contribuyente_id_numero_factura_idx" ON "compras"("contribuyente_id", "numero_factura");
