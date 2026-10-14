const express = require("express");
const router = express.Router();
const { listarProductos, obtenerImagenProducto, listarPortadasCatalogo, obtenerImagenPortadaCatalogo, obtenerDatosTransferencia, listarZonas, detectarZona, listarDisponibilidad, obtenerProximaEntrega, crearPedido, verificarAreaPrivada } = require("../controllers/public.controller");
const asyncHandler = require("../utils/asyncHandler");
const { subirImagen, validarImagenSubida } = require("../middleware/imagenes");

router.get("/productos", asyncHandler(listarProductos));
router.get("/productos/:id/imagen", asyncHandler(obtenerImagenProducto));
router.get("/portadas-catalogo", asyncHandler(listarPortadasCatalogo));
router.get("/portadas-catalogo/:categoria/imagen", asyncHandler(obtenerImagenPortadaCatalogo));
router.get("/configuracion-pago", asyncHandler(obtenerDatosTransferencia));
router.get("/zonas", asyncHandler(listarZonas));
router.post("/detectar-zona", asyncHandler(detectarZona));
router.get("/disponibilidad", asyncHandler(listarDisponibilidad));
router.get("/proxima-entrega", asyncHandler(obtenerProximaEntrega));
router.post("/pedidos", subirImagen.single("comprobante"), validarImagenSubida, asyncHandler(crearPedido));
router.post("/area-privada/verificar", asyncHandler(verificarAreaPrivada));

module.exports = router;
