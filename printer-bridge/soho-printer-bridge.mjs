import { spawn } from 'node:child_process';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const siteUrl = required('SOHO_SITE_URL').replace(/\/$/, '');
const bridgeToken = required('PRINT_BRIDGE_TOKEN');
const workerId = process.env.PRINTER_WORKER_ID?.trim() || 'soho-cocina-1';
const pollMs = Math.max(3_000, numberFromEnv('POLL_INTERVAL_MS', 5_000));
const statePath = resolve(process.env.PRINTED_JOBS_FILE?.trim() || '.printed-jobs.json');
const printerScript = process.env.PRINTER_SCRIPT?.trim() || 'C:\\SOHO-Printer\\print-ticket.ps1';
const ticketWidth = 42;
let stopping = false;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name}.`);
  return value;
}

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} no es válido.`);
  }
  return value;
}

function ascii(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/€/g, 'EUR')
    .replace(/[^\x20-\x7E\n]/g, '');
}

function money(value) {
  return `${Number(value || 0).toFixed(2).replace('.', ',')} EUR`;
}

function shortMoney(value) {
  return Number(value || 0).toFixed(2).replace('.', ',');
}

function center(value, width = ticketWidth) {
  const clean = ascii(value).slice(0, width);

  return `${' '.repeat(
    Math.max(0, Math.floor((width - clean.length) / 2))
  )}${clean}\n`;
}

function line(left, right = '', width = ticketWidth) {
  const rightText = ascii(right);

  const leftText = ascii(left).slice(
    0,
    Math.max(0, width - rightText.length - 1)
  );

  return `${leftText}${' '.repeat(
    Math.max(1, width - leftText.length - rightText.length)
  )}${rightText}\n`;
}

function wrapLines(value, width = ticketWidth) {
  const words = ascii(value)
    .split(/\s+/)
    .filter(Boolean);

  const lines = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word.slice(0, width);
    } else if (`${current} ${word}`.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word.slice(0, width);
    }
  }

  if (current) lines.push(current);

  return lines;
}

function field(...values) {
  return (
    values.find(
      (value) =>
        value !== undefined &&
        value !== null &&
        value !== ''
    ) ?? ''
  );
}

/**
 * Lee customizations aunque venga como objeto JSON
 * o como string JSON.
 */
