const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');const {randomUUID,webcrypto}=require('node:crypto');
function client({saved,storageError=false,server=false,legacyCrypto=false}={}){
 const values=new Map(saved);const keys=[];const exports={};
 const context={exports,Uint8Array,crypto:legacyCrypto?{getRandomValues:array=>webcrypto.getRandomValues(array)}:{randomUUID},localStorage:{getItem:key=>{keys.push(key);if(storageError)throw Error('No storage');return values.get(key)??null;},setItem:(key,value)=>values.set(key,value)}};
 if(!server)context.window={};
 const source=fs.readFileSync(path.join(__dirname,'../lib/auth-client.ts'),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {headers:exports.authClientHeaders,values,keys};
}
test('reuses one random browser identifier across account changes and retries',()=>{const c=client();const first=c.headers()['X-Auth-Client'];assert.match(first,/^[a-f0-9-]{36}$/);assert.equal(c.headers()['X-Auth-Client'],first);});
test('different browsers receive different identifiers',()=>assert.notEqual(client().headers()['X-Auth-Client'],client().headers()['X-Auth-Client']));
test('replaces malformed saved identifiers',()=>{const c=client({saved:[['pali:auth-client:v1','bad']]});assert.notEqual(c.headers()['X-Auth-Client'],'bad');});
test('does not block login when browser storage is unavailable',()=>assert.equal(Object.keys(client({storageError:true}).headers()).length,0));
test('does not read browser storage while rendering on the server',()=>{const c=client({server:true});assert.equal(Object.keys(c.headers()).length,0);assert.equal(c.keys.length,0);});
test('generates a UUIDv4 through getRandomValues when randomUUID is unavailable',()=>assert.match(client({legacyCrypto:true}).headers()['X-Auth-Client'],/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/));
test('does not read account tokens or passwords',()=>{const c=client({saved:[['studentAccessToken','secret'],['accessToken','staff-secret']]});const headers=c.headers();assert.equal(Object.keys(headers).join(','),'X-Auth-Client');assert.ok(c.keys.every(key=>key==='pali:auth-client:v1'));assert.ok(!JSON.stringify(headers).includes('secret'));});
