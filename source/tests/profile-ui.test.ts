import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

// Calls are isolated fixture fetches. No account, browser, storage or network is used.
const source=ts.transpileModule(readFileSync(new URL('../src/console/Profile.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
type Node={type?:unknown;props?:Record<string,any>};
function nodes(node:any):Node[]{if(!node)return [];if(Array.isArray(node))return node.flatMap(nodes);if(typeof node!=='object')return [];return [node,...nodes(node.props?.children)];}
function textOf(node:any):string{if(node==null||typeof node==='boolean')return '';if(Array.isArray(node))return node.map(textOf).join('');if(typeof node==='object')return textOf(node.props?.children);return String(node);}
function fixture(overrides:Record<string,any>={},network?:(url:string,options:any)=>Promise<any>,component='Profile'){
  let value={profile:{name:'',country:'',email:'owner@example.invalid',initials:'EL'},canDeleteAccount:true,requiresFreshProof:false},cursor=0,output:any,deleted=0,deleting=0,timerId=0;
  const timers=new Map<number,()=>void>();
  const hooks:Array<any>=[],pending:Array<()=>void>=[],calls:Array<{url:string;options:any}>=[];
  const react={useRef(initial:any){const index=cursor++;return hooks[index]??={current:initial};},useState(initial:any){const index=cursor++;hooks[index]??={value:typeof initial==='function'?initial():initial};return [hooks[index].value,(next:any)=>{hooks[index].value=typeof next==='function'?next(hooks[index].value):next;}];},useEffect(effect:()=>void|(()=>void),dependencies:unknown[]){const index=cursor++,prior=hooks[index];if(!prior||dependencies.some((next,i)=>next!==prior.dependencies[i]))pending.push(()=>{prior?.cleanup?.();hooks[index]={dependencies,cleanup:effect()};});}};
  const exports:any={};
  runInNewContext(source,{exports,require(name:string){if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props})};if(name==='../i18n')return {useLanguage:()=>({language:'en'})};if(name==='./ErrorNotice')return {ErrorNotice:()=>null};if(name==='./profile.css')return {};throw new Error(`Unexpected dependency: ${name}`);},setTimeout:(callback:()=>void)=>{const id=++timerId;timers.set(id,callback);return id;},clearTimeout:(id:number)=>timers.delete(id),fetch:async(url:string,options:any={})=>{calls.push({url,options});if(network)return network(url,options);if(options.method==='PATCH'){value={...value,profile:{...value.profile,...JSON.parse(options.body)}};return {ok:true,json:async()=>value};}return {ok:true,json:async()=>({deletion:{status:'deleted',phase:'done'}})};}});
  function render(next:Record<string,any>={}){cursor=0;output=(component==='Profile'?exports.default:exports.DeletionProgress)({value,loadError:'',local:false,onReload:async()=>value,onChange:(saved:any)=>{value=saved;},onEmailProof:()=>{},onDeleting:()=>{deleting++;},onDeleted:()=>{deleted++;},...overrides,...next});while(pending.length)pending.shift()!();return output;}
  const find=(predicate:(node:Node)=>boolean)=>{const result=nodes(output).find(predicate);assert.ok(result,'Expected control is present');return result;};
  const button=(text:string)=>find(node=>node.type==='button'&&textOf(node)===text);
  const field=(name:string)=>find(node=>node.type==='input'&&node.props?.name===name);
  const flush=async()=>{await new Promise(resolve=>setImmediate(resolve));};
  const submit=async()=>{find(node=>node.type==='form'&&node.props?.className==='profile-delete-confirm').props!.onSubmit({preventDefault(){}});await flush();};
  render();
  return {calls,render,button,field,submit,find,flush,timers,runTimer:async()=>{const next=timers.entries().next().value;assert.ok(next);timers.delete(next[0]);next[1]();await flush();},unmount:()=>{for(const hook of hooks)hook?.cleanup?.();},get value(){return value;},get deleted(){return deleted;},get deleting(){return deleting;}};
}

