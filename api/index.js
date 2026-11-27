const SESSION = {
  access: '__Host-contabil-access',
  refresh: '__Host-contabil-refresh',
};

const screens = new Set(['entrar', 'cadastro', 'painel', 'conferidor']);
const actions = new Set(['entrar', 'cadastro', 'perfil', 'sair']);

function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function redirect(res, path) {
  res.writeHead(303, { Location: path });
  res.end();
}

function respond(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function cookieValues(header = '') {
  return new Map(header.split(';').map((entry) => {
    const [key, ...value] = entry.trim().split('=');
    return [key, value.join('=')];
  }));
}

function setSession(res, session) {
  const serialize = (name, value, maxAge) =>
    name + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + maxAge;

  res.setHeader('Set-Cookie', [
    serialize(SESSION.access, session?.access_token ?? '', session?.expires_in ?? 0),
    serialize(SESSION.refresh, session?.refresh_token ?? '', session ? 60 * 60 * 24 * 14 : 0),
  ]);
}

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}

async function supabase(path, { method = 'GET', token, data, prefer } = {}) {
  const headers = { apikey: process.env.SUPABASE_PUBLISHABLE_KEY };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (data) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  const response = await fetch(new URL(path, process.env.SUPABASE_URL), {
    method, headers, body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const result = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data: result };
}

async function currentSession(req, res) {
  const cookies = cookieValues(req.headers.cookie);
  const access = cookies.get(SESSION.access);
  const refresh = cookies.get(SESSION.refresh);

  if (access) {
    const result = await supabase('/auth/v1/user', { token: access });
    if (result.ok) return { user: result.data, token: access };
    if (result.status >= 500) throw new Error('Auth indisponível');
  }

  if (refresh) {
    const result = await supabase('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', data: { refresh_token: refresh },
    });

    if (result.ok && result.data?.user && result.data.access_token) {
      setSession(res, result.data);
      return { user: result.data.user, token: result.data.access_token };
    }
    // A cookie can be stale when two requests refresh at the same time.
    if (result.status === 429 || result.status >= 500) throw new Error('Auth indisponível');
  }
  return null;
}

