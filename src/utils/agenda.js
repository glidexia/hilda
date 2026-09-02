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

function esAgendaCamionValida({ diasSemana, horaDesde, horaHasta, cupoMaximo }) {
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
    (hasta - desde) % 60 === 0 &&
    Number.isInteger(cupoMaximo) &&
    cupoMaximo >= 1 &&
    cupoMaximo <= 100
  );
}

// Convierte la franja operativa general de un camión en turnos consecutivos
// de una hora. Por ejemplo, 09:00–12:00 produce 09–10, 10–11 y 11–12.
function generarFranjasHora({ diasSemana, horaDesde, horaHasta, cupoMaximo }) {
  if (!esAgendaCamionValida({ diasSemana, horaDesde, horaHasta, cupoMaximo })) return [];
  const desde = horaAMinutos(horaDesde);
  const hasta = horaAMinutos(horaHasta);
  return [...diasSemana]
    .sort((a, b) => a - b)
    .flatMap((diaSemana) => {
      const franjas = [];
      for (let inicio = desde; inicio < hasta; inicio += 60) {
        franjas.push({
          diaSemana,
          horaDesde: minutosAHora(inicio),
          horaHasta: minutosAHora(inicio + 60),
          cupoMaximo,
        });
      }
      return franjas;
    });
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
  esAgendaCamionValida,
  generarFranjasHora,
  fechaAdmitidaParaHorario,
  proximasFechas,
};
