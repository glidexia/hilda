const test = require("node:test");
const assert = require("node:assert/strict");
const { calcularCaja } = require("../src/utils/caja");

test("calcula la rendicion usando solo pedidos entregados y cantidades reales", () => {
  const caja = calcularCaja([
    {
      estado: "entregado",
      pagoConfirmado: "Efectivo",
      total: 12000,
      items: [{ productoNombre: "Bidon 20L", cantidad: 3, precioUnitario: 4000 }],
    },
    {
      estado: "entregado",
      pagoConfirmado: "Transferencia",
      total: 6000,
      items: [{ productoNombre: "Soda 2L", cantidad: 2, precioUnitario: 3000 }],
    },
    {
      estado: "entregado",
      pagoConfirmado: null,
      total: 4000,
      items: [{ productoNombre: "Bidon 20L", cantidad: 1, precioUnitario: 4000 }],
    },
    {
      estado: "pendiente",
      pagoConfirmado: "Efectivo",
      total: 99999,
      items: [{ productoNombre: "Bidon 20L", cantidad: 99, precioUnitario: 1000 }],
    },
  ], [{ monto: 2500 }, { monto: 500 }]);

  assert.deepEqual(caja, {
    pedidosEntregados: 3,
    ventasTotal: 22000,
    efectivoCobrado: 12000,
    transferenciasCobradas: 6000,
    pendienteCobro: 4000,
    extraccionesTotal: 3000,
    efectivoEsperado: 9000,
    productos: [
      { nombre: "Bidon 20L", cantidad: 4, total: 16000 },
      { nombre: "Soda 2L", cantidad: 2, total: 6000 },
    ],
  });
});
