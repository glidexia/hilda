const test = require("node:test");
const assert = require("node:assert/strict");
const {
  inicioDelDia,
  hoy,
  ayer,
  manana,
  resolverFecha,
  sePuedeModificarPedido,
} = require("../src/utils/fechas");

test("usa el dia calendario de Buenos Aires aunque UTC ya haya cambiado", () => {
  const referencia = new Date("2026-08-20T01:30:00.000Z");
  assert.equal(hoy(referencia).toISOString(), "2026-08-19T00:00:00.000Z");
  assert.equal(ayer(referencia).toISOString(), "2026-08-18T00:00:00.000Z");
  assert.equal(manana(referencia).toISOString(), "2026-08-20T00:00:00.000Z");
});

test("cambia de dia a la medianoche argentina", () => {
  assert.equal(hoy(new Date("2026-08-20T02:59:59.999Z")).toISOString(), "2026-08-19T00:00:00.000Z");
  assert.equal(hoy(new Date("2026-08-20T03:00:00.000Z")).toISOString(), "2026-08-20T00:00:00.000Z");
});

test("valida fechas ISO reales", () => {
  assert.equal(inicioDelDia("2026-02-28").toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(resolverFecha("2026-02-29"), null);
  assert.equal(resolverFecha("fecha-invalida"), null);
});

test("permite modificar ayer y hoy, pero no manana", () => {
  const referencia = new Date("2026-08-19T15:00:00.000Z");
  assert.equal(sePuedeModificarPedido(new Date("2026-08-18T00:00:00.000Z"), referencia), true);
  assert.equal(sePuedeModificarPedido(new Date("2026-08-19T00:00:00.000Z"), referencia), true);
  assert.equal(sePuedeModificarPedido(new Date("2026-08-20T00:00:00.000Z"), referencia), false);
});
