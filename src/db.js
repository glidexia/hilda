const { PrismaClient } = require("@prisma/client");

// Una sola instancia compartida en toda la app — evita abrir demasiadas conexiones a Postgres.
const prisma = new PrismaClient();

module.exports = prisma;
