const test = require("node:test");
const assert = require("node:assert/strict");
const errorHandler = require("../src/middleware/errorHandler");

function ejecutar(error) {
  const respuesta = { status: null, body: null };
  const res = {
    status(codigo) { respuesta.status = codigo; return this; },
    json(body) { respuesta.body = body; return this; },
  };
  const original = console.error;
  console.error = () => {};
  try { errorHandler(error, {}, res, () => {}); }
  finally { console.error = original; }
  return respuesta;
}

test("no expone detalles internos en errores del servidor", () => {
  const respuesta = ejecutar(new Error("Prisma P2003: detalle técnico sensible"));
  assert.equal(respuesta.status, 500);
  assert.equal(respuesta.body.error, "No pudimos completar la acción. Intentá nuevamente en unos minutos.");
  assert.doesNotMatch(respuesta.body.error, /Prisma|P2003/);
});

test("conserva los mensajes funcionales en errores controlados", () => {
  const error = new Error("Ese día ya está marcado como no hábil");
  error.status = 409;
  const respuesta = ejecutar(error);
  assert.equal(respuesta.status, 409);
  assert.equal(respuesta.body.error, error.message);
});
