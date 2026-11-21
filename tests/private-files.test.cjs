const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function environment(env = {}) {
  const state = [], effects = [], effectSlots = [];
  const storage = new Map([['accessToken', 'account-token']]);
  const calls = [], created = [], revoked = [], tabs = [];
  let position = 0, response = {ok:true, status:200, blob:async()=>new Blob(['private'],{type:'image/jpeg'})};
  class BrowserURL extends URL {
    static createObjectURL(blob) {const url = `blob:private-${created.length}`;created.push({url,blob});return url;}
    static revokeObjectURL(url) {revoked.push(url);}
  }
  const react = {
    useRef(value) {const index=position++;return state[index] ??= {current:value};},
    useState(value) {const index=position++;if(!(index in state))state[index]=value;return [state[index],value=>{state[index]=value;}];},
    useEffect(callback,deps) {
      const index=position++;const previous=effectSlots[index];
      if(!previous || deps.some((value,n)=>!Object.is(value,previous.deps[n]))) {
        effects.push(()=>{previous?.cleanup?.();effectSlots[index]={deps,cleanup:callback()};});
      }
    },
  };
  const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:'fragment'};
  const exports={};
  const context={exports,process:{env},console,URL:BrowserURL,Blob,AbortSignal,AbortController,
    require: name=>name==='react'?react:jsx,
    localStorage:{getItem:key=>storage.get(key)??null},sessionStorage:{getItem:key=>storage.get(key)??null},
    window:{open:()=>{const tab={opener:{},location:{replace:url=>{tab.url=url;}},close:()=>{tab.closed=true;}};tabs.push(tab);return tab;}},
    fetch:async(url,options)=>{calls.push({url,options});if(response instanceof Error)throw response;return typeof response==='function'?response():response;},
  };
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/private-files.tsx'),'utf8'),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},
  }).outputText;
  vm.runInNewContext(code,context);
  return {api:exports,calls,created,revoked,tabs,storage,setResponse:value=>{response=value;},
    render(name,props){position=0;const element=exports[name](props);while(effects.length)effects.shift()();return element;},
    unmount(){for(const slot of effectSlots)slot?.cleanup?.();},
  };
}
const file='http://localhost:3000/uploads/homework/page.webp';
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('recognizes only configured backend file URLs, including legacy files',()=>{
  const {api}=environment();
  assert.equal(api.privateFileUrl(file),file);
  assert.equal(api.privateFileUrl('/student-images/photo.jpg'),'http://localhost:3000/student-images/photo.jpg');
  for(const value of ['https://evil.example/uploads/photo.jpg','http://localhost:3000.evil.example/uploads/photo.jpg','http://user:secret@localhost:3000/uploads/photo.jpg','blob:local','data:image/png,test','/public-avatar.png'])assert.equal(api.privateFileUrl(value),null);
});
test('supports a configured API prefix and backend media origin',()=>{
  const {api}=environment({NEXT_PUBLIC_API_URL:'https://api.example/api',NEXT_PUBLIC_BACKEND_ORIGIN:'https://media.example'});
  assert.equal(api.privateFileUrl('https://api.example/api/uploads/photo.jpg'),'https://api.example/api/uploads/photo.jpg');
  assert.equal(api.privateFileUrl('https://media.example/student-images/photo.jpg'),'https://media.example/student-images/photo.jpg');
  assert.equal(api.privateFileUrl('https://api.example/other/uploads/photo.jpg'),null);
});
test('fetches with Bearer headers, no URL token, no cache, no redirects',async()=>{
  const env=environment();
  const blob=await env.api.fetchPrivateFile(file,'account-token');
  assert.equal(blob.type,'image/jpeg');
  assert.equal(env.calls[0].url,file);
  assert.equal(env.calls[0].options.headers.Authorization,'Bearer account-token');
  assert.equal(env.calls[0].options.cache,'no-store');
  assert.equal(env.calls[0].options.redirect,'error');
  assert.equal(env.calls[0].options.credentials,'omit');
});
test('never sends a token to a foreign URL and requires a token',async()=>{
  const env=environment();
  await assert.rejects(env.api.fetchPrivateFile('https://evil.example/uploads/photo.jpg','account-token'));
  await assert.rejects(env.api.fetchPrivateFile(file,''));
  assert.equal(env.calls.length,0);
});
test('does not convert an unauthorized response into an image',async()=>{
  const env=environment();env.setResponse({ok:false,status:401,blob:async()=>{throw Error('must not read denied response');}});
  await assert.rejects(env.api.fetchPrivateFile(file,'account-token'));
  assert.equal(env.created.length,0);
});
test('keeps local image previews working without an authenticated request',()=>{
  const env=environment();const image=env.render('PrivateImage',{src:'blob:local-preview',alt:'preview'});
  assert.equal(image.props.src,'blob:local-preview');assert.equal(env.calls.length,0);env.unmount();
});
test('displays only an authenticated blob and revokes it on unmount',async()=>{
  const env=environment();const props={src:file,alt:'private'};
  assert.notEqual(env.render('PrivateImage',props).props.src,file);
  await tick();
  assert.equal(env.render('PrivateImage',props).props.src,'blob:private-0');
  assert.equal(env.calls[0].options.headers.Authorization,'Bearer account-token');
  env.unmount();assert.deepEqual(env.revoked,['blob:private-0']);assert.equal(env.calls[0].options.signal.aborted,true);
});
test('does not display the previous account blob after a token changes',async()=>{
  const env=environment();const props={src:file,alt:'private'};env.render('PrivateImage',props);await tick();
  env.storage.set('accessToken','other-account-token');
  assert.notEqual(env.render('PrivateImage',props).props.src,'blob:private-0');
  assert.ok(env.revoked.includes('blob:private-0'));env.unmount();
});
test('aborts an in-flight private image on unmount without creating a stale blob',async()=>{
  const env=environment();let finish;
  env.setResponse(()=>new Promise(resolve=>{finish=resolve;}));env.render('PrivateImage',{src:file});env.unmount();
  finish({ok:true,status:200,blob:async()=>new Blob(['image'])});await tick();assert.equal(env.created.length,0);
});
test('opens attachments through authenticated blobs without an opener',async()=>{
  const env=environment();const view=env.render('PrivateFileLink',{href:file,target:'_blank',children:'Open'});
  let prevented=false;view.props.children[0].props.onClick({defaultPrevented:false,preventDefault:()=>{prevented=true;}});
  await tick();assert.equal(prevented,true);assert.equal(env.tabs[0].opener,null);assert.equal(env.tabs[0].url,'blob:private-0');
  env.unmount();assert.deepEqual(env.revoked,['blob:private-0']);
});
