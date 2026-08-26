const multer = require("multer");

const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);
const LIMITE_BYTES = 5 * 1024 * 1024;

function esImagenReal(buffer, mime) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  if (mime === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

const subirImagen = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
      return cb(Object.assign(new Error("La imagen debe ser JPG, PNG o WebP"), { status: 400 }));
    }
    cb(null, true);
  },
});

function validarImagenSubida(req, _res, next) {
  if (req.file && !esImagenReal(req.file.buffer, req.file.mimetype)) {
    return next(Object.assign(new Error("El archivo no es una imagen válida"), { status: 400 }));
  }
  next();
}

module.exports = { subirImagen, validarImagenSubida, esImagenReal, LIMITE_BYTES };
