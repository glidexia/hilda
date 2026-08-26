-- Datos bancarios editables por el administrador y referencias privadas a archivos.
ALTER TABLE "configuracion"
ADD COLUMN "transferencia_titular" TEXT NOT NULL DEFAULT '',
ADD COLUMN "transferencia_banco" TEXT NOT NULL DEFAULT '',
ADD COLUMN "transferencia_alias" TEXT NOT NULL DEFAULT '',
ADD COLUMN "transferencia_cbu" TEXT NOT NULL DEFAULT '',
ADD COLUMN "transferencia_cuit" TEXT NOT NULL DEFAULT '';

ALTER TABLE "productos"
ADD COLUMN "imagen_key" TEXT,
ADD COLUMN "imagen_mime" TEXT;

ALTER TABLE "pedidos"
ADD COLUMN "comprobante_key" TEXT,
ADD COLUMN "comprobante_mime" TEXT,
ADD COLUMN "comprobante_fecha" TIMESTAMP(3);
