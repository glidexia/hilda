require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

const CAMIONES = [
  { nombre: "Camión 1", color: "#4FD1C5", chofer: "Roberto Díaz", barrios: ["Nueva Córdoba", "Güemes", "Centro"] },
  { nombre: "Camión 2", color: "#F5A623", chofer: "Marcela Ponce", barrios: ["Cerro de las Rosas", "Villa Belgrano", "Jardín"] },
  { nombre: "Camión 3", color: "#818CF8", chofer: "Iván Suárez", barrios: ["Alta Córdoba", "General Paz", "Providencia"] },
  { nombre: "Camión 4", color: "#F472B6", chofer: "Lucía Ferreyra", barrios: ["Alberdi", "San Vicente", "Talleres"] },
  { nombre: "Camión 5", color: "#6EE7B7", chofer: "Braian Torres", barrios: ["Colón", "Rogelio Martínez", "Villa Allende"] },
];

const PRODUCTOS = [
  { nombre: "Bidón 12L", descripcion: "Retornable, ideal para consumo personal", precio: 2200, categoria: "consumo_personal" },
  { nombre: "Bidón 20L", descripcion: "Mayor rendimiento, familia numerosa", precio: 3200, categoria: "consumo_personal" },
  { nombre: "Pack x6 botellones 500ml", descripcion: "Para consumo personal", precio: 1800, categoria: "consumo_personal" },
  { nombre: "Bidón 20L (pack x5)", descripcion: "Precio por mayor para comercios y revendedores", precio: 14500, categoria: "comercio_reventa" },
  { nombre: "Dispenser frío / calor", descripcion: "Alquiler mensual, incluye primer bidón", precio: 8500, categoria: "dispenser_frio_calor" },
];

async function main() {
  console.log("Sembrando datos iniciales de La Hilda...");

  const passwordChoferHash = await bcrypt.hash(process.env.CHOFER_PASSWORD_INICIAL || "cambiar1234", 10);

  for (const c of CAMIONES) {
    const camion = await prisma.camion.create({ data: { nombre: c.nombre, color: c.color } });

    for (let i = 0; i < c.barrios.length; i++) {
      const zona = await prisma.zona.create({ data: { barrio: c.barrios[i], orden: i, camionId: camion.id } });
      await prisma.horarioZona.createMany({
        data: [1, 2, 3, 4, 5].flatMap((diaSemana) =>
          Array.from({ length: 9 }, (_, indice) => ({
            zonaId: zona.id,
            diaSemana,
            horaDesde: `${String(9 + indice).padStart(2, "0")}:00`,
            horaHasta: `${String(10 + indice).padStart(2, "0")}:00`,
            cupoMaximo: 8,
          }))
        ),
      });
    }

    const usuario = `camion${camion.id}`;
    await prisma.chofer.create({
      data: { nombre: c.chofer, usuario, passwordHash: passwordChoferHash, camionId: camion.id },
    });
    console.log(`  ${c.nombre} — usuario: ${usuario} / contraseña inicial: (la de CHOFER_PASSWORD_INICIAL)`);
  }

  for (const p of PRODUCTOS) {
    await prisma.producto.create({ data: p });
  }

  await prisma.configuracion.upsert({ where: { id: 1 }, update: {}, create: { id: 1, claveAreaPrivada: "" } });

  const adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "cambiar-esta-clave", 10);
  await prisma.admin.create({
    data: {
      nombre: process.env.ADMIN_NOMBRE || "Administrador",
      usuario: process.env.ADMIN_USUARIO || "admin",
      passwordHash: adminPasswordHash,
    },
  });
  console.log(`  Admin — usuario: ${process.env.ADMIN_USUARIO || "admin"}`);

  console.log("Listo. 5 camiones con sus zonas, catálogo, admin y choferes creados.");
  console.log("IMPORTANTE: las contraseñas iniciales son las de tu archivo .env — cambialas antes de usar esto en producción real.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
