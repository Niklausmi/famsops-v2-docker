const { query } = require('../db');

/**
 * Generate a server-side sequential ID.
 * e.g. nextId('seq_ticket', 'TKT') → 'TKT-001042'
 */
async function nextId(sequence, prefix) {
  const { rows } = await query(`SELECT nextval('${sequence}') AS n`);
  const n = String(rows[0].n).padStart(6, '0');
  return `${prefix}-${n}`;
}

module.exports = { nextId };
