const express = require("express");
const router = express.Router();
const { listarProductos, listarZonas, crearPedido } = require("../controllers/public.controller");

router.get("/productos", listarProductos);
router.get("/zonas", listarZonas);
router.post("/pedidos", crearPedido);

module.exports = router;
