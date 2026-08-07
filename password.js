const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

async function hashPassword(plano) {
  return bcrypt.hash(plano, SALT_ROUNDS);
}

async function compararPassword(plano, hash) {
  return bcrypt.compare(plano, hash);
}

module.exports = { hashPassword, compararPassword };
