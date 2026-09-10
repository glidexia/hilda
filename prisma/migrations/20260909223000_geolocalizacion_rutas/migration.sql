-- Coordenadas persistidas para ordenar cada recorrido por cercanía real.
ALTER TABLE "configuracion"
  ADD COLUMN "direccion_base" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "latitud_base" DOUBLE PRECISION,
  ADD COLUMN "longitud_base" DOUBLE PRECISION;

ALTER TABLE "pedidos"
  ADD COLUMN "latitud" DOUBLE PRECISION,
  ADD COLUMN "longitud" DOUBLE PRECISION;
