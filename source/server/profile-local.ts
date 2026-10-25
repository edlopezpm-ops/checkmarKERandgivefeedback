import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
import {json,readJson} from './api.ts';
import {DomainError,object} from '../src/core/domain.ts';
import {deriveProfileInitials} from '../src/core/profile.ts';

type LocalProfile={name:string;country:string;email:string;revision:number};
const empty=():LocalProfile=>({name:'',country:'',email:'',revision:0});
export function createLocalProfileApi(path:string){
  let queue:Promise<unknown>=Promise.resolve();
  async function load():Promise<LocalProfile>{try{const data=await readFile(path,'utf8');if(data.length>8192)throw new Error('Invalid profile');const value=JSON.parse(data);if(typeof value.name!=='string'||typeof value.country!=='string'||value.email!==undefined&&typeof value.email!=='string'||!Number.isSafeInteger(value.revision)||value.revision<0)throw new Error('Invalid profile');return {name:value.name,country:value.country,email:value.email??'',revision:value.revision};}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return empty();throw error;}}
  return {async handle(request:Request):Promise<Response|null>{
    if(new URL(request.url).pathname!=='/api/profile')return null;
    if(request.method==='DELETE')return json({error:'La eliminación de cuenta está disponible en el servicio autenticado.'},409);
    const run=queue.then(async()=>{
      let profile=await load();
      if(request.method==='PATCH'){
        if(request.headers.get('X-Marker-Auth')!=='1')return json({error:'Origen no permitido.'},403);
        const body=object(await readJson(request,2048));
        if(Object.keys(body).some(key=>!['name','country','expectedRevision'].includes(key))||typeof body.name!=='string'||typeof body.country!=='string'||body.name.trim().length>120||body.country.trim().length>80||/[\x00-\x1f\x7f]/.test(body.name+body.country))return json({error:'Datos de perfil inválidos.'},400);
        if(body.expectedRevision!==undefined&&body.expectedRevision!==profile.revision)return json({error:'El perfil cambió. Recarga antes de guardar.'},409);
        profile={name:body.name.trim(),country:body.country.trim(),email:profile.email,revision:profile.revision+1};
        await mkdir(dirname(path),{recursive:true});const temporary=path+'.'+crypto.randomUUID()+'.tmp';
        try{await writeFile(temporary,JSON.stringify(profile,null,2),{flag:'wx'});await rename(temporary,path);}finally{await unlink(temporary).catch(()=>undefined);}
      }else if(request.method!=='GET')return json({error:'Método no permitido.'},405);
      return json({profile:{...profile,initials:deriveProfileInitials(profile.name,profile.email),email:profile.email||null},canDeleteAccount:false,requiresFreshProof:true});
    });
    queue=run.catch(()=>undefined);try{return await run;}catch(error){if(error instanceof DomainError)return json({error:error.message},error.status);return json({error:'No se pudo guardar el perfil local.'},503);}
  }};
}
