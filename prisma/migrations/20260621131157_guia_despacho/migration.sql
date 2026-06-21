-- AlterTable
ALTER TABLE "documento_items" ADD COLUMN     "peso_kg" DECIMAL(18,3);

-- AlterTable
ALTER TABLE "documentos_fiscales" ADD COLUMN     "datos_envio" JSONB;
