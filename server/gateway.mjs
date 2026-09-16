import http from 'node:http';
import https from 'node:https';
import { readFileSync } from 'node:fs';
import { openStore } from './store.mjs';
const store = openStore(process.env.COURTYARD_DATA || './data');
const host = process.env.COURTYARD_BIND || '127.0.0.1';
const port = Number(process.env.PORT || 3180);
const upstreamPort = Number(process.env.UPSTREAM_PORT || 3181);
const publicOrigin = process.env.COURTYARD_ORIGIN || `http://localhost:${port}`;
const secure = publicOrigin.startsWith('https://');
if (secure && (!process.env.COURTYARD_TLS_CERT || !process.env.COURTYARD_TLS_KEY)) throw Error('HTTPS origin requires TLS certificate and key');
const loginPage = readFileSync(new URL('./login.html', import.meta.url));
const attempts = new Map();
function cookie(token, age = 43200) { return `courtyard_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`; }
function json(res, code, value) { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(value)); }
function redirect(res, location, extra = {}) { res.writeHead(303, {Location:location,...extra}); res.end(); }
async function body(req, max = 12 * 1024 * 1024) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > max) { const e = Error('内容过大'); e.status=413; throw e; } chunks.push(chunk); }
  return Buffer.concat(chunks).toString('utf8');
}
const handler = async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','same-origin');
  try {
    const path = new URL(req.url, publicOrigin).pathname;
    const mutating = !['GET','HEAD','OPTIONS'].includes(req.method);
    // Reverse proxy may change Host; only the explicitly configured browser origin is accepted.
    if (mutating && (req.headers.origin !== publicOrigin || req.headers['sec-fetch-site'] === 'cross-site')) return json(res,403,{error:'来源校验失败'});
    if (path === '/login' && req.method === 'GET') { res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); return res.end(loginPage); }
    if (path === '/auth/login' && req.method === 'POST') {
      const input = new URLSearchParams(await body(req,4096));
      const ip = req.socket.remoteAddress;
      const now = Date.now();
      for (const [key,value] of attempts) if (value.until < now) attempts.delete(key);
      const entry = attempts.get(ip) || { count:0, until:now+15*60_000 };
      if (++entry.count > 10) { attempts.set(ip,entry); return redirect(res,'/login?error=limited'); }
      attempts.set(ip,entry);
      const token = store.login(input.get('username') || '', input.get('password') || '');
      if (!token) return redirect(res,'/login?error=credentials');
      attempts.delete(ip);
      return redirect(res,'/dashboard',{'Set-Cookie':cookie(token)});
    }
    const token = /(?:^|;\s*)courtyard_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    const user = store.session(token);
    if (!user) return path.startsWith('/api/') ? json(res,401,{error:'请先登录'}) : redirect(res,'/login');
    if (path === '/auth/logout' && req.method === 'POST') { store.logout(token); return redirect(res,'/login',{'Set-Cookie':cookie('',0)}); }
    if (path === '/api/session' && req.method === 'GET') return json(res,200,{username:user,storage:'server'});
    if (path === '/api/workspace') {
      if (req.method === 'GET') return json(res,200,store.read());
      if (req.method === 'PUT') {
        const input = JSON.parse(await body(req));
        if (!Number.isSafeInteger(input.revision) || input.revision < 0) return json(res,400,{error:'版本无效'});
        let revision;
        try { revision=store.save(input,input.revision,user); } catch { return json(res,422,{error:'数据校验失败，原数据已保留'}); }
        return revision === null ? json(res,409,{error:'另一窗口已更新数据，请先导出本页备份，再刷新核对。'}) : json(res,200,{revision});
      }
      return json(res,405,{error:'不支持的操作'});
    }
    // App only listens on loopback; every page, RSC, asset and API passes authentication here.
    const headers = {...req.headers,host:`localhost:${upstreamPort}`};
    delete headers['x-forwarded-host']; delete headers['x-forwarded-proto'];
    if (headers.origin) headers.origin = `http://localhost:${upstreamPort}`;
    const proxy = http.request({hostname:'127.0.0.1',port:upstreamPort,path:req.url,method:req.method,headers}, upstream => {
      res.writeHead(upstream.statusCode,{...upstream.headers,'cache-control':'no-store','x-frame-options':'DENY'});
      upstream.pipe(res);
    });
    proxy.setTimeout(30000,()=>proxy.destroy());
    proxy.on('error',()=> { if (!res.headersSent) json(res,502,{error:'服务正在启动，请稍后重试'}); else res.end(); });
    req.pipe(proxy);
  } catch (e) { if (!res.headersSent) json(res,e.status || 400,{error:'请求未完成，请检查输入'}); else res.end(); }
};
export const server = process.env.COURTYARD_TLS_CERT && process.env.COURTYARD_TLS_KEY
  ? https.createServer({cert:readFileSync(process.env.COURTYARD_TLS_CERT),key:readFileSync(process.env.COURTYARD_TLS_KEY),minVersion:'TLSv1.2'},handler)
  : http.createServer(handler);
server.listen(port,host,()=>console.log(`Courtyard gateway listening on ${host}:${server.address().port}`));
function close() { server.close(()=>{store.db.close(); process.exit(0);}); setTimeout(()=>process.exit(0),10000).unref(); }
process.on('SIGTERM',close);process.on('SIGINT',close);
