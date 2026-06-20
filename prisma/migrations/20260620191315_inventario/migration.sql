-- CreateEnum
CREATE TYPE "TipoProducto" AS ENUM ('ALMACENABLE', 'CONSUMIBLE', 'SERVICIO');

-- CreateTable
CREATE TABLE "categorias_fiscales" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "alicuota_iva" DECIMAL(5,2) NOT NULL,

    CONSTRAINT "categorias_fiscales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_comerciales" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_comerciales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" TEXT NOT NULL,
    "contribuyente_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoProducto" NOT NULL DEFAULT 'ALMACENABLE',
    "categoria_comercial_id" TEXT,
    "categoria_fiscal_id" TEXT NOT NULL,
    "iva_override" DECIMAL(5,2),
    "precio" DECIMAL(18,2) NOT NULL,
    "stock" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_proveedores" (
    "producto_id" TEXT NOT NULL,
    "tercero_id" TEXT NOT NULL,

    CONSTRAINT "productos_proveedores_pkey" PRIMARY KEY ("producto_id","tercero_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_fiscales_nombre_key" ON "categorias_fiscales"("nombre");

-- CreateIndex
CREATE INDEX "categorias_comerciales_contribuyente_id_idx" ON "categorias_comerciales"("contribuyente_id");

-- CreateIndex
CREATE UNIQUE INDEX "categorias_comerciales_contribuyente_id_nombre_key" ON "categorias_comerciales"("contribuyente_id", "nombre");

-- CreateIndex
CREATE INDEX "productos_contribuyente_id_idx" ON "productos"("contribuyente_id");

-- CreateIndex
CREATE UNIQUE INDEX "productos_contribuyente_id_codigo_key" ON "productos"("contribuyente_id", "codigo");

-- AddForeignKey
ALTER TABLE "categorias_comerciales" ADD CONSTRAINT "categorias_comerciales_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_contribuyente_id_fkey" FOREIGN KEY ("contribuyente_id") REFERENCES "contribuyentes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_comercial_id_fkey" FOREIGN KEY ("categoria_comercial_id") REFERENCES "categorias_comerciales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_fiscal_id_fkey" FOREIGN KEY ("categoria_fiscal_id") REFERENCES "categorias_fiscales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_proveedores" ADD CONSTRAINT "productos_proveedores_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_proveedores" ADD CONSTRAINT "productos_proveedores_tercero_id_fkey" FOREIGN KEY ("tercero_id") REFERENCES "terceros"("id") ON DELETE CASCADE ON UPDATE CASCADE;
