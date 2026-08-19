function errorHandler(err, req, res, next) {
  console.error(err);
  const status = Number.isInteger(err.status) ? err.status : 500;
  const mensaje = status >= 500
    ? "No pudimos completar la acción. Intentá nuevamente en unos minutos."
    : (err.message || "No pudimos completar la acción");
  res.status(status).json({ error: mensaje });
}

module.exports = errorHandler;
