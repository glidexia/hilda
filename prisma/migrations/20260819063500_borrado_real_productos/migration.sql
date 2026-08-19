-- Conserva una copia del nombre vendido para que el historial siga completo
-- aunque el administrador elimine luego el producto del catálogo.
ALTER TABLE "pedido_items" ADD COLUMN "producto_nombre" TEXT;

UPDATE "pedido_items" AS item
SET "producto_nombre" = producto."nombre"
FROM "productos" AS producto
WHERE item."producto_id" = producto."id";

ALTER TABLE "pedido_items" ALTER COLUMN "producto_nombre" SET NOT NULL;
ALTER TABLE "pedido_items" DROP CONSTRAINT "pedido_items_producto_id_fkey";
ALTER TABLE "pedido_items" ALTER COLUMN "producto_id" DROP NOT NULL;
ALTER TABLE "pedido_items"
  ADD CONSTRAINT "pedido_items_producto_id_fkey"
  FOREIGN KEY ("producto_id") REFERENCES "productos"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