function getCustomizations(item) {
  const raw = item?.customizations;

  if (!raw) return {};

  if (typeof raw === 'object') {
    return raw;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);

      return parsed && typeof parsed === 'object'
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

/**
 * Soporta varios formatos posibles de extras.
 *
 * Importante:
 * ahora también lee customizations.extras,
 * que era lo que faltaba en el ticket.
 */
function getExtras(item) {
  const customizations = getCustomizations(item);

  const candidates = [
    item?.extras,
    item?.options,
    item?.modifiers,

    customizations.extras,
    customizations.selected_extras,
    customizations.selectedExtras,
    customizations.options,
    customizations.modifiers
  ];

  return candidates.find((value) => Array.isArray(value)) || [];
}

/**
 * Lee observaciones específicas de cada producto.
 */
function getItemNotes(item) {
  const customizations = getCustomizations(item);

  return field(
    item?.notes,
    item?.note,
    item?.observations,
    item?.observation,
    item?.comment,

    customizations.notes,
    customizations.note,
    customizations.observations,
    customizations.observation,
    customizations.comment
  );
}

function getBilling(order) {
  const billing =
    order.billingDetails ||
    order.billing_details ||
    order.invoiceData ||
    order.invoice_data ||
    order.billing ||
    {};

  return {
    taxId: field(
      billing.taxId,
      billing.tax_id,
      billing.nif,
      billing.cif,
      order.billingTaxId,
      order.billing_tax_id
    ),

    name: field(
      billing.name,
      billing.companyName,
      billing.company_name,
      order.billingName,
      order.billing_name,
      order.customerName
    ),

    address: field(
      billing.address,
      billing.street,
      order.billingAddress,
      order.billing_address
    ),

    postalCode: field(
      billing.postalCode,
      billing.postal_code,
      billing.zip,
      order.billingPostalCode,
      order.billing_postal_code
    ),

    city: field(
      billing.city,
      billing.town,
      billing.locality,
      order.billingCity,
      order.billing_city
    ),

    province: field(
      billing.province,
      billing.state,
      order.billingProvince,
      order.billing_province
    )
  };
}

function orderTypeLabel(order) {
  const type = ascii(
    field(
      order.orderType,
      order.order_type,
      order.type
    )
  ).toLowerCase();

  return (
    type.includes('delivery') ||
    type.includes('domicilio') ||
    type.includes('entrega')
  )
    ? 'ENTREGA A DOMICILIO'
    : 'RECOGIDA EN LOCAL';
}

function printWrappedLabel(label, value) {
  const prefix = `${label}: `;

  const lines = wrapLines(
    value,
    ticketWidth - prefix.length
  );

  if (!lines.length) {
    return `${prefix}\n`;
  }

  return (
    `${prefix}${lines[0]}\n` +
    lines
      .slice(1)
      .map(
        (part) =>
          `${' '.repeat(prefix.length)}${part}\n`
      )
      .join('')
  );
}

function itemTotal(item) {
  const explicit = Number(
    field(
      item.total,
      item.totalPrice,
      item.total_price
    )
  );

  if (
    Number.isFinite(explicit) &&
    explicit >= 0
  ) {
    return explicit;
  }

  const unit = Number(
    field(
      item.unitPrice,
      item.unit_price,
      item.price
    )
  );

  return Number.isFinite(unit)
    ? unit * Number(item.quantity || 1)
    : 0;
}

function itemUnitPrice(item) {
  const explicit = Number(
    field(
      item.unitPrice,
      item.unit_price,
      item.price
    )
  );

  return (
    Number.isFinite(explicit) &&
    explicit >= 0
  )
    ? explicit
    : itemTotal(item) /
        Math.max(
          1,
          Number(item.quantity || 1)
        );
}

function ticket(order) {
  const total = Number(order.total || 0);

  const taxRate = Number(
    order.taxRate ||
    order.tax_rate ||
    10
  );

  const base =
    total / (1 + taxRate / 100);

  const tax =
    total - base;

  const billing =
    getBilling(order);

  const placedAt =
    new Date(
      field(
        order.placedAt,
        order.createdAt,
        order.created_at,
        Date.now()
      )
    );

  const dateText =
    placedAt.toLocaleString(
      'es-ES',
      {
        timeZone: 'Europe/Madrid',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    );

  let body = '';

  body += center('SOHO');
  body += center('ADOSPI EVENTS S.L.');
  body += center('RUA A MARINA 3');
  body += center('36630 CAMBADOS');
  body += center('T.L.F.: 644 535 778');
  body += center('NIF: B94152030');

  body +=
    '\nDATOS DEL CLIENTE\n' +
    '------------------------------------------\n';

  body +=
    printWrappedLabel(
      'NIF/CIF',
      billing.taxId
    );

  body +=
    printWrappedLabel(
      'NOMBRE',
      billing.name
    );

  body +=
    printWrappedLabel(
      'DIRECCION',
      billing.address
    );

  body +=
    printWrappedLabel(
      'POBLACION',
      [
        billing.postalCode,
        billing.city,
        billing.province
      ]
        .filter(Boolean)
        .join(' ')
    );

  body +=
    printWrappedLabel(
      'TELEFONO',
      order.customerPhone
    );

  body +=
    '------------------------------------------\n';

  body +=
    line(
      'REF',
      ascii(order.reference)
    );

  body +=
    line(
      'FECHA',
      dateText
    );

  body +=
    line(
      'TIPO',
      orderTypeLabel(order)
    );

  body +=
    `\n${center('PEDIDO WEB')}` +
    '------------------------------------------\n';

  body +=
    'UDS DESCRIPCION          PRECIO   IMPORTE\n';

  body +=
    '------------------------------------------\n';

  for (const item of order.items || []) {
    const quantity =
      Math.max(
        1,
        Number(item.quantity || 1)
      );

    const prefix =
      `${quantity}x `;

    const itemName =
      field(
        item.name,
        item.productName,
        item.product_name,
        'PRODUCTO'
      );

    const names =
      wrapLines(
        itemName,
        ticketWidth - prefix.length
      );

    body +=
      `${prefix}${names[0] || 'PRODUCTO'}\n`;

    for (
      const continuation
      of names.slice(1)
    ) {
      body +=
        `   ${continuation}\n`;
    }

    /**
     * EXTRAS
     */
    for (
      const extra
      of getExtras(item)
    ) {
      const extraName =
        typeof extra === 'string'
          ? extra
          : field(
              extra.name,
              extra.label,
              extra.title,
              extra.product_name
            );

      if (!extraName) {
        continue;
      }

      const extraQuantity =
        typeof extra === 'object'
          ? Math.max(
              1,
              Number(
                field(
                  extra.quantity,
                  extra.qty,
                  1
                )
              ) || 1
            )
          : 1;

      const extraPrefix =
        extraQuantity > 1
          ? `   + ${extraQuantity}x `
          : '   + ';

      const extraLines =
        wrapLines(
          extraName,
          ticketWidth -
            extraPrefix.length
        );

      if (extraLines.length) {
        body +=
          `${extraPrefix}${extraLines[0]}\n`;

        for (
          const continuation
          of extraLines.slice(1)
        ) {
          body +=
            `${' '.repeat(extraPrefix.length)}` +
            `${continuation}\n`;
        }
      }
    }

    /**
     * OBSERVACIONES DEL PRODUCTO
     */
    const itemNotes =
      getItemNotes(item);

    if (itemNotes) {
      const notePrefix =
        '   ! ';

      const noteLines =
        wrapLines(
          itemNotes,
          ticketWidth -
            notePrefix.length
        );

      if (noteLines.length) {
        body +=
          `${notePrefix}${noteLines[0]}\n`;

        for (
          const continuation
          of noteLines.slice(1)
        ) {
          body +=
            `${' '.repeat(notePrefix.length)}` +
            `${continuation}\n`;
        }
      }
    }

    body +=
      line(
        '',
        `${shortMoney(
          itemUnitPrice(item)
        )}`.padStart(8) +
        `${shortMoney(
          itemTotal(item)
        )}`.padStart(10)
      );

    body += '\n';
  }

  body +=
    '------------------------------------------\n';

  body +=
    line(
      'BASE IMPONIBLE',
      money(base)
    );

  body +=
    line(
      `IVA ${shortMoney(taxRate)}%`,
      money(tax)
    );

  body +=
    '------------------------------------------\n';

  body +=
    line(
      'TOTAL',
      money(total)
    );

  body +=
    line(
      'PAGO',
      'PAGADO ONLINE'
    );

  if (order.notes) {
    body +=
      '\nOBSERVACIONES\n';

    for (
      const noteLine
      of wrapLines(order.notes)
    ) {
      body +=
        `${noteLine}\n`;
    }
  }

  body +=
    `\n${center(
      'Gracias por su visita'
    )}\n\n`;

  return body;
}

async function loadPrinted() {
  try {
    const parsed =
      JSON.parse(
        await readFile(
          statePath,
          'utf8'
        )
      );

    return new Set(
      Array.isArray(parsed)
        ? parsed
            .filter(
              (id) =>
                typeof id === 'string'
            )
            .slice(-1000)
        : []
    );
  } catch {
    return new Set();
  }
}

async function savePrinted(set) {
  const temporaryPath =
    `${statePath}.tmp`;

  await writeFile(
    temporaryPath,
    `${JSON.stringify(
      [...set].slice(-1000),
      null,
      2
    )}\n`,
    'utf8'
  );

  await rename(
    temporaryPath,
    statePath
  );
}

function sendToPrinter(data) {
  return new Promise(
    (
      resolvePromise,
      reject
    ) => {

      const child =
        spawn(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            printerScript
          ],
          {
            windowsHide: true,
            stdio: [
              'pipe',
              'ignore',
              'pipe'
            ]
          }
        );

      let errorOutput = '';
      let settled = false;

      child.stderr.on(
        'data',
        (chunk) => {
          errorOutput +=
            chunk.toString();
        }
      );

      child.once(
        'error',
        (error) => {
          if (!settled) {
            settled = true;
            reject(error);
          }
        }
      );

      child.once(
        'close',
        (code) => {
          if (settled) return;

          settled = true;

          if (code === 0) {
            resolvePromise();
          } else {
            reject(
              new Error(
                errorOutput.trim() ||
                `La impresión terminó con el código ${code}.`
              )
            );
          }
        }
      );

      child.stdin.once(
        'error',
        (error) => {
          if (!settled) {
            settled = true;
            reject(error);
          }
        }
      );

      child.stdin.end(
        data,
        'utf8'
      );
    }
  );
}

async function api(
  path,
  options = {}
) {
  let lastError;

  for (
    let attempt = 1;
    attempt <= 4;
    attempt += 1
  ) {
    try {
      const response =
        await fetch(
          `${siteUrl}${path}`,
          {
            ...options,

            signal:
              AbortSignal.timeout(
                15_000
              ),

            headers: {
              Authorization:
                `Bearer ${bridgeToken}`,

              'Content-Type':
                'application/json',

              ...(options.headers || {})
            }
          }
        );

      const result =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
          `Error HTTP ${response.status}`
        );
      }

      return result;
    } catch (error) {
      lastError = error;

      if (attempt < 4) {
        await new Promise(
          (resolvePromise) =>
            setTimeout(
              resolvePromise,
              attempt * 1_000
            )
        );
      }
    }
  }

  const cause =
    lastError?.cause?.message ||
    lastError?.message ||
    'Error desconocido';

  throw new Error(
    `Conexión agotada después de 4 intentos: ${cause}`
  );
}

