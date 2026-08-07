const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const publicRoutes = require("./routes/public.routes");
const adminRoutes = require("./routes/admin.routes");
const choferRoutes = require("./routes/chofer.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true, servicio: "la-hilda-api" }));

app.use("/auth", authRoutes);
app.use("/public", publicRoutes);
app.use("/admin", adminRoutes);
app.use("/chofer", choferRoutes);

app.use(errorHandler);

module.exports = app;
