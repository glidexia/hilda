-- Convierte las franjas amplias existentes en turnos consecutivos de 60 minutos.
-- Los pedidos conservan la fecha y el horario copiados aunque su franja anterior
-- deje de existir, gracias a la relación ON DELETE SET NULL.
WITH "franjas_generadas" AS (
  SELECT
    h."zona_id",
    h."dia_semana",
    to_char(turno, 'HH24:MI') AS "hora_desde",
    to_char(turno + interval '1 hour', 'HH24:MI') AS "hora_hasta",
    h."cupo_maximo",
    h."activo"
  FROM "horarios_zona" h
  CROSS JOIN LATERAL generate_series(
    date '2000-01-01' + h."hora_desde"::time,
    date '2000-01-01' + h."hora_hasta"::time - interval '1 hour',
    interval '1 hour'
  ) AS turno
  WHERE h."hora_hasta"::time - h."hora_desde"::time > interval '1 hour'
)
INSERT INTO "horarios_zona" (
  "zona_id", "dia_semana", "hora_desde", "hora_hasta", "cupo_maximo", "activo", "updated_at"
)
SELECT
  "zona_id", "dia_semana", "hora_desde", "hora_hasta", "cupo_maximo", "activo", CURRENT_TIMESTAMP
FROM "franjas_generadas"
ON CONFLICT ("zona_id", "dia_semana", "hora_desde", "hora_hasta")
DO UPDATE SET
  "cupo_maximo" = EXCLUDED."cupo_maximo",
  "activo" = EXCLUDED."activo",
  "updated_at" = CURRENT_TIMESTAMP;

DELETE FROM "horarios_zona"
WHERE "hora_hasta"::time - "hora_desde"::time > interval '1 hour';
