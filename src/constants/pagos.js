const PAGOS_PERMITIDOS = ["Efectivo", "Transferencia"];

function esPagoValido(pago) {
  return PAGOS_PERMITIDOS.includes(pago);
}

module.exports = { PAGOS_PERMITIDOS, esPagoValido };