async function report(
  jobId,
  status,
  error
) {
  await api(
    '/api/printing/jobs',
    {
      method: 'POST',

      body:
        JSON.stringify({
          jobId,
          workerId,
          status,

          error: error
            ? String(error).slice(
                0,
                500
              )
            : undefined
        })
    }
  );
}

async function cycle(printed) {
  const result =
    await api(
      `/api/printing/jobs?worker=${encodeURIComponent(
        workerId
      )}`
    );

  for (
    const job
    of result.jobs || []
  ) {
    try {
      if (
        !printed.has(job.id)
      ) {
        await sendToPrinter(
          ticket(job.order)
        );

        printed.add(
          job.id
        );

        await savePrinted(
          printed
        );
      }

      await report(
        job.id,
        'printed'
      );

      console.log(
        `[OK] ${job.order.reference}`
      );
    } catch (error) {
      console.error(
        `[ERROR] ${
          job.order?.reference ||
          job.id
        }:`,
        error.message
      );

      await report(
        job.id,
        'failed',
        error.message
      ).catch(
        (reportError) =>
          console.error(
            '[ERROR API]',
            reportError.message
          )
      );
    }
  }
}

const printed =
  await loadPrinted();

console.log(
  `Conector SOHO iniciado: ${workerId} -> impresora Windows COCINA`
);

process.on(
  'SIGINT',
  () => {
    stopping = true;
  }
);

process.on(
  'SIGTERM',
  () => {
    stopping = true;
  }
);

while (!stopping) {
  await cycle(
    printed
  ).catch(
    (error) =>
      console.error(
        '[ERROR COLA]',
        error.message
      )
  );

  await new Promise(
    (resolvePromise) =>
      setTimeout(
        resolvePromise,
        pollMs
      )
  );
}

console.log(
  'Conector detenido.'
);