-- Reemplaza los dos segmentos anteriores por los tres catálogos comerciales actuales.
-- Se recrea el enum para que el cambio sea atómico y compatible con PostgreSQL.
ALTER TABLE "productos" ALTER COLUMN "categoria" DROP DEFAULT;
ALTER TABLE "pedidos" ALTER COLUMN "segmento" DROP DEFAULT;

CREATE TYPE "SegmentoCliente_nuevo" AS ENUM (
  'consumo_personal',
  'dispenser_frio_calor',
  'comercio_reventa'
);

ALTER TABLE "productos"
  ALTER COLUMN "categoria" TYPE "SegmentoCliente_nuevo"
  USING (
    CASE "categoria"::text
      WHEN 'hogar' THEN 'consumo_personal'
      WHEN 'oficina_revendedor' THEN 'comercio_reventa'
    END
  )::"SegmentoCliente_nuevo";

ALTER TABLE "pedidos"
  ALTER COLUMN "segmento" TYPE "SegmentoCliente_nuevo"
  USING (
    CASE "segmento"::text
      WHEN 'hogar' THEN 'consumo_personal'
      WHEN 'oficina_revendedor' THEN 'comercio_reventa'
    END
  )::"SegmentoCliente_nuevo";

DROP TYPE "SegmentoCliente";
ALTER TYPE "SegmentoCliente_nuevo" RENAME TO "SegmentoCliente";

ALTER TABLE "productos" ALTER COLUMN "categoria" SET DEFAULT 'consumo_personal';
ALTER TABLE "pedidos" ALTER COLUMN "segmento" SET DEFAULT 'consumo_personal';

-- Todo producto de dispenser que estaba dentro del catálogo combinado queda separado.
UPDATE "productos"
SET "categoria" = 'dispenser_frio_calor'
WHERE LOWER("nombre") LIKE '%dispenser%';
