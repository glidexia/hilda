const test = require("node:test");
const assert = require("node:assert/strict");
const { esHorarioValido, esAgendaCamionValida, generarFranjasHora, fechaAdmitidaParaHorario, proximasFechas } = require("../src/utils/agenda");
const { PAGOS_PERMITIDOS, esPagoValido, validarComprobantePago } = require("../src/constants/pagos");

test("solo permite efectivo y transferencia", () => {
  assert.deepEqual(PAGOS_PERMITIDOS, ["Efectivo", "Transferencia"]);
  assert.equal(esPagoValido("Efectivo"), true);
  assert.equal(esPagoValido("Transferencia"), true);
  assert.equal(esPagoValido("Mercado Pago"), false);
});

test("el comprobante de transferencia es opcional", () => {
  assert.equal(validarComprobantePago("Transferencia", false), null);
  assert.equal(validarComprobantePago("Transferencia", true), null);
  assert.equal(validarComprobantePago("Efectivo", false), null);
  assert.match(validarComprobantePago("Efectivo", true), /solo corresponde/);
});

test("valida franjas de lunes a viernes con rango y cupo correctos", () => {
  assert.equal(esHorarioValido({ diaSemana: 2, horaDesde: "18:00", horaHasta: "20:00", cupoMaximo: 6 }), true);
  assert.equal(esHorarioValido({ diaSemana: 0, horaDesde: "18:00", horaHasta: "20:00", cupoMaximo: 6 }), false);
  assert.equal(esHorarioValido({ diaSemana: 2, horaDesde: "20:00", horaHasta: "18:00", cupoMaximo: 6 }), false);
  assert.equal(esHorarioValido({ diaSemana: 2, horaDesde: "18", horaHasta: "20:00", cupoMaximo: 6 }), false);
  assert.equal(esHorarioValido({ diaSemana: 2, horaDesde: "18:00", horaHasta: "20:00", cupoMaximo: 0 }), false);
});

test("divide la agenda de un camión en turnos consecutivos de 60 minutos", () => {
  const agenda = { diasSemana: [1, 3], horaDesde: "09:00", horaHasta: "12:00", cupoMaximo: 4 };
  assert.equal(esAgendaCamionValida(agenda), true);
  assert.deepEqual(generarFranjasHora(agenda), [
    { diaSemana: 1, horaDesde: "09:00", horaHasta: "10:00", cupoMaximo: 4 },
    { diaSemana: 1, horaDesde: "10:00", horaHasta: "11:00", cupoMaximo: 4 },
    { diaSemana: 1, horaDesde: "11:00", horaHasta: "12:00", cupoMaximo: 4 },
    { diaSemana: 3, horaDesde: "09:00", horaHasta: "10:00", cupoMaximo: 4 },
    { diaSemana: 3, horaDesde: "10:00", horaHasta: "11:00", cupoMaximo: 4 },
    { diaSemana: 3, horaDesde: "11:00", horaHasta: "12:00", cupoMaximo: 4 },
  ]);
});

test("rechaza agendas que no se pueden dividir exactamente en horas", () => {
  assert.equal(esAgendaCamionValida({ diasSemana: [1], horaDesde: "09:00", horaHasta: "10:30", cupoMaximo: 4 }), false);
  assert.equal(esAgendaCamionValida({ diasSemana: [], horaDesde: "09:00", horaHasta: "10:00", cupoMaximo: 4 }), false);
  assert.equal(esAgendaCamionValida({ diasSemana: [1, 1], horaDesde: "09:00", horaHasta: "10:00", cupoMaximo: 4 }), false);
});

test("acepta una fecha futura solo si coincide con el día configurado", () => {
  const referencia = new Date("2026-08-24T15:00:00-03:00"); // lunes en Buenos Aires
  assert.equal(fechaAdmitidaParaHorario("2026-08-25", 2, referencia)?.toISOString().slice(0, 10), "2026-08-25");
  assert.equal(fechaAdmitidaParaHorario("2026-08-25", 4, referencia), null);
  assert.equal(fechaAdmitidaParaHorario("2026-08-24", 1, referencia), null);
});

test("la disponibilidad comienza mañana y conserva fechas calendario", () => {
  const referencia = new Date("2026-08-24T23:30:00-03:00");
  assert.deepEqual(
    proximasFechas(referencia, 3).map((fecha) => fecha.toISOString().slice(0, 10)),
    ["2026-08-25", "2026-08-26", "2026-08-27"]
  );
});
