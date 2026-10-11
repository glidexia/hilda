const test = require("node:test");
const assert = require("node:assert/strict");
const { detectarZonaEnResultado } = require("../src/services/geocodificacion");

test("detecta una zona agrupada aunque el geocodificador use tildes", () => {
  const resultado = {
    address: { suburb: "Nueva Córdoba", city: "Córdoba" },
    display_name: "Nueva Córdoba, Córdoba, Argentina",
  };
  const zonas = ["Nueva cordoba / Guemes / Terminal", "Zona Nueva Cordoba", "Alberdi"];
  assert.equal(detectarZonaEnResultado(resultado, zonas), "Nueva cordoba / Guemes / Terminal");
});

test("reconoce cualquiera de los barrios incluidos en una zona operativa", () => {
  const resultado = {
    address: { neighbourhood: "Alto Alberdi" },
    display_name: "Alto Alberdi, Córdoba, Argentina",
  };
  const zonas = ["Alto alberdi / Alberdi / Villa paez / Nuevo centro / Santa ana", "General Paz"];
  assert.equal(detectarZonaEnResultado(resultado, zonas), zonas[0]);
});

test("no inventa una zona cuando el barrio no está configurado", () => {
  const resultado = {
    address: { suburb: "Barrio sin cobertura" },
    display_name: "Barrio sin cobertura, Córdoba, Argentina",
  };
  assert.equal(detectarZonaEnResultado(resultado, ["Alberdi", "General Paz"]), null);
});

test("no confunde el nombre de una calle con el barrio", () => {
  const resultado = {
    address: { road: "Avenida General Paz", suburb: "Barrio sin cobertura" },
    display_name: "Avenida General Paz, Barrio sin cobertura, Córdoba, Argentina",
  };
  assert.equal(detectarZonaEnResultado(resultado, ["General Paz"]), null);
});
