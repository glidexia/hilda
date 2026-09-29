const test = require("node:test");
const assert = require("node:assert/strict");
const { resumirCarga } = require("../src/utils/carga");

test("resume carga programada y carga que todavia falta repartir", () => {
  const pedidos = [
    { estado: "pendiente", items: [{ productoNombre: "Bidón 20L", cantidad: 10 }] },
    { estado: "pendiente", items: [{ productoNombre: "Bidón 20L", cantidad: 20 }, { productoNombre: "Soda", cantidad: 55 }] },
    { estado: "entregado", items: [{ productoNombre: "Bidón 20L", cantidad: 5 }] },
  ];
  assert.deepEqual(resumirCarga(pedidos), {
    pedidosProgramados: 3,
    pedidosPendientes: 2,
    programado: [{ nombre: "Soda", cantidad: 55 }, { nombre: "Bidón 20L", cantidad: 35 }],
    pendiente: [{ nombre: "Soda", cantidad: 55 }, { nombre: "Bidón 20L", cantidad: 30 }],
  });
});
