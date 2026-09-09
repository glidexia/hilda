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

function horaAMinutos(hora) {
  if (!HORA_PATTERN.test(hora || "")) return null;
  const [horas, minutos] = hora.split(":").map(Number);
  return horas * 60 + minutos;
}

function minutosAHora(total) {
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

function esAgendaZonaValida({ diasSemana, horaDesde, horaHasta, cupoMaximo }) {
  const desde = horaAMinutos(horaDesde);
  const hasta = horaAMinutos(horaHasta);
  return (
    Array.isArray(diasSemana) &&
    diasSemana.length > 0 &&
    diasSemana.every((dia) => Number.isInteger(dia) && dia >= 1 && dia <= 5) &&
    new Set(diasSemana).size === diasSemana.length &&
    desde !== null &&
    hasta !== null &&
    hasta > desde &&
    Number.isInteger(cupoMaximo) &&
    cupoMaximo >= 1 &&
    cupoMaximo <= 100
  );
}

// Genera una única franja amplia por cada día seleccionado. Por ejemplo,
// 10:00–13:00 se muestra y reserva como 10:00–13:00, sin subdividirla.
function generarFranjasHora({ diasSemana, horaDesde, horaHasta, cupoMaximo }) {
  if (!esAgendaZonaValida({ diasSemana, horaDesde, horaHasta, cupoMaximo })) return [];
  return [...diasSemana]
    .sort((a, b) => a - b)
    .map((diaSemana) => ({ diaSemana, horaDesde, horaHasta, cupoMaximo }));
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
  horaAMinutos,
  minutosAHora,
  esAgendaZonaValida,
  generarFranjasHora,
  fechaAdmitidaParaHorario,
  proximasFechas,
};
