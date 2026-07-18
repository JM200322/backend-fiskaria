-- Prevents two ComprobanteRetencion rows of the same tipo (IVA/ISLR) for the same compra,
-- closing the TOCTOU race window left by the findFirst-before-create check in
-- RetencionesService.emitir(). Partial (compraId IS NOT NULL) since compraId is nullable.
CREATE UNIQUE INDEX "comprobantes_retencion_compra_id_tipo_key" ON "comprobantes_retencion"("compra_id", "tipo") WHERE "compra_id" IS NOT NULL;
