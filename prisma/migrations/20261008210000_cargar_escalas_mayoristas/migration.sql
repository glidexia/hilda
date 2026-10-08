CREATE UNIQUE INDEX "producto_variantes_producto_id_cantidad_key"
ON "producto_variantes"("producto_id", "cantidad");

-- Carga las escalas de la lista mayorista vigente en los productos que ya
-- existían antes de incorporar variantes. ON CONFLICT permite aplicar la
-- migración sin duplicar una opción cargada manualmente por el administrador.
INSERT INTO "producto_variantes" ("producto_id", "nombre", "cantidad", "precio_unitario", "activo", "orden", "created_at", "updated_at")
SELECT p."id", v."nombre", v."cantidad", v."precio_unitario", true, v."orden", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "productos" p
JOIN (
  VALUES
    ('bidon 6 litros', 'x 15 unidades', 15, 1466.00::DECIMAL(10,2), 1),
    ('bidon 6 litros', 'x 50 unidades', 50, 1400.00::DECIMAL(10,2), 2),
    ('bidon 6 litros', 'x 100 unidades', 100, 1350.00::DECIMAL(10,2), 3),
    ('bidon 6 litros', 'Pallet · 150 unidades', 150, 1300.00::DECIMAL(10,2), 4),
    ('pack agua 2 litros', 'x 5 packs', 5, 5500.00::DECIMAL(10,2), 1),
    ('pack agua 2 litros', 'x 10 packs', 10, 5500.00::DECIMAL(10,2), 2),
    ('pack agua 500cc', 'x 5 packs', 5, 6700.00::DECIMAL(10,2), 1),
    ('pack agua 500cc', 'x 10 packs', 10, 6500.00::DECIMAL(10,2), 2),
    ('pack soda sifon 2 lts', 'x 10 packs', 10, 9500.00::DECIMAL(10,2), 1)
) AS v("producto", "nombre", "cantidad", "precio_unitario", "orden")
  ON lower(trim(p."nombre")) = v."producto"
WHERE p."categoria" = 'comercio_reventa'
ON CONFLICT ("producto_id", "cantidad") DO NOTHING;
