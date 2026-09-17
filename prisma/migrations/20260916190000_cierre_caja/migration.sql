CREATE TABLE "cierres_caja" (
    "id" SERIAL NOT NULL,
    "camion_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "cerrado" BOOLEAN NOT NULL DEFAULT false,
    "chofer_nombre" TEXT NOT NULL DEFAULT '',
    "pedidos_entregados" INTEGER NOT NULL DEFAULT 0,
    "ventas_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "efectivo_cobrado" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transferencias_cobradas" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pendiente_cobro" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "productos_resumen" JSONB,
    "efectivo_declarado" DECIMAL(12,2),
    "observaciones" TEXT NOT NULL DEFAULT '',
    "cerrado_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cierres_caja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "extracciones_caja" (
    "id" SERIAL NOT NULL,
    "cierre_caja_id" INTEGER NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracciones_caja_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cierres_caja_camion_id_fecha_key" ON "cierres_caja"("camion_id", "fecha");
CREATE INDEX "cierres_caja_fecha_idx" ON "cierres_caja"("fecha");
CREATE INDEX "extracciones_caja_cierre_caja_id_idx" ON "extracciones_caja"("cierre_caja_id");

ALTER TABLE "cierres_caja" ADD CONSTRAINT "cierres_caja_camion_id_fkey"
FOREIGN KEY ("camion_id") REFERENCES "camiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "extracciones_caja" ADD CONSTRAINT "extracciones_caja_cierre_caja_id_fkey"
FOREIGN KEY ("cierre_caja_id") REFERENCES "cierres_caja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