const theme = String.raw`
:root{color-scheme:dark;--bg:#08090b;--surface:#111217;--panel:#15161d;--line:#2a2b35;--ink:#f5f4f8;--muted:#b2b2c0;--purple:#c6adff;--focus:#d5c3ff;font:16px/1.55 system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink)}a{color:var(--purple);text-underline-offset:4px}button,input{font:inherit}p{color:var(--muted);margin:0 0 1rem}h1,h2,h3{line-height:1.12;margin:0 0 .65rem;letter-spacing:-.035em}h1{font-size:clamp(2.15rem,5vw,3.7rem)}h2{font-size:1.35rem}h3{font-size:1.1rem}button,a,input{touch-action:manipulation}:focus-visible{outline:3px solid var(--focus);outline-offset:4px}
.brand{display:inline-flex;align-items:center;gap:.75rem;text-decoration:none;font-size:1.17rem;font-weight:750;color:var(--ink);letter-spacing:-.03em}.mark{display:grid;place-items:center;width:2rem;height:2rem;border-radius:.55rem;background:#c6adff;color:#1c102e;font-size:1rem}
.auth{min-height:100dvh;display:grid;grid-template-columns:minmax(18rem,1fr) minmax(23rem,1fr)}.intro{display:flex;flex-direction:column;justify-content:space-between;padding:clamp(2rem,6vw,6rem);border-right:1px solid var(--line);background:radial-gradient(ellipse at 24% 90%,#332055,#151021 44%,#0c0c10 77%)}.intro h2{font-size:clamp(2.4rem,6vw,5rem);max-width:11ch;margin:2rem 0 0;color:#ece2ff}.auth-content{display:grid;place-items:center;padding:2rem}.auth-content>div{width:min(100%,26rem)}
label{display:block;font-weight:650;font-size:.9rem;margin:1rem 0 .35rem}input{width:100%;min-width:0;border:1px solid #434450;border-radius:.55rem;padding:.72rem .85rem;color:var(--ink);background:#0d0e12}input[type=file]{padding:.5rem}input::file-selector-button{margin-right:.6rem;padding:.35rem .6rem;border:1px solid #565262;background:#20212a;color:var(--ink);border-radius:.35rem;cursor:pointer}
button,.button{display:inline-flex;justify-content:center;align-items:center;border:1px solid transparent;border-radius:.55rem;background:var(--purple);color:#190d2c;padding:.65rem .9rem;text-decoration:none;font-weight:720;cursor:pointer}button:hover,.button:hover{filter:brightness(1.08)}button:disabled{opacity:.45;cursor:not-allowed}.secondary,.out{background:#20212a;color:var(--ink);border-color:#434450}.login-button{width:100%;margin:1.25rem 0 .85rem}
.notice{border:1px solid #47563f;background:#182318;border-radius:.6rem;padding:.8rem;margin:1rem 0;color:#daf4d0}.notice.error{background:#301b22;border-color:#7e414f;color:#ffd4dc}
.shell{min-height:100dvh;display:grid;grid-template-columns:15.5rem minmax(0,1fr)}.rail{border-right:1px solid var(--line);background:#0d0e12;padding:1.45rem 1rem}.rail .brand{padding:0 .5rem}.rail nav{margin-top:2.5rem}.menu-group{margin:1.5rem .6rem .45rem;color:var(--muted);font-size:.75rem;font-weight:690;text-transform:uppercase;letter-spacing:.075em}.rail nav a{display:block;color:#dfdce8;text-decoration:none;padding:.6rem .62rem;border:1px solid transparent;border-radius:.5rem;margin-bottom:.25rem;font-size:.93rem}.rail nav a:hover{background:#20212a}.rail nav a[aria-current]{background:#211a32;color:#dfccff;border-color:#403251}
.workspace{min-width:0}.top{min-height:4.35rem;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:0 clamp(1rem,4vw,3rem);background:#101116}.top .email{margin:0;min-width:0;overflow-wrap:anywhere;font-size:.89rem}.content{max-width:76rem;margin:auto;padding:clamp(1.25rem,4vw,3.8rem)}.page-intro{margin-bottom:1.65rem;max-width:65ch}.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,17rem),1fr));gap:1rem}.card{background:var(--surface);border:1px solid var(--line);padding:clamp(1rem,3vw,1.5rem);border-radius:.8rem;margin-bottom:1rem}.card p:last-child{margin-bottom:0}.card form{max-width:40rem}.card form button{margin-top:1rem}.actions{display:flex;align-items:center;gap:.65rem;flex-wrap:wrap}.actions button,.actions .button{margin-top:0}.hint{color:var(--muted);font-size:.88rem}.field-group{margin-bottom:1rem}.results{overflow:auto;margin-top:1rem}table{width:100%;border-collapse:collapse;text-align:left;font-size:.88rem}th,td{padding:.65rem;vertical-align:top;border-bottom:1px solid var(--line)}th{color:#dedbe9}td{overflow-wrap:anywhere;min-width:6rem}.file-cell{min-width:10rem}.key-cell{font-family:ui-monospace,monospace;min-width:12rem}summary{cursor:pointer;font-weight:650}.integration-link{display:inline-block;margin-top:.15rem}[hidden]{display:none!important}
@media(max-width:760px){.auth,.shell{display:block}.intro{padding:1.1rem}.intro h2{display:none}.auth-content{padding:2rem 1.15rem}.rail{border-right:0;border-bottom:1px solid var(--line);padding:1rem}.rail nav{display:flex;gap:.25rem;flex-wrap:wrap;margin-top:.75rem}.rail nav a{margin:0}.menu-group{display:none}.top{min-height:3.7rem}.content{padding-top:1.45rem}}
`;
const fiscalScript = String.raw`'use strict';

const NFE_NS = 'http://www.portalfiscal.inf.br/nfe';
const PORTAL = 'https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx';
const MAX_FILE = 5 * 1024 * 1024;
const MAX_REFERENCE = 2 * 1024 * 1024;
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function normalizeKey(value) {
  return String(value).replace(/\s/g, '').toUpperCase();
}

function validKey(key) {
  if (!/^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$/.test(key) || key.slice(20, 22) !== '55') return false;
  let sum = 0;
  for (let index = 42; index >= 0; index--) {
    sum += (key.charCodeAt(index) - 48) * (2 + (42 - index) % 8);
  }
  const remainder = sum % 11;
  return Number(key[43]) === (remainder < 2 ? 0 : 11 - remainder);
}

function child(node, name) {
  return Array.from(node?.children ?? []).find((element) => element.localName === name && element.namespaceURI === NFE_NS);
}

function value(node, ...path) {
  return path.reduce(child, node)?.textContent.trim() ?? '';
}

function cents(text, { reference = false } = {}) {
  let amount = String(text).trim();
  if (reference && amount.includes(',')) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(amount)) return null;
    amount = amount.replace(/\./g, '').replace(',', '.');
  }
  if (!/^\d{1,13}(?:\.\d{1,2})?$/.test(amount)) return null;
  const [whole, decimal = ''] = amount.split('.');
  return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
}

function parseXml(file, xml) {
  const row = { file, key: '', number: '', date: '', protocol: '', ibs: null, cbs: null, issues: [] };
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    row.issues.push('XML com DTD ou declaração de entidades.');
    return row;
  }

  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  const root = parsed.documentElement;
  if (!root || root.localName === 'parsererror' || parsed.getElementsByTagName('parsererror').length) {
    row.issues.push('XML malformado.');
    return row;
  }

  const nfe = root.localName === 'NFe' ? root : root.localName === 'nfeProc' ? child(root, 'NFe') : null;
  const info = child(nfe, 'infNFe');
  if (root.namespaceURI !== NFE_NS || !info) {
    row.issues.push('Estrutura NF-e não encontrada.');
    return row;
  }

  const id = info.getAttribute('Id') ?? '';
  row.key = id.startsWith('NFe') ? id.slice(3) : '';
  row.number = value(info, 'ide', 'nNF');
  row.date = value(info, 'ide', 'dhEmi') || value(info, 'ide', 'dEmi');

  if (info.getAttribute('versao') !== '4.00') row.issues.push('Versão de leiaute diferente de 4.00.');
  if (value(info, 'ide', 'mod') !== '55') row.issues.push('O documento não é NF-e modelo 55.');
  if (!validKey(row.key)) row.issues.push('Chave de acesso ausente ou com dígito inválido.');
  if (!row.number || !row.date) row.issues.push('Número ou data de emissão ausente.');

  const recordedKey = value(root, 'protNFe', 'infProt', 'chNFe');
  const recordedStatus = value(root, 'protNFe', 'infProt', 'cStat');
  row.protocol = value(root, 'protNFe', 'infProt', 'nProt');
  if (!row.protocol) row.issues.push('Protocolo não consta no arquivo.');
  if (row.protocol && recordedKey !== row.key) row.issues.push('A chave do protocolo diverge da chave do XML.');
  if (row.protocol && !recordedStatus) row.issues.push('Situação ausente no protocolo.');
  if (recordedStatus && !['100', '150'].includes(recordedStatus)) {
    row.issues.push('Protocolo registra cStat ' + recordedStatus + '.');
  }

  const tax = child(child(info, 'total'), 'IBSCBSTot');
  if (tax) {
    row.ibs = cents(value(tax, 'gIBS', 'vIBS'));
    row.cbs = cents(value(tax, 'gCBS', 'vCBS'));
    if (row.ibs === null || row.cbs === null) row.issues.push('O grupo IBS/CBS tem total ausente ou inválido.');
  }
  return row;
}

function parseReference(csv) {
  const [header, ...lines] = csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const fields = (line) => line.split(';').map((item) => item.trim().replace(/^"(.*)"$/, '$1').trim());
  const columns = fields(header).map((item) => item.toLowerCase());
  const positions = ['chave', 'ibs', 'cbs'].map((name) => columns.indexOf(name));
  if (positions.includes(-1) || new Set(columns).size !== columns.length) {
    throw new Error('A primeira linha do CSV deve conter chave;ibs;cbs.');
  }

  const reference = new Map();
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    const values = fields(line);
    const [keyText, ibsText, cbsText] = positions.map((position) => values[position]);
    const key = normalizeKey(keyText ?? '');
    const ibs = cents(ibsText ?? '', { reference: true });
    const cbs = cents(cbsText ?? '', { reference: true });
    if (!validKey(key) || ibs === null || cbs === null || values.length !== columns.length) {
      throw new Error('Confira a chave e os valores de IBS/CBS na linha ' + (index + 2) + ' do CSV.');
    }
    if (reference.has(key)) throw new Error('Chave repetida na linha ' + (index + 2) + ' do CSV.');
    if (reference.size >= 1000) throw new Error('Use até 1.000 linhas no CSV de referência.');
    reference.set(key, { ibs, cbs });
  }
  if (!reference.size) throw new Error('A planilha está sem linhas de referência.');
  return reference;
}

function compareRows(rows, reference) {
  const frequency = new Map();
  for (const row of rows) {
    if (validKey(row.key)) frequency.set(row.key, (frequency.get(row.key) ?? 0) + 1);
  }

  for (const row of rows) {
    if (frequency.get(row.key) > 1) row.issues.push('Chave repetida no lote.');
    if (!reference || !validKey(row.key)) continue;
    const official = reference.get(row.key);
    if (!official) {
      row.issues.push('Chave não encontrada na planilha.');
      continue;
    }
    row.referenceIbs = official.ibs;
    row.referenceCbs = official.cbs;
    for (const [tax, field] of [['IBS', 'ibs'], ['CBS', 'cbs']]) {
      if (row[field] === null) row.issues.push('Total de ' + tax + ' ausente no XML.');
      else if (row[field] !== official[field]) row.issues.push('Total de ' + tax + ' diverge da planilha.');
    }
  }

  for (const [key, values] of reference ?? []) {
    if (!frequency.has(key)) rows.push({
      file: '', key, number: '', date: '', protocol: '', ibs: null, cbs: null,
      referenceIbs: values.ibs, referenceCbs: values.cbs,
      issues: ['Chave da planilha sem XML no lote.'],
    });
  }
  return rows;
}

function create(tag, text) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  return element;
}

function displayMoney(amount) {
  return amount == null ? '—' : currency.format(amount / 100);
}

function renderResults(container, rows) {
  const table = create('table');
  const headings = ['Arquivo', 'Chave', 'NF / Emissão', 'Protocolo', 'IBS no XML', 'CBS no XML', 'IBS no CSV', 'CBS no CSV', 'Resultado'];
  const header = table.createTHead().insertRow();
  for (const title of headings) {
    const cell = create('th', title);
    cell.scope = 'col';
    header.append(cell);
  }
  const body = table.createTBody();
  for (const row of rows) {
    const values = [row.file, row.key, [row.number, row.date.slice(0, 10)].filter(Boolean).join(' / '), row.protocol,
      displayMoney(row.ibs), displayMoney(row.cbs), displayMoney(row.referenceIbs), displayMoney(row.referenceCbs),
      row.issues.join(' ') || 'Sem divergências nas verificações realizadas.'];
    const line = body.insertRow();
    for (const [index, text] of values.entries()) {
      const cell = create('td', text || '—');
      if (index === 0) cell.className = 'file-cell';
      if (index === 1) cell.className = 'key-cell';
      line.append(cell);
    }
  }
  container.replaceChildren(table);
  container.hidden = false;
}

function csvCell(content) {
  const text = String(content ?? '');
  const safe = /^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function exportRows(rows) {
  const money = (amount) => amount == null ? '' : (amount / 100).toFixed(2).replace('.', ',');
  const content = [
    ['arquivo', 'chave', 'numero', 'emissao', 'protocolo', 'ibs_xml', 'cbs_xml', 'ibs_csv', 'cbs_csv', 'resultado'],
    ...rows.map((row) => [row.file, row.key, row.number, row.date, row.protocol, money(row.ibs), money(row.cbs),
      money(row.referenceIbs), money(row.referenceCbs), row.issues.join(' ') || 'Sem divergências nas verificações realizadas.']),
  ].map((row) => row.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }));
  const download = create('a');
  download.href = url;
  download.download = 'conferencia-nfe.csv';
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wireConsultation() {
  const form = document.querySelector('#consulta-form');
  if (!form) return;
  const input = document.querySelector('#chave');
  const result = document.querySelector('#consulta-resultado');
  const link = document.querySelector('#consulta-portal');
  input.addEventListener('input', () => { link.hidden = true; result.textContent = ''; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const key = normalizeKey(input.value);
    const valid = validKey(key);
    result.textContent = valid
      ? 'Formato e dígito conferidos. Abra o portal para consultar a situação.'
      : 'Confira os 44 caracteres e o dígito verificador da chave de uma NF-e modelo 55.';
    link.hidden = !valid;
    if (valid) {
      const search = new URLSearchParams({ nfe: key, tipoConsulta: 'resumo', tipoConteudo: '7PhJ+gAVw2g=' });
      link.href = PORTAL + '?' + search;
    }
  });
}

function wireValidation() {
  const form = document.querySelector('#xml-form');
  if (!form) return;
  const files = document.querySelector('#xml-files');
  const inputReference = document.querySelector('#ref-file');
  const result = document.querySelector('#xml-resultado');
  const table = document.querySelector('#xml-tabela');
  const button = document.querySelector('#baixar-csv');
  const submit = form.querySelector('button[type=submit]');
  let report = [];
  button.addEventListener('click', () => exportRows(report));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    button.hidden = true;
    table.hidden = true;
    result.textContent = 'Analisando arquivos…';

    try {
      const batch = Array.from(files.files);
      if (!batch.length || batch.length > 50) throw new Error('Escolha de 1 a 50 arquivos XML.');
      const csv = inputReference.files[0];
      if (csv?.size > MAX_REFERENCE) throw new Error('A planilha deve ter até 2 MB.');
      const reference = csv ? parseReference(await csv.text()) : null;
      const rows = [];
      for (const file of batch) {
        if (file.size > MAX_FILE) {
          rows.push({ file: file.name, key: '', number: '', date: '', protocol: '', issues: ['Arquivo acima de 5 MB.'] });
        } else {
          rows.push(parseXml(file.name, await file.text()));
        }
      }
      report = compareRows(rows, reference);
      const flagged = report.filter((row) => row.issues.length).length;
      result.textContent = batch.length + ' XML(s) analisado(s). ' + flagged + ' linha(s) para revisão.';
      renderResults(table, report);
      button.hidden = false;
    } catch (error) {
      result.textContent = error.message || 'Não foi possível analisar os arquivos.';
    } finally {
      submit.disabled = false;
    }
  });
}

wireConsultation();
wireValidation();
`;

