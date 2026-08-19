const test = require("node:test");
const assert = require("node:assert/strict");
const { proximoDiaHabil } = require("../src/utils/diaHabil");

const sinFeriados = async () => null;
const iso = (fecha) => fecha.toISOString().slice(0, 10);

test("un pedido del jueves se entrega el viernes", async () => {
  const entrega = await proximoDiaHabil(new Date("2026-08-20T18:00:00.000Z"), sinFeriados);
  assert.equal(iso(entrega), "2026-08-21");
});

test("pedidos del viernes a la tarde, sabado y domingo se entregan el lunes", async () => {
  const referencias = [
    new Date("2026-08-21T21:00:00.000Z"), // viernes 18:00 en Argentina
    new Date("2026-08-22T15:00:00.000Z"), // sabado
    new Date("2026-08-23T15:00:00.000Z"), // domingo
  ];
  for (const referencia of referencias) {
    const entrega = await proximoDiaHabil(referencia, sinFeriados);
    assert.equal(iso(entrega), "2026-08-24");
  }
});

test("si el lunes es no habil, informa el martes", async () => {
  const lunes = "2026-08-24";
  const buscarFeriado = async (fecha) => (iso(fecha) === lunes ? { id: 1 } : null);
  const entrega = await proximoDiaHabil(new Date("2026-08-21T21:00:00.000Z"), buscarFeriado);
  assert.equal(iso(entrega), "2026-08-25");
});
