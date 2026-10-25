import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace } from '../src/core/domain.ts';
import { applyStudioCommand, emptyStudio, registerStudioAsset, type StudioMaterial } from '../src/core/studio.ts';
import { classifyStudioMaterial } from '../src/core/studio-classification.ts';

const workspace = emptyWorkspace(), now = '2026-10-24T18:00:00Z';
function material(kind = 'idea', title = 'Untitled'): StudioMaterial {
  return { id: 'fixture', kind, title, productIds: [], categories: [], topics: [], roles: [], review: 'unreviewed', text: 'Manual content', description: '', speech: 'unknown', rights: 'unknown', restrictions: '', contentVersion: 1, createdAt: now, updatedAt: now } as StudioMaterial;
}

test('classification is pure, deterministic and fills only missing categories or roles', () => {
  for (const [kind, categories, roles] of [['image',['photo'],['background']],['idea',['idea'],['message']],['text',['ready-text'],['message']],['video',[],['background']],['audio',[],[]]]) {
    const source = material(kind), before = structuredClone(source), first = classifyStudioMaterial(source), second = classifyStudioMaterial(source);
    assert.deepEqual(first, { categories, roles }); assert.deepEqual(first, second); assert.deepEqual(source, before);
    assert.deepEqual(classifyStudioMaterial({ ...source, ...first }), first);
  }
  const source = { ...material('image'), categories: ['testimonial'], roles: ['hook'], rights: 'restricted', review: 'ready', speech: 'present' } as StudioMaterial;
  assert.deepEqual(classifyStudioMaterial(source), { categories: ['testimonial'], roles: ['hook'] });
  const result = classifyStudioMaterial({ ...source, roles: [] }); assert.deepEqual(result.categories, ['testimonial']); assert.deepEqual(result.roles, ['background']);
});

test('video and voice hints come only from declared names, never audio tracks, content or semantic guesses', () => {
  for (const [title, categories] of [['B-roll cooking',['broll']],['Demo product',['demo']],['Talking-head',['talking']],['Testimonio propio',['testimonial']],['broadcast vacation',[]]]) assert.deepEqual(classifyStudioMaterial(material('video', title)).categories, categories);
  const source = { ...material('video','IMG_0042'), text: 'broll talking voice testimonial', description: 'demo' };
  const asset = { name: 'clip.mp4', audioTrack: 'absent' };
  assert.deepEqual(classifyStudioMaterial(source, asset as never), { categories: [], roles: ['background'] });
  assert.deepEqual(classifyStudioMaterial(source, { ...asset, name: 'b_roll.mp4' } as never).categories, ['broll']);
  assert.deepEqual(classifyStudioMaterial(material('audio','Nota de voz 01')), { categories: ['voice'], roles: ['narration'] });
  assert.deepEqual(classifyStudioMaterial(material('audio','recording 01')), { categories: [], roles: [] });
  assert.equal(source.speech, 'unknown');
});

test('new material gets only missing labels while existing edits keep intentional empty fields', () => {
  let state = applyStudioCommand(emptyStudio(), workspace, { type: 'material.save', data: { kind: 'text', title: 'Manual message', text: 'Literal text' } }, { now, newId: () => 'text' });
  const created = state.materials[0]; assert.deepEqual(created.categories, ['ready-text']); assert.deepEqual(created.roles, ['message']);
  assert.equal(created.review,'unreviewed'); assert.equal(created.rights,'unknown'); assert.equal(created.speech,'unknown'); assert.deepEqual(created.productIds,[]);
  state = applyStudioCommand(state, workspace, { type:'material.save',data:{ id:'text',categories:[],roles:[] } }, { now });
  assert.deepEqual(state.materials[0].categories,[]); assert.deepEqual(state.materials[0].roles,[]);
  const overridden = applyStudioCommand(emptyStudio(),workspace,{type:'material.save',data:{kind:'idea',title:'Own labels',categories:['demo'],roles:['cta']}},{now,newId:()=> 'manual'});
  assert.deepEqual(overridden.materials[0].categories,['demo']); assert.deepEqual(overridden.materials[0].roles,['cta']);
});

test('explicit batch classification validates the entire bounded selection before changing anything and replays as a no-op', () => {
  let state = emptyStudio();
  for (const id of ['one','two']) state = applyStudioCommand(state,workspace,{type:'material.save',data:{kind:'idea',title:id}},{now,newId:()=>id});
  for (const item of state.materials) { item.categories=[]; item.roles=[]; }
  state.materials[0].generation={kind:'agent',runId:'old-run',proposalId:'old-proposal',connectionId:'old-connection',provider:'openai-codex',model:'historical',createdAt:now,sourceRefs:[]};
  const before = structuredClone(state);
  for (const ids of [[],['one','missing'],Array.from({length:51},(_,n)=>String(n))]) assert.throws(()=>applyStudioCommand(state,workspace,{type:'material.classify',data:{ids}},{now}),/Selecciona|Selección|existe/);
  assert.deepEqual(state,before);
  const next = applyStudioCommand(state,workspace,{type:'material.classify',data:{ids:['one','two']}},{now:'2026-10-24T18:01:00Z'});
  assert.equal(next.revision,state.revision+1);
  for (const item of next.materials) { assert.deepEqual(item.categories,['idea']); assert.deepEqual(item.roles,['message']); const original=before.materials.find(value=>value.id===item.id)!; const {categories:_c,roles:_r,updatedAt:_u,...facts}=item; const {categories:_bc,roles:_br,updatedAt:_bu,...oldFacts}=original; assert.deepEqual(facts,oldFacts); }
  const replay=applyStudioCommand(next,workspace,{type:'material.classify',data:{ids:['one','two']}},{now:'2026-10-25T18:00:00Z'});
  assert.equal(replay,next); assert.deepEqual(replay,next);
});
