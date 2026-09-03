import net from 'node:net';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const siteUrl = required('SOHO_SITE_URL').replace(/\/$/, '');
const bridgeToken = required('PRINT_BRIDGE_TOKEN');
const printerHost = required('PRINTER_HOST');
const printerPort = numberFromEnv('PRINTER_PORT', 9100);
const workerId = process.env.PRINTER_WORKER_ID?.trim() || 'soho-cocina-1';
const pollMs = Math.max(3_000, numberFromEnv('POLL_INTERVAL_MS', 5_000));
const statePath = resolve(process.env.PRINTED_JOBS_FILE?.trim() || '.printed-jobs.json');
let stopping = false;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name}.`);
  return value;
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${name} no es válido.`);
  return value;
}

function ascii(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/€/g, 'EUR').replace(/[^\x20-\x7E\n]/g, '');
}

function money(value) {
  return `${Number(value || 0).toFixed(2).replace('.', ',')} EUR`;
}

function line(left, right = '', width = 42) {
  const a = ascii(left).slice(0, width);
  const b = ascii(right).slice(0, width);
  const spaces = Math.max(1, width - a.length - b.length);
  return `${a}${' '.repeat(spaces)}${b}\n`;
}

function wrap(value, width = 42) {
  const words = ascii(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= width) current += ` ${word}`;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.join('\n');
}

function ticket(order) {
  let body = '\x1b@\x1ba\x01\x1b!\x20SOHO CAMBADOS\n\x1b!\x00PEDIDO COCINA\n\n';
  body += `REF: ${ascii(order.reference)}\n`;
  body += `${new Date(order.placedAt).toLocaleString('es-ES')}\n`;
  body += '\x1ba\x00------------------------------------------\n';
  for (const item of order.items || []) {
    body += `\x1b!\x10${item.quantity}x ${wrap(item.name)}\x1b!\x00\n`;
    body += line('', money(item.total));
  }
  body += '------------------------------------------\n';
  body += line('TOTAL', money(order.total));
  body += `CLIENTE: ${wrap(order.customerName)}\n`;
  body += `TELEFONO: ${ascii(order.customerPhone)}\n`;
  if (order.notes) body += `\n\x1b!\x10NOTA: ${wrap(order.notes)}\x1b!\x00\n`;
  body += '\n\n\n\x1dV\x00';
  return Buffer.from(body, 'ascii');
}

async function loadPrinted() {
  try {
    const parsed = JSON.parse(await readFile(statePath, 'utf8'));
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string').slice(-1000) : []);
  } catch { return new Set(); }
}

async function savePrinted(set) {
  const temporaryPath = `${statePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify([...set].slice(-1000), null, 2)}\n`, 'utf8');
  await rename(temporaryPath, statePath);
}

function sendToPrinter(data) {
  return new Promise((resolvePromise, reject) => {
    const socket = net.createConnection({ host: printerHost, port: printerPort });
    socket.setTimeout(15_000);
    socket.once('connect', () => socket.end(data));
    socket.once('timeout', () => socket.destroy(new Error('Tiempo de espera agotado.')));
    socket.once('error', reject);
    socket.once('close', (hadError) => { if (!hadError) resolvePromise(); });
  });
}

async function api(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${bridgeToken}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `Error HTTP ${response.status}`);
  return result;
}

async function report(jobId, status, error) {
  await api('/api/printing/jobs', {
    method: 'POST',
    body: JSON.stringify({ jobId, workerId, status, error: error ? String(error).slice(0, 500) : undefined })
  });
}

async function cycle(printed) {
  const result = await api(`/api/printing/jobs?worker=${encodeURIComponent(workerId)}`);
  for (const job of result.jobs || []) {
    try {
      if (!printed.has(job.id)) {
        await sendToPrinter(ticket(job.order));
        printed.add(job.id);
        await savePrinted(printed);
      }
      await report(job.id, 'printed');
      console.log(`[OK] ${job.order.reference}`);
    } catch (error) {
      console.error(`[ERROR] ${job.order?.reference || job.id}:`, error.message);
      await report(job.id, 'failed', error.message).catch((reportError) => console.error('[ERROR API]', reportError.message));
    }
  }
}

const printed = await loadPrinted();
console.log(`Conector SOHO iniciado: ${workerId} -> ${printerHost}:${printerPort}`);
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
while (!stopping) {
  await cycle(printed).catch((error) => console.error('[ERROR COLA]', error.message));
  await new Promise((resolvePromise) => setTimeout(resolvePromise, pollMs));
}
console.log('Conector detenido.');
