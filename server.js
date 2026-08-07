require("dotenv").config();
const http = require("http");
const app = require("./app");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 4000;

const httpServer = http.createServer(app);
initSocket(httpServer);

// "0.0.0.0" es necesario para que Railway pueda enrutar el tráfico correctamente
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`La Hilda API (HTTP + WebSockets) corriendo en el puerto ${PORT}`);
});
