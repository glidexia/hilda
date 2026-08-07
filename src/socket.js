const { Server } = require("socket.io");
const { verificarToken } = require("./utils/jwt");

let io = null;

// El admin se une a la sala "admin" y ve todo. Cada chofer se une solo a la sala
// de su propio camión ("camion-3", por ejemplo), así solo recibe lo que le corresponde.
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || "*" },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Sin token"));
    try {
      socket.user = verificarToken(token);
      next();
    } catch {
      next(new Error("Token inválido o vencido"));
    }
  });

  io.on("connection", (socket) => {
    const { role, camionId } = socket.user;
    if (role === "admin") socket.join("admin");
    if (role === "chofer" && camionId) socket.join(`camion-${camionId}`);
  });

  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.io todavía no fue inicializado — revisá que server.js llame a initSocket()");
  return io;
}

module.exports = { initSocket, getIO };
