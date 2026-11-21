const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function setup(){
 const slots=[],effects=[],callbacks=[];let index=0;
 const react={
  useState(initial){const key=index++;if(!(key in slots))slots[key]=initial;return[slots[key],value=>{slots[key]=typeof value==='function'?value(slots[key]):value;}];},
  useRef(initial){const key=index++;return slots[key]??=( {current:initial} );},
  useCallback(callback,deps){const key=index++;const previous=callbacks[key];if(!previous||deps.some((value,n)=>!Object.is(value,previous.deps[n])))callbacks[key]={callback,deps};return callbacks[key].callback;},
  useEffect(callback,deps){const key=index++;const previous=slots[key];if(!previous||deps.some((value,n)=>!Object.is(value,previous[n]))){effects.push(callback);slots[key]=deps;}},
 };
 const exports={};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/server-pagination.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:()=>react,URLSearchParams});
 return {api:exports,render(filters={}){index=0;const result=exports.useServerPagination(filters);while(effects.length)effects.shift()();return result;}};
}
const response=(page=1,total=35,limit=10)=>({data:[],meta:{page,total,limit,totalPages:Math.ceil(total/limit)}});
test('loads one bounded page, encodes filters and uses backend totals',()=>{
 const env=setup();let pager=env.render({search:'အောင် & B',batchId:4,isActive:false});assert.equal(pager.isCurrent,false);
 assert.equal(new URLSearchParams(pager.query).get('search'),'အောင် & B');assert.equal(new URLSearchParams(pager.query).get('isActive'),'false');
 assert.equal(new URLSearchParams(pager.query).get('limit'),'10');
 pager.accept(response(),pager.query);pager=env.render({search:'အောင် & B',batchId:4,isActive:false});assert.equal(pager.total,35);
 pager.setCurrentPage(2);pager=env.render({search:'အောင် & B',batchId:4,isActive:false});assert.equal(pager.startIndex,10);assert.equal(new URLSearchParams(pager.query).get('page'),'2');
});
test('changing a global filter resets the page and rejects stale old-filter responses',()=>{
 const env=setup();let pager=env.render({search:'old'});pager.accept(response(),pager.query);pager.setCurrentPage(3);pager=env.render({search:'old'});const old=pager.query;
 pager=env.render({search:'new'});assert.equal(pager.currentPage,1);assert.equal(pager.total,0);assert.equal(pager.accept(response(3,999),old),false);
 pager=env.render({search:'new'});assert.equal(pager.total,0);
});
test('page-size changes reset to page one and invalidate the old page response',()=>{
 const env=setup();let pager=env.render();pager.setCurrentPage(4);pager=env.render();const old=pager.query;pager.setPageSize(25);pager=env.render();assert.equal(pager.currentPage,1);assert.equal(pager.pageSize,25);assert.equal(pager.accept(response(4),old),false);
});
test('deleting the final row of a page refetches the last remaining page',()=>{
 const env=setup();let pager=env.render();pager.setCurrentPage(4);pager=env.render();assert.equal(pager.accept(response(4,25),pager.query),false);pager=env.render();assert.equal(pager.currentPage,3);assert.equal(pager.startIndex,20);
});
test('an empty directory stays on page one and malformed responses surface errors',()=>{
 const env=setup();let pager=env.render();assert.equal(pager.accept(response(1,0),pager.query),true);pager=env.render();assert.equal(pager.currentPage,1);assert.equal(pager.total,0);assert.throws(()=>pager.accept([],pager.query),/Invalid list response/);
});
test('option selectors load sequential bounded pages without truncating the dropdown',async()=>{
 const env=setup(),calls=[];const rows=await env.api.loadOptions(async endpoint=>{calls.push(endpoint);const page=Number(new URLSearchParams(endpoint.split('?')[1]).get('page'));return {data:[{id:page}],meta:{page,limit:100,total:201,totalPages:3}};},'/batches');
 assert.equal(rows.length,3);assert.equal(calls.length,3);assert.ok(calls.every(endpoint=>endpoint.includes('limit=100')));
});
test('option errors are not converted into an empty or partial successful list',async()=>{
 const env=setup();await assert.rejects(env.api.loadOptions(async()=>({message:'denied'}),'/users/teachers'),/Invalid options response/);
});

test('cross-page selection retains other pages and refreshed assignment status',()=>{
 const env=setup();const previous=Array.from({length:50},(_,index)=>({id:index+1,reviewerId:null}));
 const page=Array.from({length:10},(_,index)=>({id:index+11,reviewerId:7}));
 const rows=env.api.mergeSelection(previous,page,previous.map(row=>row.id).filter(id=>id!==15));
 assert.equal(rows.length,49);assert.equal(rows.find(row=>row.id===14).reviewerId,7);assert.ok(rows.some(row=>row.id===50));assert.ok(!rows.some(row=>row.id===15));
});
test('returning to a previous filter still resets its page to one',()=>{
 const env=setup();let pager=env.render({search:'one'});pager.setCurrentPage(3);pager=env.render({search:'one'});assert.equal(pager.currentPage,3);
 pager=env.render({search:'two'});assert.equal(pager.currentPage,1);pager=env.render({search:'one'});assert.equal(pager.currentPage,1);
});
