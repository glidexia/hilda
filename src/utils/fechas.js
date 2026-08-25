const ZONA_HORARIA = "America/Argentina/Buenos_Aires";
const formatoFecha = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function desdeISO(fechaISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return null;
  const [year, month, day] = fechaISO.split("-").map(Number);
  const fecha = new Date(Date.UTC(year, month - 1, day));
  if (
    fecha.getUTCFullYear() !== year ||
    fecha.getUTCMonth() !== month - 1 ||
    fecha.getUTCDate() !== day
  ) return null;
  return fecha;
}

// Prisma guarda @db.Date como medianoche UTC. Para un instante real calculamos primero
// que fecha calendario es en Argentina y luego la representamos de esa forma estable.
function inicioDelDia(fecha = new Date()) {
  if (typeof fecha === "string") return desdeISO(fecha);
  const instante = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(instante.getTime())) return null;
  return desdeISO(formatoFecha.format(instante));
}

function sumarDias(fecha, cantidad) {
  const resultado = new Date(fecha);
  resultado.setUTCDate(resultado.getUTCDate() + cantidad);
  return resultado;
}

function hoy(referencia = new Date()) {
  return inicioDelDia(referencia);
}

function ayer(referencia = new Date()) {
  return sumarDias(hoy(referencia), -1);
}

function manana(referencia = new Date()) {
  return sumarDias(hoy(referencia), 1);
}

// Traduce ?dia=ayer|hoy|manana (o una fecha ISO explicita) a una fecha concreta.
// Un valor invalido devuelve null para responder 400 sin llegar a Prisma.
function resolverFecha(dia, referencia = new Date()) {
  if (dia === "ayer") return ayer(referencia);
  if (dia === "manana") return manana(referencia);
  if (dia === "hoy" || !dia) return hoy(referencia);
  return desdeISO(dia);
}

function sePuedeModificarPedido(fechaEntrega, referencia = new Date()) {
  if (!(fechaEntrega instanceof Date) || Number.isNaN(fechaEntrega.getTime())) return false;
  return fechaEntrega.getTime() <= hoy(referencia).getTime();
}

module.exports = {
  ZONA_HORARIA,
  desdeISO,
  inicioDelDia,
  sumarDias,
  hoy,
  ayer,
  manana,
  resolverFecha,
  sePuedeModificarPedido,
};
