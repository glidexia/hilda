CREATE TABLE "producto_variantes" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producto_variantes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "producto_variantes_producto_id_orden_idx" ON "producto_variantes"("producto_id", "orden");

ALTER TABLE "producto_variantes" ADD CONSTRAINT "producto_variantes_producto_id_fkey"
FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