test('profile load and edit do not send mutations; save PATCH preserves readonly access email',async()=>{
  const f=fixture();assert.equal(f.calls.length,0);const email=f.find(node=>node.type==='input'&&node.props?.type==='email');assert.equal(email.props!.readOnly,true);
  f.button('Edit profile').props!.onClick();f.render();f.field('name').props!.onChange({target:{value:'Example Owner'}});f.field('country').props!.onChange({target:{value:'Example country'}});f.render();assert.equal(f.calls.length,0);
  await f.find(node=>node.type==='form'&&!node.props?.className).props!.onSubmit({preventDefault(){}});
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'/api/profile');assert.equal(f.calls[0].options.method,'PATCH');assert.deepEqual(JSON.parse(f.calls[0].options.body),{name:'Example Owner',country:'Example country'});assert.equal(f.calls[0].options.credentials,'same-origin');assert.equal(f.calls[0].options.headers['X-Marker-Auth'],'1');assert.equal(f.value.profile.email,'owner@example.invalid');assert.throws(()=>f.field('initials'));
});

test('saving an edited profile sends the revision captured when editing began',async()=>{
  const original={profile:{name:'Old name',country:'',email:'owner@example.invalid',initials:'EL',revision:4},canDeleteAccount:true,requiresFreshProof:false};
  const f=fixture({value:original});f.button('Edit profile').props!.onClick();f.render();f.field('name').props!.onChange({target:{value:'My draft'}});f.render({value:{...original,profile:{...original.profile,name:'Another change',revision:5}}});
  await f.find(node=>node.type==='form'&&!node.props?.className).props!.onSubmit({preventDefault(){}});assert.equal(JSON.parse(f.calls[0].options.body).expectedRevision,4);assert.equal(JSON.parse(f.calls[0].options.body).name,'My draft');
});

test('account deletion needs the open confirmation, exact DELETE and all-data affirmation',async()=>{
  const f=fixture();assert.equal(f.calls.length,0);f.button('Delete my account…').props!.onClick();f.render();assert.equal(f.calls.length,0);
  await f.submit();assert.equal(f.calls.length,0);
  f.field('delete-confirmation').props!.onChange({target:{value:'delete'}});f.render();f.find(node=>node.type==='input'&&node.props?.type==='checkbox').props!.onChange({target:{checked:true}});f.render();await f.submit();assert.equal(f.calls.length,0);
  f.field('delete-confirmation').props!.onChange({target:{value:'DELETE'}});f.render();assert.equal(f.button('Delete account and all its data').props!.disabled,false);await f.submit();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'/api/profile');assert.equal(f.calls[0].options.method,'DELETE');assert.deepEqual(JSON.parse(f.calls[0].options.body),{confirmation:'DELETE',confirmAllData:true});assert.equal(f.deleted,1);
});

test('fresh proof is required even if a caller directly submits a fully filled confirmation',async()=>{
  const f=fixture({value:{profile:{name:'',country:'',email:'owner@example.invalid',initials:'EL'},canDeleteAccount:true,requiresFreshProof:true}});
  f.button('Delete my account…').props!.onClick();f.render();f.field('delete-confirmation').props!.onChange({target:{value:'DELETE'}});f.find(node=>node.type==='input'&&node.props?.type==='checkbox').props!.onChange({target:{checked:true}});f.render();assert.equal(f.button('Delete account and all its data').props!.disabled,true);await f.submit();assert.equal(f.calls.length,0);
});

test('a proof that expires on the server reveals re-verification and blocks another deletion',async()=>{
  const f=fixture({},async(_url,options)=>options.method==='DELETE'?{ok:false,json:async()=>({error:'FRESH_EMAIL_PROOF_REQUIRED'})}:{status:404,ok:false,json:async()=>({error:'DELETION_NOT_FOUND'})});
  f.button('Delete my account…').props!.onClick();f.render();f.field('delete-confirmation').props!.onChange({target:{value:'DELETE'}});f.find(node=>node.type==='input'&&node.props?.type==='checkbox').props!.onChange({target:{checked:true}});f.render();await f.submit();f.render();
  assert.equal(f.value.requiresFreshProof,true);assert.equal(f.button('Delete account and all its data').props!.disabled,true);f.button('Verify my email access');await f.submit();assert.equal(f.calls.filter(call=>call.options.method==='DELETE').length,1);
});

test('local profile has no account-deletion control and editing navigation causes no deletion',()=>{
  const f=fixture({local:true});assert.throws(()=>f.button('Delete my account…'));f.button('Edit profile').props!.onClick();f.render();f.field('name').props!.onChange({target:{value:'Draft'}});f.render();f.button('Cancel editing').props!.onClick();f.render();assert.equal(f.calls.length,0);
});

