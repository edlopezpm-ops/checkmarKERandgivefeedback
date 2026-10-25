import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { D1Repository } from '../server/d1.ts';
import { nativeApi } from '../server/worker.ts';
import { applyCommand, emptyWorkspace } from '../src/core/domain.ts';

function database(t, studio = false) {
  const sql = new DatabaseSync(':memory:');
  for (const name of ['0001_private.sql','0002_studio.sql','0003_studio_hosted.sql','0004_studio_analysis.sql','0005_studio_settings.sql','0006_agents.sql','0007_single_tenant_auth.sql','0008_github_auth.sql','0009_profile_account.sql']) sql.exec(readFileSync(new URL('../migrations-d1/' + name, import.meta.url), 'utf8'));
  t.after(() => sql.close());
  const db = {
    prepare(text) {
      let parameters = [];
      const statement = {
        bind(...args) { parameters = args; return statement; },
        execute() { const query = sql.prepare(text); return query.columns().length ? { success: true, results: query.all(...parameters), meta: { changes: 0 } } : { success: true, results: [], meta: { changes: Number(query.run(...parameters).changes) } }; },
        async run() { return statement.execute(); },
        async first() { return statement.execute().results[0] ?? null; },
      };
      return statement;
    },
    async batch(statements) { sql.exec('BEGIN'); try { const results = statements.map(s => s.execute()); sql.exec('COMMIT'); return results; } catch (e) { sql.exec('ROLLBACK'); throw e; } },
  };
  return db;
}
test('actual SQLite schema and hosted repository keep CAS conflict and payload limit without lost records', async t => {
  const db=database(t), repo=new D1Repository(db), next=applyCommand(emptyWorkspace(),{type:'product.save',data:{name:'Fixture',status:'preparation'}});
  const outcomes=await Promise.allSettled([repo.save(next,0),repo.save(next,0)]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await repo.read()).products[0].name,'Fixture');
  await assert.rejects(repo.save({...next,products:[{...next.products[0],description:'x'.repeat(1_048_576)}]},1),/1 MB/);
  assert.equal((await repo.read()).revision,1);
});

