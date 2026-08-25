const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SEGMENTOS_CLIENTE,
  SEGMENTO_POR_DEFECTO,
  esSegmentoValido,
} = require("../src/constants/segmentos");

test("expone exactamente los tres catálogos comerciales", () => {
  assert.deepEqual(SEGMENTOS_CLIENTE, [
    "consumo_personal",
    "dispenser_frio_calor",
    "comercio_reventa",
  ]);
  assert.equal(SEGMENTO_POR_DEFECTO, "consumo_personal");
});

test("rechaza las categorías anteriores y valores desconocidos", () => {
  assert.equal(esSegmentoValido("consumo_personal"), true);
  assert.equal(esSegmentoValido("dispenser_frio_calor"), true);
  assert.equal(esSegmentoValido("comercio_reventa"), true);
  assert.equal(esSegmentoValido("hogar"), false);
  assert.equal(esSegmentoValido("oficina_revendedor"), false);
  assert.equal(esSegmentoValido("otro"), false);
});
