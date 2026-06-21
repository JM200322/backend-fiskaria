-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO');

-- CreateEnum
CREATE TYPE "OrigenAsiento" AS ENUM ('AUTOMATICO', 'MANUAL');

-- CreateTable
CREATE TABLE "plan_cuentas" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_cuentas_contables" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,

    CONSTRAINT "config_cuentas_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asientos" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "glosa" TEXT NOT NULL,
    "origen" "OrigenAsiento" NOT NULL DEFAULT 'MANUAL',
    "documento_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asiento_lineas" (
    "id" TEXT NOT NULL,
    "asiento_id" TEXT NOT NULL,
    "cuenta_id" TEXT NOT NULL,
    "debe" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "haber" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "asiento_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_cuentas_contribuyente_id_idx" ON "plan_cuentas"("contribuyente_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_cuentas_contribuyente_id_codigo_key" ON "plan_cuentas"("contribuyente_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "config_cuentas_contables_contribuyente_id_evento_key" ON "config_cuentas_contables"("contribuyente_id", "evento");

-- CreateIndex
CREATE INDEX "asientos_contribuyente_id_idx" ON "asientos"("contribuyente_id");

-- CreateIndex
CREATE INDEX "asiento_lineas_asiento_id_idx" ON "asiento_lineas"("asiento_id");

-- AddForeignKey
ALTER TABLE "plan_cuentas" ADD CONSTRAINT "plan_cuentas_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_cuentas_contables" ADD CONSTRAINT "config_cuentas_contables_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_cuentas_contables" ADD CONSTRAINT "config_cuentas_contables_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "plan_cuentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asientos" ADD CONSTRAINT "asientos_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asiento_lineas" ADD CONSTRAINT "asiento_lineas_asiento_id_fkey" FOREIGN KEY ("asiento_id") REFERENCES "asientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asiento_lineas" ADD CONSTRAINT "asiento_lineas_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "plan_cuentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
