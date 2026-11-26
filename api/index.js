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

const theme = "\n:root{color-scheme:light;--ink:#132822;--muted:#50635b;--line:#dce5df;--green:#18684d;--surface:#fff;--bg:#f3f6f3;font:16px/1.5 system-ui,sans-serif}\n*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink)}a{color:var(--green);text-underline-offset:3px}\n.brand{display:inline-flex;gap:.65rem;align-items:center;color:inherit;text-decoration:none;font-size:1.25rem;font-weight:750;letter-spacing:-.04em}\n.mark{display:grid;place-items:center;width:2rem;height:2rem;border-radius:.6rem;background:#d5eddf;color:#174d39;font-size:1rem;letter-spacing:0}\n.auth{min-height:100dvh;display:grid;grid-template-columns: minmax(18rem,1fr) minmax(24rem,1.15fr)}\n.intro{display:flex;flex-direction:column;justify-content:space-between;padding:clamp(2rem,6vw,6rem);background:#133c2f;color:#e4f3ea}\n.intro h2{font-size:clamp(2rem,5vw,4.5rem);font-weight:660;line-height:1.02;letter-spacing:-.07em;margin:2rem 0}\n.auth-content{display:grid;place-items:center;padding:2rem}.auth-content>div{width:min(100%,25rem)}\nh1,h2,p{margin-top:0}h1{margin-bottom:.35rem;line-height:1.1;font-size:clamp(2rem,5vw,3.25rem);letter-spacing:-.05em}h2{letter-spacing:-.025em}\np{color:var(--muted)}label{display:block;font-weight:650;font-size:.9rem;margin:1rem 0 .3rem}\ninput{font:inherit;width:100%;min-width:0;border:1px solid #a6b8ae;border-radius:.65rem;padding:.75rem .85rem;color:var(--ink);background:var(--surface)}\nbutton,.button{display:inline-flex;justify-content:center;align-items:center;font:inherit;font-weight:650;background:var(--green);color:white;border:1px solid transparent;border-radius:.65rem;padding:.65rem .95rem;text-decoration:none;cursor:pointer}.login-button{width:100%;margin:1.25rem 0 .85rem}\n:focus-visible{outline:3px solid #3688bd;outline-offset:3px}.notice{border:1px solid #aacdb8;background:#e4f2e8;border-radius:.6rem;padding:.75rem;margin:1rem 0;color:#174d39}.notice.error{background:#fff0ed;border-color:#f0b3ab;color:#7d2520}\n.top{border-bottom:1px solid var(--line);min-height:4.6rem;background:var(--surface);display:flex;justify-content:space-between;align-items:center;padding:0 clamp(1rem,4vw,3rem);gap:1rem}\n.out{background:white;color:var(--ink);border-color:var(--line)}.shell{max-width:86rem;margin:auto;display:grid;grid-template-columns:14rem minmax(0,1fr)}\nnav{padding:2rem 1.25rem}nav a{display:block;color:var(--ink);text-decoration:none;padding:.75rem .9rem;border-radius:.6rem;margin-bottom:.25rem;font-weight:630}\nnav a[aria-current]{background:#dceee3;color:#174d39}nav a:hover{background:#e8f0ea}.content{padding:2.6rem clamp(1rem,5vw,4rem)}\n.card{max-width:46rem;background:white;border:1px solid var(--line);padding:clamp(1.1rem,3vw,1.8rem);border-radius:1rem;margin-top:1.3rem}.card h2{margin-bottom:.3rem}.card form{max-width:27rem}.card form button{margin-top:1rem}.email{overflow-wrap:anywhere}\n@media(max-width:700px){.auth{display:block}.intro{padding:1.35rem}.intro h2{display:none}.auth-content{padding:2rem 1.15rem}.shell{display:block}nav{display:flex;gap:.4rem;padding:1rem 1rem 0;flex-wrap:wrap}.content{padding-top:1.25rem}}\n";

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

function dashboard(session, { page = 'painel', name = '', message = '', error = false } = {}) {
  const isDashboard = page === 'painel';
  return document(isDashboard ? 'Visão geral' : 'Conferidor de NF-e',
    '<header class="top">' + brand() + '<form action="/sair" method="post"><button class="out">Sair</button></form></header>' +
    '<div class="shell"><nav aria-label="Menu principal"><a href="/conferidor"' +
    (isDashboard ? '' : ' aria-current="page"') + '>Conferidor de NF-e</a><a href="/painel"' +
    (isDashboard ? ' aria-current="page"' : '') + '>Visão geral</a></nav><main class="content">' +
    (isDashboard
      ? '<h1>Visão geral</h1><p>' + (name ? 'Olá, ' + escape(name) + '.' : 'Bem-vindo ao seu painel.') +
        '</p><section class="card"><h2>Conferidor de NF-e</h2><p>Conferência de notas fiscais e divergências de IBS e CBS.</p>' +
        '<a href="/conferidor" class="button">Abrir conferidor</a></section>' +
        '<section class="card"><h2>Meu perfil</h2><p class="email">' + escape(session.user.email) + '</p>' +
        notice(message, error) + '<form action="/perfil" method="post"><label for="nome">Seu nome</label>' +
        '<input id="nome" name="nome" autocomplete="name" maxlength="80" required value="' +
        escape(name) + '"><button>Salvar perfil</button></form></section>'
      : '<h1>Conferidor de NF-e</h1><section class="card"><h2>Em preparação</h2>' +
        '<p>A importação dos XMLs e a comparação com a apuração fiscal serão disponibilizadas neste módulo.</p>' +
        '<a href="/painel">Voltar à visão geral</a></section>') + '</main></div>');
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
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

  const path = new URL(req.url, 'http://localhost').pathname.replace(/^\/+|\/+$/g, '');
  const route = (typeof req.query?.route === 'string' ? req.query.route : path) || 'inicio';

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
        return respond(res, 400, dashboard(session, { name: await readProfile(session), message: 'Informe um nome de até 80 caracteres.', error: true }));
      }

      const result = await supabase('/rest/v1/perfis?on_conflict=user_id', {
        method: 'POST', token: session.token, data: { user_id: session.user.id, nome: name },
        prefer: 'resolution=merge-duplicates,return=minimal',
      });
      if (!result.ok) throw new Error('Perfil indisponível');
      return redirect(res, '/painel?perfil=salvo');
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

    const saved = new URL(req.url, 'http://localhost').searchParams.get('perfil') === 'salvo' || req.query?.perfil === 'salvo';
    return respond(res, 200, dashboard(session, {
      page: route, name: route === 'painel' ? await readProfile(session) : '',
      message: saved ? 'Perfil salvo.' : '',
    }));
  } catch {
    return respond(res, 503, document('Serviço indisponível',
      '<main class="content"><h1>Serviço indisponível</h1><p>Tente novamente em instantes.</p><a href="/">Voltar</a></main>'));
  }
};
