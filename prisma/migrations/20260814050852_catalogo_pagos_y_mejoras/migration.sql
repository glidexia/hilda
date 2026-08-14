-- CreateEnum
CREATE TYPE "SegmentoCliente" AS ENUM ('hogar', 'oficina_revendedor');

-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "choferes" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "pago_confirmado" TEXT,
ADD COLUMN     "segmento" "SegmentoCliente" NOT NULL DEFAULT 'hogar';

-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "categoria" "SegmentoCliente" NOT NULL DEFAULT 'hogar';

-- CreateTable
CREATE TABLE "configuracion" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "clave_area_privada" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pedidos_fecha_entrega_idx" ON "pedidos"("fecha_entrega");

-- CreateIndex
CREATE INDEX "productos_categoria_idx" ON "productos"("categoria");
