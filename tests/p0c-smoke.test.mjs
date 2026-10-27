import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const script = resolve(dirname(fileURLToPath(import.meta.url)), '../scripts/p0c-smoke.mjs');
async function run(responder, env={}) {
  const server = createServer((req, res) => {
    const [status, body] = responder(req.url);
    res.writeHead(status, {'Content-Type':'application/json'});
    res.end(JSON.stringify(body));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const port = server.address().port;
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(process.execPath,[script,`--base-url=http://127.0.0.1:${port}`],{env:{...process.env,...env}});
      let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
      child.on('error',reject);child.on('close',code=>resolve({code,output}));
    });
  } finally { await new Promise(resolve=>server.close(resolve)); }
}
const good = path => path === '/api/health/readiness' ? [200,{ok:true,mode:'staging',status:'READY'}] :
  path === '/api/event/public-snapshot' ? [200,{ok:true,data:{event:{status:'CHECK_IN_OPEN'},teams:[]}}] :
  [401,{ok:false,error:{code:'UNAUTHORIZED'}}];
test('healthy read-only service passes', async()=>{const r=await run(good);assert.equal(r.code,0,r.output);assert.match(r.output,/SMOKE PASS/)});
test('admin route exposed without login fails',async()=>{const r=await run(path=>path==='/api/event/snapshot'?[200,{ok:true}]:good(path));assert.equal(r.code,1,r.output);});
test('publicly leaked private field fails',async()=>{const r=await run(path=>path==='/api/event/public-snapshot'?[200,{ok:true,data:{checkIns:[]}}]:good(path));assert.equal(r.code,1,r.output);});
test('wrong mode fails',async()=>{const r=await run(path=>path==='/api/health/readiness'?[200,{ok:true,mode:'mock',status:'READY'}]:good(path));assert.equal(r.code,1,r.output);});
