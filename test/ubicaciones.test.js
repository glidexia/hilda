const test = require("node:test");
const assert = require("node:assert/strict");
const { actualizarUbicacion, obtenerUbicacion, listarUbicaciones, quitarUbicacion } = require("../src/services/ubicaciones");

test("guarda, lista y elimina la ubicación efímera de un camión", () => {
  const guardada = actualizarUbicacion(98765, { latitud: -31.41, longitud: -64.2, precisionMetros: 12.4 });
  assert.equal(guardada.camionId, 98765);
  assert.equal(guardada.precisionMetros, 12);
  assert.deepEqual(obtenerUbicacion(98765), guardada);
  assert.ok(listarUbicaciones().some((ubicacion) => ubicacion.camionId === 98765));
  quitarUbicacion(98765);
  assert.equal(obtenerUbicacion(98765), null);
});
