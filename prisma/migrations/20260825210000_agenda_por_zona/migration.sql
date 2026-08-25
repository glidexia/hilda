-- Agenda configurable por barrio, notas y franjas aproximadas para los pedidos.
CREATE TABLE "horarios_zona" (
    "id" SERIAL NOT NULL,
    "zona_id" INTEGER NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "hora_desde" TEXT NOT NULL,
    "hora_hasta" TEXT NOT NULL,
    "cupo_maximo" INTEGER NOT NULL DEFAULT 6,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horarios_zona_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "horarios_zona_dia_semana_check" CHECK ("dia_semana" BETWEEN 1 AND 5),
    CONSTRAINT "horarios_zona_hora_desde_check" CHECK ("hora_desde" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT "horarios_zona_hora_hasta_check" CHECK ("hora_hasta" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    CONSTRAINT "horarios_zona_rango_check" CHECK ("hora_desde" < "hora_hasta"),
    CONSTRAINT "horarios_zona_cupo_check" CHECK ("cupo_maximo" BETWEEN 1 AND 100)
);

CREATE UNIQUE INDEX "horarios_zona_zona_id_dia_semana_hora_desde_hora_hasta_key"
ON "horarios_zona"("zona_id", "dia_semana", "hora_desde", "hora_hasta");

CREATE INDEX "horarios_zona_zona_id_dia_semana_activo_idx"
ON "horarios_zona"("zona_id", "dia_semana", "activo");

ALTER TABLE "horarios_zona"
ADD CONSTRAINT "horarios_zona_zona_id_fkey"
FOREIGN KEY ("zona_id") REFERENCES "zonas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pedidos"
ADD COLUMN "horario_zona_id" INTEGER,
ADD COLUMN "hora_desde" TEXT,
ADD COLUMN "hora_hasta" TEXT,
ADD COLUMN "notas" TEXT NOT NULL DEFAULT '';

CREATE INDEX "pedidos_horario_zona_id_fecha_entrega_idx"
ON "pedidos"("horario_zona_id", "fecha_entrega");

ALTER TABLE "pedidos"
ADD CONSTRAINT "pedidos_horario_zona_id_fkey"
FOREIGN KEY ("horario_zona_id") REFERENCES "horarios_zona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mantiene el sistema operativo inmediatamente después del despliegue. El administrador
-- puede borrar estas franjas iniciales y reemplazarlas por los días reales de cada barrio.
INSERT INTO "horarios_zona" ("zona_id", "dia_semana", "hora_desde", "hora_hasta", "cupo_maximo", "updated_at")
SELECT z."id", d."dia_semana", '09:00', '18:00', 8, CURRENT_TIMESTAMP
FROM "zonas" z
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS d("dia_semana")
ON CONFLICT DO NOTHING;

-- Mercado Pago deja de ofrecerse. Los pedidos históricos mantienen el texto original;
-- se normaliza la preferencia del cliente para sus pedidos futuros.
UPDATE "clientes" SET "pago" = 'Transferencia' WHERE "pago" = 'Mercado Pago';
