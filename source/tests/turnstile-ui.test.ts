import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

// Exercise the real component's external widget contract without a network,
// provider token, browser session, or additional DOM/test dependency.
const source=ts.transpileModule(readFileSync(new URL('../src/console/Turnstile.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
type Options={action:string;sitekey:string;theme:string;language:string;size:string;'response-field':boolean;callback:(token:string)=>void;'expired-callback':()=>void;'error-callback':()=>void;'timeout-callback':()=>void};
function fixture(apiInitiallyAvailable=true){
  const hooks:Array<any>=[],pending:Array<()=>void>=[],scripts:Array<any>=[],tokens:string[]=[],renders:Array<{id:string;options:Options}>=[],resets:string[]=[],removes:string[]=[];
  let cursor=0;
  const api={render(_container:unknown,options:Options){const id=`widget-${renders.length+1}`;renders.push({id,options});return id;},reset(id:string){resets.push(id);},remove(id:string){removes.push(id);}};
  const pageWindow:{turnstile?:typeof api}=apiInitiallyAvailable?{turnstile:api}:{};
  const pageDocument={documentElement:{dataset:{theme:'light'}},head:{appendChild(script:any){scripts.push(script);}},createElement(){return {remove(){this.removed=true;},removed:false};}};
  const react={
    useRef(value:unknown){const index=cursor++;return hooks[index]??= {current:value===null?{}:value};},
    useState(initial:any){const index=cursor++;hooks[index]??={value:typeof initial==='function'?initial():initial};return [hooks[index].value,(next:any)=>{hooks[index].value=typeof next==='function'?next(hooks[index].value):next;}];},
    useEffect(effect:()=>void|(()=>void),dependencies:unknown[]){const index=cursor++,prior=hooks[index];if(!prior||dependencies.some((value,i)=>value!==prior.dependencies[i]))pending.push(()=>{prior?.cleanup?.();hooks[index]={dependencies,cleanup:effect()};});},
  };
  const exports:any={};
  runInNewContext(source,{exports,require(name:string){if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx:(type:any,props:any)=>({type,props}),jsxs:(type:any,props:any)=>({type,props})};if(name==='../i18n')return {useLanguage:()=>({language:'en'})};if(name==='./ErrorNotice')return {ErrorNotice:()=>null};if(name==='./turnstile.css')return {};throw new Error(`Unexpected dependency: ${name}`);},window:pageWindow,document:pageDocument,MutationObserver:class{observe(){}disconnect(){}},setTimeout:()=>1,clearTimeout:()=>{}});
  const onToken=(token:string)=>tokens.push(token);
  function render(overrides:Record<string,unknown>={}){cursor=0;const output=exports.Turnstile({descriptor:{required:true,sitekey:'public-test-sitekey'},action:'auth_email_request',reset:0,onToken,...overrides});while(pending.length)pending.shift()!();return output;}
  async function flush(){await Promise.resolve();await Promise.resolve();await Promise.resolve();}
  function unmount(){for(const hook of hooks)hook?.cleanup?.();}
  return {api,pageWindow,scripts,tokens,renders,resets,removes,render,flush,unmount};
}

test('required widget loads only canonical explicit script and carries the endpoint action',async()=>{
  const f=fixture(false);f.render();assert.equal(f.scripts.length,1);assert.equal(f.scripts[0].src,'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');assert.equal(f.renders.length,0);assert.equal(f.tokens.at(-1),'');
  f.pageWindow.turnstile=f.api;f.scripts[0].onload();await f.flush();
  const options=f.renders[0].options;assert.equal(options.action,'auth_email_request');assert.equal(options.sitekey,'public-test-sitekey');assert.equal(options['response-field'],false);assert.equal(options.theme,'light');assert.equal(options.language,'en');assert.equal(options.size,'flexible');
});

test('expiry, provider error and interactive timeout invalidate the callback token',async()=>{
  const f=fixture();f.render();await f.flush();const options=f.renders[0].options;
  for(const event of ['expired-callback','error-callback','timeout-callback'] as const){options.callback('single-use-token');assert.equal(f.tokens.at(-1),'single-use-token');options[event]();assert.equal(f.tokens.at(-1),'');}
});

test('attempt reset, endpoint switch and unmount do not reuse the prior widget token',async()=>{
  const f=fixture();f.render();await f.flush();const old=f.renders[0];old.options.callback('consumed-token');
  f.render({reset:1});assert.deepEqual(f.resets,[old.id]);assert.equal(f.tokens.at(-1),'');
  f.render({reset:1,action:'auth_email_verify'});await f.flush();assert.deepEqual(f.removes,[old.id]);assert.equal(f.renders[1].options.action,'auth_email_verify');
  old.options.callback('late-old-action-token');assert.equal(f.tokens.at(-1),'');
  f.renders[1].options.callback('new-action-token');f.unmount();assert.deepEqual(f.removes,[old.id,f.renders[1].id]);assert.equal(f.tokens.at(-1),'');
  f.renders[1].options.callback('late-unmounted-token');assert.equal(f.tokens.at(-1),'');
});

test('disabled and partially configured descriptors never create a usable token',async()=>{
  for(const descriptor of [undefined,{required:false,sitekey:null},{required:true,sitekey:null}]){const f=fixture(false);f.render({descriptor});await f.flush();assert.equal(f.scripts.length,0);assert.equal(f.renders.length,0);assert.equal(f.tokens.at(-1),'');}
});

test('script failure clears readiness and removes the failed script',async()=>{
  const f=fixture(false);f.render();f.scripts[0].onerror();await f.flush();assert.equal(f.tokens.at(-1),'');assert.equal(f.renders.length,0);assert.equal(f.scripts[0].removed,true);
});
