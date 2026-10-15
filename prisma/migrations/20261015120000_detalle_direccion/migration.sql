ALTER TABLE "clientes"
ADD COLUMN "detalle_direccion" TEXT NOT NULL DEFAULT '';

ALTER TABLE "pedidos"
ADD COLUMN "detalle_direccion" TEXT NOT NULL DEFAULT '';
