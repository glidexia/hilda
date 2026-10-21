const test = require("node:test");
const assert = require("node:assert/strict");
const { distanciaKm, ordenarPorMatriz, ordenarPorRuta, ordenarPorRutaConCalles, numeroCalle } = require("../src/utils/ruta");

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

test("usa tiempos de manejo por calles aunque contradigan la distancia en línea recta", () => {
  const pedidos = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const matriz = [
    [0, 10, 1, 5],
    [10, 0, 8, 8],
    [1, 8, 0, 1],
    [5, 1, 1, 0],
  ];
  assert.deepEqual(ordenarPorMatriz(pedidos, matriz).map((pedido) => pedido.id), [2, 3, 1]);
  assert.equal(ordenarPorMatriz(pedidos, matriz.map((fila) => [...fila]).map((fila, indice) => indice === 0 ? [0, null, ...fila.slice(2)] : fila)), null);
});

test("cada número es la parada más cercana desde la anterior", () => {
  const pedidos = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const matriz = [
    [0, 1, 9, 9, 9],
    [1, 0, 2, 7, 8],
    [9, 2, 0, 3, 6],
    [9, 7, 3, 0, 4],
    [9, 8, 6, 4, 0],
  ];
  const ordenados = ordenarPorMatriz(pedidos, matriz);
  assert.deepEqual(ordenados.map((pedido) => pedido.id), [1, 2, 3, 4]);
  let actual = 0;
  const restantes = new Set([1, 2, 3, 4]);
  for (const pedido of ordenados) {
    const indice = pedidos.indexOf(pedido) + 1;
    const menor = Math.min(...[...restantes].map((candidato) => matriz[actual][candidato]));
    assert.equal(matriz[actual][indice], menor);
    restantes.delete(indice);
    actual = indice;
  }
});

test("consulta una sola matriz y conserva separadas las franjas", async () => {
  const origen = { latitud: -31.41, longitud: -64.2 };
  const pedidos = [
    { id: 1, fechaEntrega: "2026-10-21", horaDesde: "14:00", horaHasta: "17:00", barrio: "A", direccion: "A 100", latitud: -31.41, longitud: -64.19 },
    { id: 2, fechaEntrega: "2026-10-21", horaDesde: "10:00", horaHasta: "13:00", barrio: "B", direccion: "B 200", latitud: -31.41, longitud: -64.18 },
    { id: 3, fechaEntrega: "2026-10-21", horaDesde: "10:00", horaHasta: "13:00", barrio: "C", direccion: "C 300", latitud: -31.41, longitud: -64.17 },
  ];
  let consultas = 0;
  const obtenerMatriz = async (puntos) => {
    consultas += 1;
    assert.equal(puntos.length, 4);
    return [
      [0, 20, 5, 2],
      [20, 0, 1, 20],
      [5, 1, 0, 20],
      [2, 20, 20, 0],
    ];
  };
  const ordenados = await ordenarPorRutaConCalles(pedidos, {}, origen, obtenerMatriz);
  assert.equal(consultas, 1);
  assert.deepEqual(ordenados.map((pedido) => pedido.id), [3, 2, 1]);
});

test("vuelve a la geolocalización local cuando el ruteador no responde", async () => {
  const origen = { latitud: -31.41, longitud: -64.2 };
  const pedidos = [
    { id: 1, fechaEntrega: "2026-10-21", horaDesde: "10:00", barrio: "A", direccion: "A", latitud: -31.41, longitud: -64.1 },
    { id: 2, fechaEntrega: "2026-10-21", horaDesde: "10:00", barrio: "B", direccion: "B", latitud: -31.41, longitud: -64.19 },
  ];
  const ordenados = await ordenarPorRutaConCalles(pedidos, {}, origen, async () => null);
  assert.deepEqual(ordenados.map((pedido) => pedido.id), [2, 1]);
});
