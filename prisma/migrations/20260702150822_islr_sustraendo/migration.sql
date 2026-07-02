-- CreateEnum
CREATE TYPE "CondicionFiscal" AS ENUM ('PNR', 'PNNR', 'PJD', 'PJND');

-- AlterTable
ALTER TABLE "comprobantes_retencion" ADD COLUMN     "condicion_fiscal" "CondicionFiscal",
ADD COLUMN     "sustraendo" DECIMAL(18,2) NOT NULL DEFAULT 0;
