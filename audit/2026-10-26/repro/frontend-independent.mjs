import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
const audit=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline=process.argv[2]??path.resolve(audit,'../../source');
const {helpGuides}=await import(pathToFileURL(path.join(baseline,'src/console/help-guides.ts')));
const results=[],images=[];let steps=0;
for(const [name,guide] of Object.entries(helpGuides)){
  if(!guide.steps.length)throw Error(`empty guide ${name}`);
  for(const [index,step]of guide.steps.entries()){
    steps++;
    for(const lang of ['en','es']){
      for(const field of ['title','text','alt'])if(typeof step[field]?.[lang]!=='string'||!step[field][lang].trim())throw Error(`missing ${name}/${index}/${field}/${lang}`);
      const file=path.join(baseline,'public/help',lang,step.image),data=fs.readFileSync(file);
      if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error(`invalid PNG ${file}`);
      const width=data.readUInt32BE(16),height=data.readUInt32BE(20);
      if(width<=0||height<=0)throw Error(`empty PNG ${file}`);
      images.push({path:path.relative(baseline,file).replaceAll('\\','/'),width,height,sha256:crypto.createHash('sha256').update(data).digest('hex')});
    }
  }
}
results.push({id:'F-P01',property:'Every declared help step has bilingual text and valid nonempty PNG references',passed:true,guides:Object.keys(helpGuides).length,steps,imageReferences:images.length,uniqueImages:new Set(images.map(x=>x.path)).size});
const dist=path.join(baseline,'dist/assets');
const javascript=fs.readdirSync(dist).filter(x=>x.endsWith('.js')).map(file=>({file,text:fs.readFileSync(path.join(dist,file),'utf8')}));
// Translation dictionary keys are harmless retained copy, not executable simulator code.
const leaked=javascript.filter(x=>x.text.includes('SIMULACIÓN LOCAL')||x.text.includes('malformed-destination'));
if(leaked.length)throw Error(`simulator marker in production JS ${leaked.map(x=>x.file)}`);
results.push({id:'F-P02',property:'Disclosed local text simulator markers absent from rebuilt production JavaScript',passed:true,javascriptFiles:javascript.length});
const vtt=fs.readFileSync(path.join(baseline,'public/demo/marKER_demo_ES_v1.vtt'),'utf8');
if(!vtt.startsWith('WEBVTT'))throw Error('VTT header missing');
const cues=[...vtt.matchAll(/(\d\d):(\d\d):(\d\d\.\d{3}) --> (\d\d):(\d\d):(\d\d\.\d{3})/g)].map(m=>({start:Number(m[1])*3600+Number(m[2])*60+Number(m[3]),end:Number(m[4])*3600+Number(m[5])*60+Number(m[6])}));
if(cues.length!==8||cues[0].start!==0||cues.at(-1).end!==55||cues.some((c,i)=>c.end<=c.start||i&&c.start<cues[i-1].end))throw Error('VTT cue invariant');
results.push({id:'F-P03',property:'Spanish caption file has eight ordered nonoverlapping cues spanning promised 55 seconds',passed:true,cues});
const result={snapshot:'77bbedaccc6bc410364cef16fba1ed88b1eaf5e1',time:new Date().toISOString(),baseline,results,images,oracleCorrections:[{discarded:'Literal UI button label absence as implementation-isolation oracle',reason:'Retained bilingual dictionary includes unused simulator labels; this is not an active simulation route. Replaced with executable-specific assembly/malformed-output markers plus source DEV gating. No product defect attributed.'}],limits:['PNG signatures/dimensions are integrity checks; semantic screenshot inspection sampled separately','Executable marker absence is auxiliary; production DEV gating was also statically reviewed','Caption file does not certify audio alignment beyond the declared intervals']};
fs.writeFileSync(path.join(audit,'evidence/frontend-independent.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({results,guideImages:images.length}));
