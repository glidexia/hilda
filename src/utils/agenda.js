const { desdeISO, hoy, sumarDias } = require("./fechas");

const HORA_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function esHorarioValido({ diaSemana, horaDesde, horaHasta, cupoMaximo }) {
  return (
    Number.isInteger(diaSemana) &&
    diaSemana >= 1 &&
    diaSemana <= 5 &&
    HORA_PATTERN.test(horaDesde || "") &&
    HORA_PATTERN.test(horaHasta || "") &&
    horaDesde < horaHasta &&
    Number.isInteger(cupoMaximo) &&
    cupoMaximo >= 1 &&
    cupoMaximo <= 100
  );
}

function fechaAdmitidaParaHorario(fechaISO, diaSemana, referencia = new Date()) {
  const fecha = desdeISO(fechaISO);
  if (!fecha) return null;
  const primeraFechaPosible = sumarDias(hoy(referencia), 1);
  const ultimaFechaPosible = sumarDias(hoy(referencia), 60);
  if (fecha < primeraFechaPosible || fecha > ultimaFechaPosible) return null;
  return fecha.getUTCDay() === diaSemana ? fecha : null;
}

function proximasFechas(desde = new Date(), cantidadDias = 28) {
  const primera = sumarDias(hoy(desde), 1);
  return Array.from({ length: cantidadDias }, (_, indice) => sumarDias(primera, indice));
}

module.exports = {
  HORA_PATTERN,
  esHorarioValido,
  fechaAdmitidaParaHorario,
  proximasFechas,
};
