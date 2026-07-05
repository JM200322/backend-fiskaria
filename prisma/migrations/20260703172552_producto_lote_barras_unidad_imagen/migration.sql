-- CreateEnum
CREATE TYPE "UnidadMedida" AS ENUM ('UNID', 'KG', 'LT', 'CAJA', 'SACO', 'PAQ');

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "codigo_barras" TEXT,
ADD COLUMN     "imagen_url" TEXT,
ADD COLUMN     "lote" TEXT,
ADD COLUMN     "unidad_medida" "UnidadMedida";
