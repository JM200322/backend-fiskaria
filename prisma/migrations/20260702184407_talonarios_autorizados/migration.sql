-- CreateTable
CREATE TABLE "talonarios_autorizados" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "serie" VARCHAR(2) NOT NULL,
    "desde" INTEGER NOT NULL,
    "hasta" INTEGER NOT NULL,
    "consecutivoActual" INTEGER NOT NULL,
    "providencia_num" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talonarios_autorizados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "talonarios_autorizados_contribuyente_id_serie_idx" ON "talonarios_autorizados"("contribuyente_id", "serie");

-- AddForeignKey
ALTER TABLE "talonarios_autorizados" ADD CONSTRAINT "talonarios_autorizados_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
