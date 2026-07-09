-- CreateIndex
CREATE UNIQUE INDEX "productos_contribuyente_id_codigo_barras_key" ON "productos"("contribuyente_id", "codigo_barras");
