-- CreateEnum
CREATE TYPE "TipoLugar" AS ENUM ('casa', 'oficina', 'empresa');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('pendiente', 'entregado', 'no_atendido');

-- CreateTable
CREATE TABLE "camiones" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#4FD1C5',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "camiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "choferes" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "camion_id" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "choferes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zonas" (
    "id" SERIAL NOT NULL,
    "barrio" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "camion_id" INTEGER,

    CONSTRAINT "zonas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "barrio" TEXT NOT NULL,
    "calle" TEXT NOT NULL,
    "tipo" "TipoLugar" NOT NULL DEFAULT 'casa',
    "pago" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL DEFAULT '',
    "precio" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "camion_id" INTEGER NOT NULL,
    "direccion" TEXT NOT NULL,
    "barrio" TEXT NOT NULL,
    "tipo" "TipoLugar" NOT NULL,
    "pago" TEXT NOT NULL,
    "fecha_entrega" DATE NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'pendiente',
    "reasignado_manual" BOOLEAN NOT NULL DEFAULT false,
    "total" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_items" (
    "id" SERIAL NOT NULL,
    "pedido_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "pedido_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dias_no_habiles" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "dias_no_habiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "choferes_usuario_key" ON "choferes"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "choferes_camion_id_key" ON "choferes"("camion_id");

-- CreateIndex
CREATE UNIQUE INDEX "zonas_barrio_key" ON "zonas"("barrio");

-- CreateIndex
CREATE INDEX "zonas_camion_id_idx" ON "zonas"("camion_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_usuario_key" ON "admins"("usuario");

-- CreateIndex
CREATE INDEX "clientes_barrio_idx" ON "clientes"("barrio");

-- CreateIndex
CREATE INDEX "pedidos_camion_id_fecha_entrega_idx" ON "pedidos"("camion_id", "fecha_entrega");

-- CreateIndex
CREATE INDEX "pedidos_cliente_id_idx" ON "pedidos"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "dias_no_habiles_fecha_key" ON "dias_no_habiles"("fecha");

-- AddForeignKey
ALTER TABLE "choferes" ADD CONSTRAINT "choferes_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "camiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zonas" ADD CONSTRAINT "zonas_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "camiones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_camion_id_fkey" FOREIGN KEY ("camion_id") REFERENCES "camiones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
