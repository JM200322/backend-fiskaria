-- CreateTable
CREATE TABLE "terceros" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "rif" TEXT NOT NULL,
    "tipo_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "es_cliente" BOOLEAN NOT NULL DEFAULT true,
    "es_proveedor" BOOLEAN NOT NULL DEFAULT false,
    "rif_validado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "terceros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "terceros_contribuyente_id_idx" ON "terceros"("contribuyente_id");

-- CreateIndex
CREATE UNIQUE INDEX "terceros_contribuyente_id_rif_key" ON "terceros"("contribuyente_id", "rif");

-- AddForeignKey
ALTER TABLE "terceros" ADD CONSTRAINT "terceros_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
