const test = require("node:test");
const assert = require("node:assert/strict");
const { resolverItemProducto } = require("../src/utils/variantesProducto");

const productoMayorista = {
  id: 8,
  nombre: "Bidón 6 L",
  categoria: "comercio_reventa",
  precio: 1500,
  variantes: [
    { id: 41, nombre: "x 15 unidades", cantidad: 15, precioUnitario: 1466 },
    { id: 42, nombre: "x 50 unidades", cantidad: 50, precioUnitario: 1400 },
  ],
};

test("usa cantidad y precio unitario de la variante mayorista", () => {
  const item = resolverItemProducto(productoMayorista, { productoId: 8, varianteId: 41, cantidad: 15 });
  assert.equal(item.error, undefined);
  assert.equal(item.cantidad, 15);
  assert.equal(item.precioUnitario, 1466);
  assert.equal(item.nombre, "Bidón 6 L · x 15 unidades");
  assert.equal(item.cantidad * item.precioUnitario, 21990);
});

test("no permite cambiar manualmente la cantidad de una opción mayorista", () => {
  const item = resolverItemProducto(productoMayorista, { productoId: 8, varianteId: 41, cantidad: 14 });
  assert.match(item.error, /ya no coincide/);
});

test("un producto común conserva su precio y cantidad habituales", () => {
  const producto = { id: 2, nombre: "Bidón 20L", categoria: "consumo_personal", precio: 3200, variantes: [] };
  const item = resolverItemProducto(producto, { productoId: 2, cantidad: 3 });
  assert.equal(item.precioUnitario, 3200);
  assert.equal(item.cantidad, 3);
  assert.equal(item.nombre, "Bidón 20L");
});