function document(title, content) {
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escape(title) + ' | Contábil</title><style>' + theme +
    '</style></head><body>' + content + '</body></html>';
}

function brand() {
  return '<a class="brand" href="/"><span class="mark" aria-hidden="true">C</span>Contábil</a>';
}

function notice(message, error = false) {
  return message
    ? '<p class="notice' + (error ? ' error" role="alert">' : '" role="status">') + escape(message) + '</p>'
    : '';
}

function loginPage({ signup = false, message = '', error = false, email = '' } = {}) {
  const title = signup ? 'Crie sua conta' : 'Entre na sua conta';
  const target = signup ? '/cadastro' : '/entrar';
  return document(title,
    '<main class="auth"><div class="intro">' + brand() +
    '<h2>Seu painel de trabalho contábil</h2></div><section class="auth-content"><div><h1>' +
    title + '</h1><p>' + (signup ? 'Cadastre seu e-mail para acessar o painel.' : 'Acesse o painel do contador.') +
    '</p>' + notice(message, error) + '<form action="' + target + '" method="post">' +
    '<label for="email">E-mail</label><input id="email" name="email" type="email" value="' +
    escape(email) + '" autocomplete="email" maxlength="254" required>' +
    '<label for="password">Senha</label><input id="password" name="password" type="password" autocomplete="' +
    (signup ? 'new-password" minlength="10' : 'current-password') + '" maxlength="72" required>' +
    (signup ? '<p>Use pelo menos 10 caracteres.</p>' : '') +
    '<button class="login-button">' + (signup ? 'Criar conta' : 'Entrar') + '</button></form>' +
    (signup ? '<a href="/entrar">Já tenho conta</a>' : '<a href="/cadastro">Criar conta</a>') +
    '</div></section></main>');
}


