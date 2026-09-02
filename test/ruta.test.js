const test = require("node:test");
const assert = require("node:assert/strict");
const { ordenarPorRuta } = require("../src/utils/ruta");

test("ordena la hoja diaria por hora y después por recorrido", () => {
  const pedidos = [
    { id: 1, fechaEntrega: "2026-09-07", horaDesde: "11:00", barrio: "Centro", direccion: "San Martín 10" },
    { id: 2, fechaEntrega: "2026-09-07", horaDesde: "09:00", barrio: "Alberdi", direccion: "Colón 500" },
    { id: 3, fechaEntrega: "2026-09-07", horaDesde: "09:00", barrio: "Centro", direccion: "Colón 200" },
    { id: 4, fechaEntrega: "2026-09-07", horaDesde: null, barrio: "Centro", direccion: "Colón 1" },
  ];
  const ordenados = ordenarPorRuta(pedidos, { Centro: 0, Alberdi: 1 });
  assert.deepEqual(ordenados.map((pedido) => pedido.id), [3, 2, 1, 4]);
});

test("en rangos de varios días respeta primero la fecha", () => {
  const pedidos = [
    { id: 1, fechaEntrega: "2026-09-08", horaDesde: "09:00", barrio: "Centro", direccion: "Uno 1" },
    { id: 2, fechaEntrega: "2026-09-07", horaDesde: "15:00", barrio: "Centro", direccion: "Dos 2" },
  ];
  assert.deepEqual(ordenarPorRuta(pedidos, { Centro: 0 }).map((pedido) => pedido.id), [2, 1]);
});
