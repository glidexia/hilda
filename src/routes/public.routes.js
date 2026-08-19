const express = require("express");
const router = express.Router();
const { listarProductos, listarZonas, obtenerProximaEntrega, crearPedido, verificarAreaPrivada } = require("../controllers/public.controller");
const asyncHandler = require("../utils/asyncHandler");

router.get("/productos", asyncHandler(listarProductos));
router.get("/zonas", asyncHandler(listarZonas));
router.get("/proxima-entrega", asyncHandler(obtenerProximaEntrega));
router.post("/pedidos", asyncHandler(crearPedido));
router.post("/area-privada/verificar", asyncHandler(verificarAreaPrivada));

module.exports = router;
