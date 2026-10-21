ALTER TABLE "pedidos"
ADD COLUMN "comprobante_tipo" TEXT,
ADD COLUMN "items_actualizados_at" TIMESTAMP(3);

UPDATE "pedidos"
SET "comprobante_tipo" = CASE
  WHEN "comprobante_key" IS NULL THEN NULL
  WHEN "pago_confirmado" = 'Remito' THEN 'Remito'
  ELSE 'Transferencia'
END;
