-- Consolida los antiguos turnos consecutivos de una hora en un único rango
-- diario por barrio. Los pedidos históricos conservan su horaDesde/horaHasta
-- copiada; solo se reemplaza la configuración disponible hacia adelante.
DO $$
DECLARE
  agenda RECORD;
  rango_id INTEGER;
BEGIN
  FOR agenda IN
    SELECT
      zona_id,
      dia_semana,
      MIN(hora_desde) AS hora_desde,
      MAX(hora_hasta) AS hora_hasta,
      MAX(cupo_maximo) AS cupo_maximo
    FROM horarios_zona
    WHERE activo = TRUE
    GROUP BY zona_id, dia_semana
  LOOP
    SELECT id INTO rango_id
    FROM horarios_zona
    WHERE zona_id = agenda.zona_id
      AND dia_semana = agenda.dia_semana
      AND hora_desde = agenda.hora_desde
      AND hora_hasta = agenda.hora_hasta
    ORDER BY id
    LIMIT 1;

    IF rango_id IS NULL THEN
      INSERT INTO horarios_zona
        (zona_id, dia_semana, hora_desde, hora_hasta, cupo_maximo, activo, created_at, updated_at)
      VALUES
        (agenda.zona_id, agenda.dia_semana, agenda.hora_desde, agenda.hora_hasta, agenda.cupo_maximo, TRUE, NOW(), NOW())
      RETURNING id INTO rango_id;
    ELSE
      UPDATE horarios_zona
      SET cupo_maximo = agenda.cupo_maximo, activo = TRUE, updated_at = NOW()
      WHERE id = rango_id;
    END IF;

    DELETE FROM horarios_zona
    WHERE zona_id = agenda.zona_id
      AND dia_semana = agenda.dia_semana
      AND activo = TRUE
      AND id <> rango_id;
  END LOOP;
END $$;