const portal = 'https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx';
const links = {
  sefaz: 'https://www.nfe.fazenda.gov.br/portal/webservices.aspx',
  nuvem: 'https://dev.nuvemfiscal.com.br/docs/distribuicao-nfe/',
  sped: 'https://github.com/nfephp-org/sped-nfe',
  xsd: 'https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=BMPFMBoln3w%3D',
};

const views = {
  painel: { href: '/painel', label: 'Visão geral' },
  consulta: { href: '/conferidor?aba=consulta', label: 'Consultar NF-e' },
  xml: { href: '/conferidor', label: 'Validar e conferir XML' },
  integracoes: { href: '/conferidor?aba=integracoes', label: 'Integrações fiscais' },
  perfil: { href: '/painel?aba=perfil', label: 'Meu perfil' },
};

function menuLink(key, current) {
  const view = views[key];
  return '<a href="' + view.href + '"' + (key === current ? ' aria-current="page"' : '') + '>' + view.label + '</a>';
}

function external(url, text) {
  return '<a class="integration-link" href="' + escape(url) + '" target="_blank" rel="noopener noreferrer">' + escape(text) + '</a>';
}

function pageContent(page, session, name, message, error) {
  switch (page) {
    case 'painel':
      return '<h1>Visão geral</h1><p class="page-intro">' +
        (name ? 'Olá, ' + escape(name) + '.' : 'Escolha como quer conferir suas notas fiscais.') +
        '</p><div class="tiles"><section class="card"><h2>Consultar NF-e</h2><p>Confira o dígito da chave de acesso e abra a consulta no Portal Nacional da NF-e.</p>' +
        '<a class="button" href="' + views.consulta.href + '">Consultar por chave</a></section>' +
        '<section class="card"><h2>Validar e conferir XML</h2><p>Revise um lote de notas, veja os totais de IBS e CBS e compare com uma planilha de referência.</p>' +
        '<a class="button" href="' + views.xml.href + '">Analisar XMLs</a></section></div>';
    case 'perfil':
      return '<h1>Meu perfil</h1><section class="card"><p>' + escape(session.user.email) + '</p>' +
        notice(message, error) + '<form action="/perfil" method="post"><label for="nome">Seu nome</label>' +
        '<input id="nome" name="nome" autocomplete="name" maxlength="80" required value="' +
        escape(name) + '"><button>Salvar perfil</button></form></section>';
    case 'consulta':
      return '<h1>Consultar NF-e</h1><p class="page-intro">Valide a chave do DANFE e consulte a situação da nota no Portal Nacional.</p>' +
        '<section class="card"><form id="consulta-form"><label for="chave">Chave de acesso de 44 caracteres</label>' +
        '<input id="chave" placeholder="Cole a chave de acesso" maxlength="75" autocomplete="off" spellcheck="false" required>' +
        '<button type="submit">Validar chave</button></form><p id="consulta-resultado" class="hint" role="status"></p>' +
        '<a id="consulta-portal" class="button secondary" href="' + portal +
        '" target="_blank" rel="noopener noreferrer" hidden>Abrir consulta na SEFAZ</a></section>' +
        '<p class="hint">A chave é conferida aqui. Para verificar a autorização ou o cancelamento, conclua a consulta no portal oficial.</p>';
    case 'xml':
      return '<h1>Validar e conferir XML</h1><p class="page-intro">Confira a estrutura básica, a chave, o protocolo e os valores de IBS e CBS informados na NF-e modelo 55.</p>' +
        '<section class="card"><form id="xml-form"><div class="field-group"><label for="xml-files">Arquivos XML</label>' +
        '<input id="xml-files" type="file" accept=".xml,text/xml,application/xml" multiple><p class="hint">Até 50 arquivos por lote, com até 5 MB por arquivo. Os documentos são processados neste navegador.</p></div>' +
        '<div class="field-group"><label for="ref-file">Planilha de referência (opcional)</label>' +
        '<input id="ref-file" type="file" accept=".csv,text/csv"><p class="hint">CSV separado por ponto e vírgula, com as colunas chave;ibs;cbs. Use o arquivo de apuração ou do ERP convertido para esse formato. No Excel, importe a chave como texto para preservar os 44 caracteres.</p>' +
        '<a href="/conferidor?recurso=modelo" download>Baixar modelo CSV</a></div>' +
        '<div class="actions"><button type="submit">Analisar lote</button><button id="baixar-csv" class="secondary" type="button" hidden>Baixar relatório CSV</button></div></form>' +
        '<p id="xml-resultado" role="status" class="hint"></p><div class="results" tabindex="0" aria-label="Resultados da conferência" id="xml-tabela" hidden></div></section>' +
        '<p class="hint">A conferência identifica divergências nos arquivos. A validade da assinatura, o esquema XSD completo e a situação atual na SEFAZ exigem verificações próprias.</p>';
    default:
      return '<h1>Integrações fiscais</h1><p class="page-intro">Referências para automatizar a consulta de situação e a obtenção de XMLs autorizados.</p>' +
        '<div class="tiles"><section class="card"><h2>SEFAZ</h2><p>Use o NFeConsultaProtocolo para consultar situação pela chave e o NFeDistribuicaoDFe para buscar documentos de interesse do CNPJ habilitado. A integração exige certificado digital.</p>' +
        external(links.sefaz, 'Web services oficiais') + '</section><section class="card"><h2>Nuvem Fiscal</h2><p>API REST para distribuir os documentos do CNPJ autorizado. Exige credenciais da API, cadastro da empresa e certificado digital.</p>' +
        external(links.nuvem, 'Documentação da API') + '</section><section class="card"><h2>NFePHP</h2><p>Biblioteca PHP de código aberto para comunicação com os serviços da SEFAZ.</p>' + external(links.sped, 'Código no GitHub') +
        '</section><section class="card"><h2>Esquemas XML</h2><p>Os pacotes oficiais trazem os XSDs para validação completa do leiaute.</p>' + external(links.xsd, 'Pacotes XSD oficiais') + '</section></div>';
  }
}

