-- CreateEnum
CREATE TYPE "EstadoImpuesto" AS ENUM ('PENDIENTE', 'PAGADO');

-- CreateTable
CREATE TABLE "actividades_economicas" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "alicuota" DECIMAL(5,2) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actividades_economicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impuestos_municipales" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "actividad_id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "base" DECIMAL(18,2) NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "estado" "EstadoImpuesto" NOT NULL DEFAULT 'PENDIENTE',
    "referencia_pago" TEXT,
    "fecha_pago" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impuestos_municipales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "actividades_economicas_contribuyente_id_idx" ON "actividades_economicas"("contribuyente_id");

-- CreateIndex
CREATE UNIQUE INDEX "actividades_economicas_contribuyente_id_codigo_key" ON "actividades_economicas"("contribuyente_id", "codigo");

-- CreateIndex
CREATE INDEX "impuestos_municipales_contribuyente_id_idx" ON "impuestos_municipales"("contribuyente_id");

-- AddForeignKey
ALTER TABLE "actividades_economicas" ADD CONSTRAINT "actividades_economicas_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impuestos_municipales" ADD CONSTRAINT "impuestos_municipales_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impuestos_municipales" ADD CONSTRAINT "impuestos_municipales_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividades_economicas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
