const { getIO } = require("./socket");

// Pedido nuevo desde la vidriera: el admin lo ve en el dashboard, y el camión asignado lo ve en su ruta.
function emitPedidoCreado(pedido) {
  const io = getIO();
  io.to("admin").emit("pedido:nuevo", pedido);
  io.to(`camion-${pedido.camionId}`).emit("pedido:nuevo", pedido);
}

// Cambio de estado (entregado / no atendido) o reasignación manual de camión.
// Si cambió de camión, avisamos también al camión anterior para que lo saque de su lista.
function emitPedidoActualizado(pedido, camionAnteriorId = null) {
  const io = getIO();
  io.to("admin").emit("pedido:actualizado", pedido);
  io.to(`camion-${pedido.camionId}`).emit("pedido:actualizado", pedido);
  if (camionAnteriorId && camionAnteriorId !== pedido.camionId) {
    io.to(`camion-${camionAnteriorId}`).emit("pedido:removido", { id: pedido.id });
  }
}

function emitCamionActualizado(camion) {
  getIO().to("admin").emit("camion:actualizado", camion);
}

function emitProductoActualizado(producto) {
  getIO().to("admin").emit("producto:actualizado", producto);
}

module.exports = { emitPedidoCreado, emitPedidoActualizado, emitCamionActualizado, emitProductoActualizado };
