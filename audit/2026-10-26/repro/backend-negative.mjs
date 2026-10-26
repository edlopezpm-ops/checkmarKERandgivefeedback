import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const suffix=process.env.BACKEND_AUDIT_RUN??'';
if(!/^[A-Za-z0-9_-]*$/.test(suffix))throw Error('Use a simple optional fresh run suffix');
const copy=join(root,'backend','negative-control'+suffix);
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const file of ['server/local.ts','server/api.ts','src/core/domain.ts']){
 const target=join(copy,file);await mkdir(dirname(target),{recursive:true});await writeFile(target,await readFile(join(root,'../../source',file)));
}
const target=join(copy,'server/local.ts');const original=await readFile(target,'utf8');
async function verifier(moduleLabel,dataFile){
 const {LocalRepository}=await import(pathToFileURL(target).href+'?'+moduleLabel);
 const repository=new LocalRepository(dataFile);
 const before=await repository.read();assert.equal(before.revision,0);
 const state={version:1,revision:1,products:[{id:'audit-negative',name:'Control persistido Ñ',description:'',audience:'',language:'es',tone:'',cta:'',url:'',status:'preparation'}],accounts:[],sources:[],campaigns:[],posts:[]};
 await repository.save(state,0);
 const independentNewRepository=new LocalRepository(dataFile);
 assert.deepEqual(await independentNewRepository.read(),state,'A new repository must observe the entire saved state, not only a success return');
}
const results=[];
await verifier('baseline',join(copy,'baseline-data.json'));results.push({phase:'baseline',outcome:'PASS'});
assert.equal(original.split('await rename(temp, this.path);').length,2);
const mutant=original.replace('await rename(temp, this.path);','// CONTROL NEGATIVO: omit publish of durable state; return success.');
await writeFile(target,mutant);
let detected=false;
try{await verifier('omit-write',join(copy,'mutant-data.json'));results.push({phase:'omit-write',outcome:'SURVIVED'});}
catch(error){assert.equal(error.code,'ERR_ASSERTION');detected=true;results.push({phase:'omit-write',outcome:'DETECTED',errorCode:error.code,message:'New repository state differs from the independently supplied product/revision.'});}
finally{await writeFile(target,original);}
assert.equal(hash(await readFile(target)),hash(await readFile(join(root,'../../source','server/local.ts'))));
assert.equal(detected,true);
results.push({phase:'restoration',outcome:'PASS',sha256:hash(await readFile(target))});
await writeFile(join(root,'evidence','backend-negative'+suffix+'.json'),JSON.stringify({operator:'Replace atomic publish rename with success no-op in disposable copy',file:'server/local.ts',verifier:'Fresh repository read compared against independently constructed expected state',scope:'Only audit copy changed; evaluated snapshot unchanged',results},null,2));
console.log(JSON.stringify(results));