function dashboard(session, { page = 'painel', name = '', message = '', error = false } = {}) {
  return document(views[page].label,
    '<div class="shell"><aside class="rail">' + brand() + '<nav aria-label="Menu principal">' +
    menuLink('painel', page) + '<p class="menu-group">Notas fiscais</p>' +
    menuLink('consulta', page) + menuLink('xml', page) +
    '<p class="menu-group">Configurações</p>' + menuLink('integracoes', page) + menuLink('perfil', page) +
    '</nav></aside><div class="workspace"><header class="top"><p class="email">' + escape(session.user.email) + '</p>' +
    '<form action="/sair" method="post"><button class="out">Sair</button></form></header><main class="content">' +
    pageContent(page, session, name, message, error) + '</main></div></div>' +
    (page === 'consulta' || page === 'xml' ? '<script defer src="/conferidor?recurso=script"></script>' : ''));
}

function activePage(route, tab) {
  if (route === 'painel') return tab === 'perfil' ? 'perfil' : 'painel';
  return tab === 'consulta' || tab === 'integracoes' ? tab : 'xml';
}


async function readProfile(session) {
  const result = await supabase('/rest/v1/perfis?select=nome&limit=1', { token: session.token });
  if (!result.ok) throw new Error('Perfil indisponível');
  return result.data[0]?.nome ?? '';
}

