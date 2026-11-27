import { createHash } from 'node:crypto';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';

const archiveUrl = new URL('https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=YhWikFoTxUo%3D');
const expectedSha256 = 'bcbf6b277f79a6983d69016dfe0430f09b8a191997a4706a24938acddc18dc81';
const sourcePath = 'PL_010h_v1.03/NFe/';
const output = 'public/nfe-xsd';
const schemaNames = [
  'nfe_v4.00.xsd',
  'leiauteNFe_v4.00.xsd',
  'tiposBasico_v4.00.xsd',
  'DFeTiposBasicos_v1.00.xsd',
  'xmldsig-core-schema_v1.01.xsd',
];

async function download() {
  let url = archiveUrl;
  const cookies = new Map();
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { cookie: Array.from(cookies.values()).join('; ') },
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const location = response.headers.get('location');
    if (!location || response.status < 300 || response.status >= 400) {
      throw new Error('Falha no download do pacote da NF-e: HTTP ' + response.status);
    }
    for (const setCookie of response.headers.getSetCookie()) {
      const pair = setCookie.split(';', 1)[0];
      cookies.set(pair.split('=', 1)[0], pair);
    }
    await response.body?.cancel();
    url = new URL(location, url);
    if (url.origin !== archiveUrl.origin) throw new Error('Redirecionamento fora do Portal Nacional da NF-e');
  }
  throw new Error('Redirecionamentos em excesso no Portal Nacional da NF-e');
}

const zip = await download();
const hash = createHash('sha256').update(zip).digest('hex');
if (hash !== expectedSha256) throw new Error('O arquivo do Portal Nacional mudou. Revise o novo pacote antes de publicar.');

const archive = unzipSync(zip);
await mkdir(output, { recursive: true });
for (const name of schemaNames) {
  const bytes = archive[sourcePath + name];
  if (!bytes) throw new Error('XSD ausente no pacote oficial: ' + name);
  await writeFile(output + '/' + name, bytes);
}

// The current package defines TNfeProc in the official layout, but includes only
// the top-level entry point for NFe. Bind the processed document to that type.
await writeFile(output + '/procNFe_v4.00.xsd', [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"',
  '  targetNamespace="http://www.portalfiscal.inf.br/nfe"',
  '  xmlns:nfe="http://www.portalfiscal.inf.br/nfe" elementFormDefault="qualified">',
  '  <xs:include schemaLocation="leiauteNFe_v4.00.xsd"/>',
  '  <xs:element name="nfeProc" type="nfe:TNfeProc"/>',
  '</xs:schema>',
  '',
].join('\n'));

for (const name of ['index-browser.mjs', 'xmllint-browser.mjs', 'xmllint.wasm', 'COPYING']) {
  await copyFile('node_modules/xmllint-wasm/' + name, output + '/' + name);
}
await copyFile('src/nfe-xsd.mjs', output + '/validator.mjs');
console.log('PL 010h v1.03 e validador WebAssembly preparados.');