test('hosted product deletion cannot orphan Studio material or campaign in either committed order', async t => {
  const db = database(t, true), repo = new D1Repository(db, true);
  const workspace = applyCommand(emptyWorkspace(), { type: 'product.save', data: { name: 'Protected product', status: 'preparation' } });
  await repo.save(workspace, 0);
  const productId = workspace.products[0].id;
  const removed = applyCommand(workspace, { type: 'product.delete', data: { id: productId } });
  await db.prepare('INSERT INTO marker_studio_materials(id,content_version,document) VALUES(?,?,?)').bind('material-fixture', 1, JSON.stringify({ productIds: [productId] })).run();
  await assert.rejects(repo.save(removed, workspace.revision), error => error.status === 409);
  assert.equal((await repo.read()).products.length, 1);
  await db.prepare('UPDATE marker_studio_materials SET document=? WHERE id=?').bind(JSON.stringify({ productIds: [] }), 'material-fixture').run();
  await db.prepare('INSERT INTO marker_studio_campaigns(id,product_id,document) VALUES(?,?,?)').bind('campaign-fixture', productId, '{}').run();
  await assert.rejects(repo.save(removed, workspace.revision), error => error.status === 409);
  await db.prepare('DELETE FROM marker_studio_campaigns WHERE id=?').bind('campaign-fixture').run();
  await repo.save(removed, workspace.revision);
  assert.equal((await repo.read()).products.length, 0);
  const staleWrite = await db.prepare('UPDATE marker_studio_meta SET revision=revision+1 WHERE id=1 AND (SELECT revision FROM marker_workspace WHERE id=1)=?').bind(workspace.revision).run();
  assert.equal(staleWrite.meta.changes, 0);
});
test('native auth plus data API completes owner login/write/logout and denies non-owner requests using actual SQL', async t => {
  const jobs=[], mails=[], origin='https://marker.aekr.io';
  const env={DB:database(t),MARKER_ORIGIN:origin,MARKER_OWNER_EMAIL:'elopez@aekr.io',MARKER_SENDER_EMAIL:'marker@aekr.io',MARKER_AUTH_SECRET:'synthetic-only-secret-at-least-thirty-two-bytes',EMAIL:{async send(mail){mails.push(mail);}}};
  const ctx={waitUntil(job){jobs.push(job);}};
  const call=async(path,body,cookie='',extraHeaders={})=>{const response=await nativeApi(new Request(origin+path,{headers:{'Content-Type':'application/json',Origin:origin,'X-Marker-Auth':'1','CF-Connecting-IP':'192.0.2.2',Cookie:cookie,...extraHeaders},method:body===undefined?'GET':'POST',...(body===undefined?{}:{body:JSON.stringify(body)})}),env,ctx);await Promise.all(jobs.splice(0));return response;};
  const readCookie=(r,name)=>r.headers.getSetCookie().find(c=>c.startsWith(name+'='))?.split(';')[0]??'';
  assert.equal((await call('/api/workspace')).status,401);
  const guest = await (await call('/api/session')).json();
  assert.equal(guest.authenticated, false); assert.equal('user' in guest, false);
  assert.equal((await call('/api/auth/request',{email:'other@example.invalid'})).status,202);assert.equal(mails.length,0);
  const challenge=await call('/api/auth/request',{email:'elopeZ@aekr.io'});
  assert.equal(challenge.status,202);assert.equal(mails.length,1);assert.equal(mails[0].to,'elopez@aekr.io');
  assert.deepEqual(mails[0].from, { email: 'marker@aekr.io', name: 'marKER' });
  assert.equal(mails[0].replyTo, 'marker@aekr.io');
  const pin=mails[0].text.match(/\b\d{8}\b/)[0], verified=await call('/api/auth/verify',{code:pin},readCookie(challenge,'__Host-marker_challenge'));
  assert.equal(verified.status,200);const session=readCookie(verified,'__Host-marker_session');
  const owner = await (await call('/api/session',undefined,session)).json();
  assert.equal(owner.authenticated,true); assert.equal(owner.user.email,'elopez@aekr.io');
  assert.match(owner.tenant_id,/^[a-f0-9]{32}$/); assert.match(owner.user.id,/^[a-f0-9]{32}$/);
  assert.equal(owner.user.tenant_id,owner.tenant_id);
  assert.deepEqual((await (await call('/api/session',undefined,session)).json()).user,owner.user);
  assert.equal(owner.methods.email.configured,true); assert.equal(owner.methods.google.configured,false);
  const write=await call('/api/commands',{revision:0,type:'product.save',data:{name:'Owner fixture',status:'preparation'}},session);
  assert.equal(write.status,200);assert.equal((await write.json()).products.length,1);
  assert.equal((await call('/api/workspace',undefined,session,{'X-Tenant-ID':'foreign-tenant'})).status,403);
  assert.equal((await call('/api/workspace?tenant_id=foreign-tenant',undefined,session)).status,403);
  const retained=await (await call('/api/workspace',undefined,session,{'X-Tenant-ID':owner.tenant_id})).json();
  assert.equal(retained.products[0].name,'Owner fixture');
  env.MARKER_OWNER_EMAIL='different-owner@example.invalid';
  assert.equal((await call('/api/workspace',undefined,session)).status,401);
  env.MARKER_OWNER_EMAIL='elopez@aekr.io';
  assert.deepEqual(await (await call('/api/workspace',undefined,session)).json(),retained);
  assert.equal((await call('/api/commands',{revision:0,type:'product.save',data:{name:'Stale fixture',status:'preparation'}},session)).status,409);
  assert.equal((await call('/api/workspace',undefined,'__Host-marker_session=forged')).status,401);
  assert.equal((await call('/api/auth/logout',{},session)).status,200);
  assert.equal((await call('/api/workspace',undefined,session)).status,401);
  const loggedOut = await (await call('/api/session',undefined,session)).json();
  assert.equal(loggedOut.authenticated, false); assert.equal('user' in loggedOut, false);
  assert.equal('tenant_id' in loggedOut,false);
});
