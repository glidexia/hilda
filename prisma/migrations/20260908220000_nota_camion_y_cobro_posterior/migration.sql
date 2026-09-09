-- La entrega y el cobro pueden registrarse en momentos distintos.
-- La nota del camión queda asociada al pedido para que también la vea administración.
ALTER TABLE "pedidos"
ADD COLUMN "nota_camion" TEXT NOT NULL DEFAULT '';
