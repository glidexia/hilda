const test = require("node:test");
const assert = require("node:assert/strict");
const { esImagenReal, LIMITE_BYTES } = require("../src/middleware/imagenes");

test("reconoce las firmas reales de JPG, PNG y WebP", () => {
  assert.equal(esImagenReal(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]), "image/jpeg"), true);
  assert.equal(esImagenReal(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]), "image/png"), true);
  assert.equal(esImagenReal(Buffer.from("RIFFxxxxWEBP", "ascii"), "image/webp"), true);
});

test("rechaza un archivo disfrazado de imagen", () => {
  assert.equal(esImagenReal(Buffer.from("esto no es una imagen"), "image/png"), false);
  assert.equal(LIMITE_BYTES, 5 * 1024 * 1024);
});