test('lost accepted DELETE response recovers with status GET instead of another deletion',async()=>{
  const f=fixture({},async(_url,options)=>{if(options.method==='DELETE')throw new Error('Simulated lost response');return {ok:true,json:async()=>({deletion:{status:'deleting',phase:'waiting',deletedObjects:0,needsRetry:false}})};});
  f.button('Delete my account…').props!.onClick();f.render();f.field('delete-confirmation').props!.onChange({target:{value:'DELETE'}});f.find(node=>node.type==='input'&&node.props?.type==='checkbox').props!.onChange({target:{checked:true}});f.render();await f.submit();
  assert.deepEqual(f.calls.map(call=>[call.url,call.options.method]),[['/api/profile','DELETE'],['/api/profile/deletion',undefined]]);assert.equal(f.deleting,1);assert.equal(f.deleted,0);
});

test('deletion recovery reads status before bounded resume and stops at terminal state',async()=>{
  const f=fixture({},async(_url,options)=>({ok:true,json:async()=>({deletion:options.method==='POST'?{status:'deleted',phase:'done',deletedObjects:3,needsRetry:false}:{status:'deleting',phase:'media',deletedObjects:2,needsRetry:false},resumeAfterMs:1000})}),'DeletionProgress');
  await f.flush();assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'/api/profile/deletion');assert.equal(f.calls[0].options.method,undefined);assert.equal(f.timers.size,1);
  await f.runTimer();assert.equal(f.calls[1].url,'/api/profile/deletion/resume');assert.equal(f.calls[1].options.method,'POST');assert.deepEqual(JSON.parse(f.calls[1].options.body),{});assert.equal(f.deleted,1);assert.equal(f.timers.size,0);
});

test('failed progress waits for explicit retry and unmount cancels pending resume',async()=>{
  let fail=true;
  const f=fixture({},async()=>{if(fail)throw new Error('Simulated network failure');return {ok:true,json:async()=>({deletion:{status:'deleting',phase:'waiting',deletedObjects:0,needsRetry:false}})};},'DeletionProgress');
  await f.flush();f.render();assert.equal(f.timers.size,0);assert.deepEqual(f.calls.map(call=>call.url),['/api/profile/deletion','/api/session']);fail=false;f.button('Retry pending deletion').props!.onClick();f.render();await f.flush();assert.equal(f.calls[2].options.method,'POST');assert.equal(f.timers.size,1);f.unmount();assert.equal(f.timers.size,0);
});

test('automatic initials are displayed from the persisted server profile and never editable',()=>{
  const f=fixture({local:true,value:{profile:{name:'Ed Jorge Lopez',country:'',email:'elopez@example.invalid',initials:'EL'},canDeleteAccount:false,requiresFreshProof:false}});
  assert.equal(f.find(node=>node.type==='input'&&node.props?.type==='email').props!.value,'elopez@example.invalid');assert.equal(textOf(f.find(node=>node.type==='output')),'EL');f.button('Edit profile').props!.onClick();f.render();assert.throws(()=>f.field('initials'));assert.equal(textOf(f.find(node=>node.type==='output')),'EL');assert.equal(f.calls.length,0);
});

test('purged capability status404 resolves terminal deletion through public session without a mutation',async()=>{
  const f=fixture({},async(url)=>url==='/api/session'?{ok:true,json:async()=>({authenticated:false,account:{status:'deleted'}})}:{status:404,ok:false,json:async()=>({error:'DELETION_NOT_FOUND'})},'DeletionProgress');
  await f.flush();assert.equal(f.deleted,1);assert.deepEqual(f.calls.map(call=>[call.url,call.options.method]),[['/api/profile/deletion',undefined],['/api/session',undefined]]);assert.equal(f.timers.size,0);
});

test('lost final resume response resolves the public tombstone and never repeats DELETE',async()=>{
  const f=fixture({},async(url,options)=>{if(url==='/api/session')return {ok:true,json:async()=>({account:{status:'deleted'}})};if(options.method==='POST')throw new Error('Lost final response');return {ok:true,json:async()=>({deletion:{status:'deleting',phase:'database',needsRetry:false}})};},'DeletionProgress');
  await f.flush();await f.runTimer();assert.equal(f.deleted,1);assert.deepEqual(f.calls.map(call=>[call.url,call.options.method]),[['/api/profile/deletion',undefined],['/api/profile/deletion/resume','POST'],['/api/session',undefined]]);assert.equal(f.timers.size,0);
});
