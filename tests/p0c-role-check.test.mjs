import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const script=resolve(dirname(fileURLToPath(import.meta.url)),'../scripts/p0c-role-check.mjs');
const admin='00000000-0000-4000-8000-000000009001';
const judge='00000000-0000-4000-8000-000000009101';
async function run({runtime='staging',leak=false,wrongRole=false,mode='unauthenticated'}={}) {
 const server=createServer((req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  let status=200;
  let body={ok:true,status:'READY',mode:runtime};
  if(path!=='/api/health/readiness'){
   const id=req.headers['x-p0b-test-user'];
   const valid=runtime==='postgres-test'&&req.headers['x-p0b-test-secret']==='test-secret-long-enough';
   const workspace=req.url.includes('view=workspace');
   status=!valid?401:(workspace?(id===judge?200:403):(id===admin?200:403));
   if(leak&&!valid) status=200;
   if(wrongRole&&valid&&id===judge&&!workspace) status=200;
   body=status===200?{ok:true,data:{}}:{ok:false,error:{code:status===401?'UNAUTHORIZED':'FORBIDDEN'}};
  }
  res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {return await new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[script,`--base-url=http://127.0.0.1:${server.address().port}`,`--mode=${mode}`],{env:{...process.env,P0B_TEST_AUTH_SECRET:'test-secret-long-enough'}});
  let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
  child.on('error',reject);child.on('close',code=>resolve({code,output}));
 });}finally{await new Promise(resolve=>server.close(resolve))}
}
test('staging anonymous access denied',async()=>{const r=await run();assert.equal(r.code,0,r.output);assert.match(r.output,/4 read-only/)});
test('staging privileged GET exposure fails',async()=>{const r=await run({leak:true});assert.equal(r.code,1,r.output)});
test('isolated postgres-test role matrix passes',async()=>{const r=await run({runtime:'postgres-test',mode:'postgres-test'});assert.equal(r.code,0,r.output);assert.match(r.output,/12 read-only/)});
test('judge accessing admin endpoint fails',async()=>{const r=await run({runtime:'postgres-test',mode:'postgres-test',wrongRole:true});assert.equal(r.code,1,r.output)});
test('test actor cannot be used on staging',async()=>{const r=await run({mode:'postgres-test'});assert.equal(r.code,1,r.output);assert.match(r.output,/unexpected runtime/)});
