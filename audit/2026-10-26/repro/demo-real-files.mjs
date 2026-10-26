import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { serveDemoMedia } from '../../../source/server/demo-media.ts';
const checks=[];
for(const file of ['marKER_demo_55s_ES_v1_1080p.mp4','marKER_demo_55s_ES_v1_4K.mp4']){
 const path=fileURLToPath(new URL('../../../source/public/demo/'+file,import.meta.url));
 const expected=readFileSync(path),hash=createHash('sha256').update(expected).digest('hex'),etag='"'+hash+'"';
 const assets={async fetch(){return new Response(Readable.toWeb(createReadStream(path)),{headers:{'Content-Type':'video/mp4',ETag:etag}});}};
 const url='https://marker.aekr.io/demo/'+file;
 for(const [range,start,end,status] of [['bytes=0-1023',0,1023,206],['bytes=39147-40170',39147,40170,206],['bytes=-1024',expected.length-1024,expected.length-1,206],['bytes='+expected.length+'-',0,-1,416],['bytes=-0',0,-1,416]]){
  const result=await serveDemoMedia(new Request(url,{headers:{Range:range}}),assets);
  assert.equal(result.status,status);
  const actual=Buffer.from(await result.arrayBuffer());
  if(status===206){assert.deepEqual(actual,expected.subarray(start,end+1));assert.equal(result.headers.get('Content-Range'),`bytes ${start}-${end}/${expected.length}`);}else assert.equal(actual.length,0);
  checks.push({file,range,status,bytes:actual.length,independent_byte_comparison:true});
 }
 const head=await serveDemoMedia(new Request(url,{method:'HEAD'}),assets);assert.equal(Number(head.headers.get('Content-Length')),expected.length);assert.equal((await head.arrayBuffer()).byteLength,0);
 const unchanged=await serveDemoMedia(new Request(url,{headers:{Range:'bytes=20-23','If-Range':'"wrong-etag"'}}),assets);assert.equal(unchanged.status,200);assert.deepEqual(Buffer.from(await unchanged.arrayBuffer()),expected);
 const ffprobe=process.env.MARKER_FFPROBE ?? 'ffprobe';
 const probe=spawnSync(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height','-of','json',path],{encoding:'utf8',windowsHide:true,shell:false});assert.equal(probe.status,0);const details=JSON.parse(probe.stdout);assert.ok(Number(details.format.duration)>=55&&Number(details.format.duration)<56);assert.ok(details.streams.some(s=>s.codec_type==='video'&&s.codec_name==='h264'));assert.ok(details.streams.some(s=>s.codec_type==='audio'));
 checks.push({file,head_bytes:expected.length,if_range_mismatch_full_read:true,sha256:hash,ffprobe:details});
}
const result={runner:'independent byte oracle from actual immutable files; actual ffprobe',status:'PASS',checks,limits:['ASSETS transport streamed from local disk, no deployed Worker or CDN exercised']};
writeFileSync(new URL('../evidence/root-demo-real-files.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
