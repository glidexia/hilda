const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { randomUUID } = require("crypto");

let cliente;

function configuracion() {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  const region = process.env.AWS_DEFAULT_REGION;
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    throw Object.assign(new Error("El almacenamiento de archivos no está configurado"), { status: 503 });
  }
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

function obtenerCliente() {
  if (cliente) return cliente;
  const cfg = configuracion();
  cliente = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    forcePathStyle: String(process.env.AWS_S3_FORCE_PATH_STYLE || "false") === "true",
  });
  return cliente;
}

function extensionPara(mime) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[mime] || "bin";
}

function nuevaClave(carpeta, mime) {
  return `${carpeta}/${randomUUID()}.${extensionPara(mime)}`;
}

async function guardarArchivo({ key, buffer, mime, cacheControl = "private, no-store" }) {
  const cfg = configuracion();
  await obtenerCliente().send(new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: key,
    Body: buffer,
    ContentType: mime,
    CacheControl: cacheControl,
  }));
}

async function obtenerArchivo(key) {
  const cfg = configuracion();
  return obtenerCliente().send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }));
}

async function borrarArchivo(key) {
  if (!key) return;
  const cfg = configuracion();
  await obtenerCliente().send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
}

module.exports = { nuevaClave, guardarArchivo, obtenerArchivo, borrarArchivo };
