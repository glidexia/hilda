const test = require("node:test");
const assert = require("node:assert/strict");
const { distanciaKm, ordenarPorRuta, numeroCalle } = require("../src/utils/ruta");

test("detecta la altura aunque haya departamento y barrio al final", () => {
  assert.equal(numeroCalle("Dean Funes 1653 3B - Alto Alberdi / Alberdi"), 1653);
  assert.equal(numeroCalle("9 de Julio 1234 - Centro"), 1234);
});

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

test("dentro de una franja parte del galpón y encadena pedidos por cercanía", () => {
  const origen = { latitud: -31.4100, longitud: -64.2000 };
  const pedidos = [
    { id: 1, fechaEntrega: "2026-09-10", horaDesde: "10:00", horaHasta: "13:00", barrio: "Las Palmas", direccion: "Lejano", latitud: -31.4100, longitud: -64.1000 },
    { id: 2, fechaEntrega: "2026-09-10", horaDesde: "10:00", horaHasta: "13:00", barrio: "Alberdi", direccion: "Al lado", latitud: -31.4100, longitud: -64.1950 },
    { id: 3, fechaEntrega: "2026-09-10", horaDesde: "10:00", horaHasta: "13:00", barrio: "Centro", direccion: "Intermedio", latitud: -31.4100, longitud: -64.1600 },
  ];
  const ordenados = ordenarPorRuta(pedidos, { "Las Palmas": 0, Centro: 1, Alberdi: 2 }, origen);
  assert.deepEqual(ordenados.map((pedido) => pedido.id), [2, 3, 1]);
});

test("la geolocalización nunca mezcla franjas horarias", () => {
  const origen = { latitud: -31.4100, longitud: -64.2000 };
  const pedidos = [
    { id: 1, fechaEntrega: "2026-09-10", horaDesde: "14:00", horaHasta: "17:00", barrio: "Cerca", direccion: "A", latitud: -31.4100, longitud: -64.1990 },
    { id: 2, fechaEntrega: "2026-09-10", horaDesde: "10:00", horaHasta: "13:00", barrio: "Lejos", direccion: "B", latitud: -31.4100, longitud: -64.1000 },
  ];
  assert.deepEqual(ordenarPorRuta(pedidos, {}, origen).map((pedido) => pedido.id), [2, 1]);
  assert.ok(distanciaKm(origen, pedidos[0]) < 1);
});
