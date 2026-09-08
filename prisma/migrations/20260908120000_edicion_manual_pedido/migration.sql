ALTER TABLE "pedidos"
  ADD COLUMN "fecha_entrega_original" DATE,
  ADD COLUMN "fecha_reasignada_manual" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "nota_admin" TEXT NOT NULL DEFAULT '';