async function handleLogin(req, res, form, signup) {
  const email = String(form.email ?? '').trim().slice(0, 254);
  const password = String(form.password ?? '');
  const bytes = Buffer.byteLength(password);
  const show = (status, message, error = true) =>
    respond(res, status, loginPage({ signup, message, error, email }));

  if (!email || !password || bytes > 72 || (signup && password.length < 10)) {
    return show(400, 'Confira o e-mail e a senha.');
  }

  const url = signup
    ? '/auth/v1/signup?redirect_to=' + encodeURIComponent(req.headers.origin + '/entrar')
    : '/auth/v1/token?grant_type=password';
  const result = await supabase(url, { method: 'POST', data: { email, password } });

  if (result.ok && result.data?.access_token) {
    setSession(res, result.data);
    return redirect(res, '/painel');
  }
  if (result.ok && signup) {
    return respond(res, 200, loginPage({
      email, message: 'Confirme seu e-mail para entrar. Se preciso, verifique a pasta de spam.',
    }));
  }
  if (result.status === 429) return show(429, 'Muitas tentativas. Aguarde alguns minutos.');
  if (result.status >= 500) return show(503, 'O acesso está indisponível. Tente novamente em instantes.');
  if (result.data?.error_code === 'email_not_confirmed') return show(400, 'Confirme seu e-mail antes de entrar.');
  return show(400, signup ? 'Confira os dados ou tente entrar com uma conta já criada.' : 'E-mail ou senha inválidos.');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname.replace(/^\/+|\/+$/g, '');
  const route = (typeof req.query?.route === 'string' ? req.query.route : path) || 'inicio';

  const resource = req.query?.recurso ?? url.searchParams.get('recurso');
  if (req.method === 'GET' && route === 'conferidor' && resource === 'script') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    return res.end(fiscalScript);
  }
  if (req.method === 'GET' && route === 'conferidor' && resource === 'modelo') {
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modelo-conferencia-nfe.csv"',
    });
    return res.end('\uFEFFchave;ibs;cbs\r\n');
  }

  try {
    if (req.method === 'POST') {
      if (!actions.has(route)) return respond(res, 404, document('Página não encontrada', '<h1>Página não encontrada</h1>'));
      if (req.headers.origin !== 'https://' + req.headers.host) {
        return respond(res, 403, document('Solicitação recusada', '<h1>Solicitação recusada</h1>'));
      }
      if (!configured()) throw new Error('Supabase indisponível');
      if (route === 'sair') {
        const session = await currentSession(req, res);
        setSession(res, null);
        if (session) await supabase('/auth/v1/logout?scope=local', { method: 'POST', token: session.token }).catch(() => {});
        return redirect(res, '/entrar');
      }
      if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) {
        return respond(res, 415, document('Formato inválido', '<h1>Formato inválido</h1>'));
      }

      const form = typeof req.body === 'string'
        ? Object.fromEntries(new URLSearchParams(req.body))
        : req.body ?? {};
      if (route === 'entrar' || route === 'cadastro') return await handleLogin(req, res, form, route === 'cadastro');

      const session = await currentSession(req, res);
      if (!session) return redirect(res, '/entrar');
      const name = String(form.nome ?? '').trim();
      if (!name || [...name].length > 80) {
        return respond(res, 400, dashboard(session, { page: 'perfil', name: await readProfile(session), message: 'Informe um nome de até 80 caracteres.', error: true }));
      }

      const result = await supabase('/rest/v1/perfis?on_conflict=user_id', {
        method: 'POST', token: session.token, data: { user_id: session.user.id, nome: name },
        prefer: 'resolution=merge-duplicates,return=minimal',
      });
      if (!result.ok) throw new Error('Perfil indisponível');
      return redirect(res, '/painel?aba=perfil&perfil=salvo');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD, POST');
      return respond(res, 405, document('Método inválido', '<h1>Método inválido</h1>'));
    }
    if (route !== 'inicio' && !screens.has(route)) {
      return respond(res, 404, document('Página não encontrada', '<h1>Página não encontrada</h1>'));
    }

    const session = configured() ? await currentSession(req, res) : null;
    if (route === 'inicio') return redirect(res, session ? '/painel' : '/entrar');
    if (route === 'entrar' || route === 'cadastro') {
      return session ? redirect(res, '/painel') : respond(res, 200, loginPage({ signup: route === 'cadastro' }));
    }
    if (!session) return redirect(res, '/entrar');

    const page = activePage(route, req.query?.aba ?? url.searchParams.get('aba'));
    const saved = (req.query?.perfil ?? url.searchParams.get('perfil')) === 'salvo';
    return respond(res, 200, dashboard(session, {
      page, name: route === 'painel' ? await readProfile(session) : '',
      message: saved ? 'Perfil salvo.' : '',
    }));
  } catch {
    return respond(res, 503, document('Serviço indisponível',
      '<main class="content"><h1>Serviço indisponível</h1><p>Tente novamente em instantes.</p><a href="/">Voltar</a></main>'));
  }
};
