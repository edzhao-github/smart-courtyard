import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store.mjs';
import { blank } from '../lib/plan.ts';
import { emptyOperations } from '../lib/operations.ts';

test('server data survives restart, rejects stale revisions and invalid writes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'courtyard-test-'));
 let store=openStore(dir);
 try {
  const input={plan:{...blank,name:'迁移数据'},operations:emptyOperations};
  assert.equal(store.save(input,0,'migration'),1);
  assert.equal(store.save({...input,plan:{...blank,name:'新名称'}},1,'admin'),2);
  assert.equal(store.save(input,1,'stale-tab'),null);
  assert.throws(()=>store.save({...input,plan:null},2,'admin'));
  store.db.close();store=openStore(dir);
  assert.equal(store.read().plan.name,'新名称');
  assert.equal(store.read().revision,2);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM revisions').get().n,2);
 } finally{store.db.close();rmSync(dir,{recursive:true,force:true});}
});
test('passwords are hashed; invalid, expired and revoked sessions cannot authenticate',()=>{
 const dir=mkdtempSync(join(tmpdir(),'courtyard-auth-'));const store=openStore(dir);
 try{
  store.setUser('admin','a-long-test-password');
  assert.equal(store.login('admin','incorrect'),null);
  assert.equal(store.login('missing','a-long-test-password'),null);
  const token=store.login('admin','a-long-test-password');
  assert.equal(store.session(token),'admin');
  assert.notEqual(store.db.prepare('SELECT hash FROM users').get().hash,'a-long-test-password');
  assert.notEqual(store.db.prepare('SELECT token FROM sessions').get().token,token);
  store.db.prepare('UPDATE sessions SET expires=0').run();assert.equal(store.session(token),undefined);
  const second=store.login('admin','a-long-test-password');store.logout(second);assert.equal(store.session(second),undefined);
  const third=store.login('admin','a-long-test-password');store.setUser('admin','a-new-long-password');assert.equal(store.session(third),undefined);
 }finally{store.db.close();rmSync(dir,{recursive:true,force:true});}
});

test('gateway protects pages and APIs, enforces origin and invalidates logout',async()=>{
 const { spawn }=await import('node:child_process');
 const { createServer }=await import('node:http');
 const { once }=await import('node:events');
 const dir=mkdtempSync(join(tmpdir(),'courtyard-gateway-'));
 const store=openStore(dir);store.setUser('admin','temporary-test-password');store.save({plan:blank,operations:emptyOperations},0,'test');store.db.close();
 const upstream=createServer((req,res)=>res.end('authenticated upstream'));
 upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
 const child=spawn(process.execPath,['--experimental-strip-types','server/gateway.mjs'],{env:{...process.env,COURTYARD_DATA:dir,PORT:'0',COURTYARD_ORIGIN:'http://localhost',UPSTREAM_PORT:String(upstream.address().port)},stdio:['ignore','pipe','pipe']});
 try{
  const port=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('gateway startup timeout')),10000);
   child.stdout.on('data',chunk=>{const match=String(chunk).match(/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
   child.once('exit',()=>{clearTimeout(timer);reject(Error('gateway exited before ready'));});
  });
  const base=`http://127.0.0.1:${port}`;
  assert.equal((await fetch(base+'/dashboard',{redirect:'manual'})).status,303);
  assert.equal((await fetch(base+'/api/workspace')).status,401);
  assert.equal((await fetch(base+'/api/meter')).status,401);
  const login=await fetch(base+'/auth/login',{method:'POST',redirect:'manual',headers:{Origin:'http://localhost'},body:new URLSearchParams({username:'admin',password:'temporary-test-password'})});
  assert.equal(login.status,303);
  const rawCookie=login.headers.get('set-cookie');assert.match(rawCookie,/HttpOnly/);assert.match(rawCookie,/SameSite=Strict/);
  const headers={Cookie:rawCookie.split(';')[0],Origin:'http://localhost','Content-Type':'application/json'};
  const response=await fetch(base+'/api/workspace',{headers});const data=await response.json();assert.equal(data.revision,1);
  assert.equal(await (await fetch(base+'/dashboard',{headers})).text(),'authenticated upstream');
  assert.equal((await fetch(base+'/api/workspace',{method:'PUT',headers:{...headers,Origin:'http://evil.invalid'},body:JSON.stringify(data)})).status,403);
  assert.equal((await fetch(base+'/api/workspace',{method:'PUT',headers,body:JSON.stringify(data)})).status,200);
  assert.equal((await fetch(base+'/api/workspace',{method:'PUT',headers,body:JSON.stringify(data)})).status,409);
  assert.equal((await fetch(base+'/auth/logout',{method:'POST',headers,redirect:'manual'})).status,303);
  assert.equal((await fetch(base+'/api/session',{headers})).status,401);
 }finally{child.kill('SIGTERM');await once(child,'exit');upstream.closeAllConnections();upstream.close();rmSync(dir,{recursive:true,force:true});}
});
