import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLocalMcpApi } from '../server/mcp-local.ts';

test('local MCP upgrades a legacy database once while preserving identity and authorized client IDs',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'marker-mcp-upgrade-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const path=join(directory,'mcp.sqlite'),old=new DatabaseSync(path);
  old.exec("PRAGMA foreign_keys=ON; CREATE TABLE marker_account_lifecycle(id INTEGER PRIMARY KEY,status TEXT NOT NULL); INSERT INTO marker_account_lifecycle VALUES(1,'active'); CREATE TABLE marker_auth_operator(id INTEGER PRIMARY KEY,user_id TEXT UNIQUE NOT NULL,tenant_id TEXT UNIQUE NOT NULL); INSERT INTO marker_auth_operator VALUES(1,'local-owner','local-tenant');");
  old.exec(readFileSync(new URL('../migrations-d1/0010_mcp.sql',import.meta.url),'utf8'));
  old.prepare('INSERT INTO marker_mcp_clients VALUES(?,?,?,?,?)').run('existing-client','Native client','["http://127.0.0.1:5000/callback"]',1,2);
  old.prepare('INSERT INTO marker_mcp_grants VALUES(?,?,?,?,?,?,?,?,NULL)').run('existing-grant','existing-client','local-owner','local-tenant','marker:read','http://127.0.0.1:5199/api/mcp',7,9999999999);
  const ownerBefore=old.prepare('SELECT * FROM marker_auth_operator').get();
  old.close();
  for(let attempt=0;attempt<2;attempt++) {
    const api=createLocalMcpApi({directory,async backend(){return new Response('{}',{headers:{'Content-Type':'application/json'}});}});
    try {assert.equal((await api.handle(new Request('http://127.0.0.1:5199/.well-known/oauth-authorization-server')))?.status,200);}
    finally {api.close();}
    const updated=new DatabaseSync(path);
    try {
      assert.deepEqual(updated.prepare('SELECT * FROM marker_auth_operator').get(),ownerBefore);
      assert.deepEqual({...updated.prepare('SELECT client_id,name,expires_at,authorized_at FROM marker_mcp_clients').get()},{client_id:'existing-client',name:'Native client',expires_at:2,authorized_at:7});
      assert.equal(updated.prepare('SELECT grant_id FROM marker_mcp_grants').get()?.grant_id,'existing-grant');
      assert.equal(updated.prepare('SELECT count(*) AS n FROM marker_mcp_login_requests').get()?.n,0);
      assert.deepEqual(updated.prepare('PRAGMA foreign_key_check').all(),[]);
    } finally {updated.close();}
  }
});
