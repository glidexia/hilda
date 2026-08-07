function inicioDelDia(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function hoy() {
  return inicioDelDia(new Date());
}

function ayer() {
  const d = hoy();
  d.setDate(d.getDate() - 1);
  return d;
}

function manana() {
  const d = hoy();
  d.setDate(d.getDate() + 1);
  return d;
}

// Traduce el parámetro ?dia=ayer|hoy|manana (o una fecha ISO explícita) a una fecha concreta
function resolverFecha(dia) {
  if (dia === "ayer") return ayer();
  if (dia === "manana") return manana();
  if (dia === "hoy" || !dia) return hoy();
  return inicioDelDia(dia); // fecha ISO explícita, ej: "2026-08-10"
}

module.exports = { inicioDelDia, hoy, ayer, manana, resolverFecha };
