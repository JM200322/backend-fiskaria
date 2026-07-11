-- AlterTable
ALTER TABLE "documentos_fiscales" ADD COLUMN     "imprenta_id" TEXT,
ADD COLUMN     "public_url" TEXT,
ADD COLUMN     "verification_hash" TEXT,
ADD COLUMN     "verification_url" TEXT;
