import { validateXML } from './index-browser.mjs';

const entries = new Map([
  ['NFe', 'nfe_v4.00.xsd'],
  ['nfeProc', 'procNFe_v4.00.xsd'],
]);
const dependencies = [
  'leiauteNFe_v4.00.xsd',
  'tiposBasico_v4.00.xsd',
  'DFeTiposBasicos_v1.00.xsd',
  'xmldsig-core-schema_v1.01.xsd',
];
const maxErrors = 8;
let filesPromise;

function loadFiles() {
  filesPromise ??= Promise.all([...entries.values(), ...dependencies].map(async (fileName) => {
    const response = await fetch(new URL(fileName, import.meta.url), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Falha ao carregar o esquema ' + fileName);
    return [fileName, { fileName, contents: await response.text() }];
  })).then((files) => new Map(files)).catch((error) => {
    filesPromise = undefined;
    throw error;
  });
  return filesPromise;
}

export async function checkLayout(root, xml) {
  const files = await loadFiles();
  const result = await validateXML({
    xml: { fileName: 'nota.xml', contents: xml },
    schema: files.get(entries.get(root)),
    preload: dependencies.map((name) => files.get(name)),
    maxMemoryPages: 1024,
    modifyArguments: (args) => ['--nonet', ...args],
  });
  if (result.valid) return { status: 'Conforme', issues: [] };

  const issues = result.errors.slice(0, maxErrors).map(({ message, loc }) => {
    const line = loc?.fileName === 'nota.xml' && loc.lineNumber > 0 ? ' (linha ' + loc.lineNumber + ')' : '';
    return 'XSD' + line + ': ' + message.trim().replaceAll('{http://www.portalfiscal.inf.br/nfe}', '').slice(0, 1200);
  });
  if (!issues.length) issues.push('O XML não passou na validação do leiaute XSD.');
  if (result.errors.length > maxErrors) issues.push('O XSD encontrou mais ' + (result.errors.length - maxErrors) + ' ocorrência(s).');
  return { status: 'Com erros', issues };
}
