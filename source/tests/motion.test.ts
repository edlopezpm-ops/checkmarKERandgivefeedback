import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleScene, type SceneId } from '../src/decoration/scenes.ts';
import { torsoPixels, type Character, type View } from '../src/decoration/renderer.ts';

const repertory: SceneId[] = ['kungfu', 'swords', 'lasers', 'stones', 'tennis', 'grill', 'dance', 'cueca'];
const characters: Character[] = ['claude', 'codex'];
const span = (values: number[]) => Math.max(...values) - Math.min(...values);

test('kung fu travels across the stage, jumps and exchanges sides in every variant', () => {
  for (let variant = 0; variant < 4; variant++) {
    const frames = Array.from({ length: 501 }, (_, i) => sampleScene('kungfu', i / 500, variant));
    for (const who of characters) {
      assert.ok(span(frames.map(f => f[who].x)) >= 220, `${who} must traverse the arena`);
      assert.ok(span(frames.map(f => f[who].y)) >= 70, `${who} must jump beyond an idle bob`);
      assert.equal(new Set(frames.map(f => f[who].view)).size, 4);
      assert.ok(frames.some(f => f[who].pose === 'airkick'));
      assert.ok(frames.some(f => f[who].pose === 'flip'));
    }
    assert.ok(frames.some(f => f.claude.x > f.codex.x + 100), 'characters exchange places');
    assert.ok(frames.some(f => f.codex.x > f.claude.x + 100), 'characters return to their own side');
  }
});

test('genuine side and rear torsos have their own silhouettes and surface pixels', () => {
  for (const who of characters) {
    const bodies = (['front', 'threeQuarter', 'side', 'back'] as View[]).map(view => JSON.stringify(torsoPixels(who, view)));
    assert.equal(new Set(bodies).size, 4, `${who} needs four distinct projections`);
    const width = (view: View) => {
      const pixels = torsoPixels(who, view);
      return Math.max(...pixels.map(p => p[0] + p[2])) - Math.min(...pixels.map(p => p[0]));
    };
    assert.ok(width('side') < width('front'), 'profile must be narrower than the frontal body');
  }
  assert.notDeepEqual(torsoPixels('claude', 'front').map(p => p.slice(0, 4)), torsoPixels('codex', 'front').map(p => p.slice(0, 4)));
});

test('all scenes retain finite bounded motion and a clean return to the same idle pose', () => {
  for (const id of repertory) for (let variant = 0; variant < 4; variant++) {
    for (let i = 0; i <= 240; i++) {
      const state = sampleScene(id, i / 240, variant);
      for (const who of characters) {
        const actor = state[who];
        for (const value of [actor.x, actor.y, actor.scale, actor.rotation, actor.shadowY]) assert.ok(Number.isFinite(value));
        assert.ok(actor.x >= 40 && actor.x <= 344);
        assert.ok(actor.y >= 60 && actor.y <= 170);
        assert.ok(actor.scale >= .85 && actor.scale <= 1.1);
      }
    }
    for (const who of characters) {
      const first = sampleScene(id, 0, variant)[who], last = sampleScene(id, 1, variant)[who];
      assert.deepEqual({ x: last.x, y: last.y, view: last.view, pose: last.pose }, { x: first.x, y: first.y, view: first.view, pose: first.pose });
    }
  }
});

test('episodes vary in two dimensions while cooperative and winning reactions remain coherent', () => {
  const variants = Array.from({ length: 4 }, (_, v) => Array.from({ length: 20 }, (_, i) => sampleScene('kungfu', (i + 1) / 22, v)));
  assert.equal(new Set(variants.map(v => JSON.stringify(v))).size, 4);
  assert.equal(new Set(variants.map(v => v.map(f => `${f.claude.pose}/${f.codex.pose}`).join(','))).size, 4, 'variants must change action combinations as well as trajectories');
  for (const id of repertory) {
    const payoff = sampleScene(id, .82);
    assert.equal(payoff.codex.expression, 'happy');
    assert.equal(payoff.claude.expression, id === 'grill' || id === 'dance' || id === 'cueca' ? 'happy' : 'surprise');
  }
});

test('cueca partners circle in depth, escobillan, alternate zapateo and salute without a winner', () => {
  const variants=[];
  for(let variant=0;variant<4;variant++) {
    const frames=Array.from({length:1001},(_,index)=>sampleScene('cueca',index/1000,variant));
    variants.push(frames.map(frame=>[frame.claude.x,frame.claude.y,frame.codex.x,frame.codex.y]));
    for(const who of characters) {
      const turns=frames.filter((_,index)=>index>=160&&index<430).map(frame=>frame[who]);
      assert.equal(new Set(turns.map(actor=>actor.view)).size,4,'circle has real front/profile/rear views');
      assert.ok(span(turns.map(actor=>actor.x))>190,'circle travels broadly across the arena');
      assert.ok(span(turns.map(actor=>actor.shadowY))>85,'circle crosses real depth planes');
      assert.ok(span(frames.filter((_,index)=>index>=490&&index<620).map(frame=>frame[who].x))>20,'escobillado travels laterally');
      assert.equal(sampleScene('cueca',.82,variant)[who].pose,'zapateo');
      assert.equal(sampleScene('cueca',.875,variant)[who].pose,'bow');
      assert.equal(sampleScene('cueca',.82,variant)[who].expression,'happy');
      for(const actor of frames.map(frame=>frame[who])) {
        assert.ok(!['flip','airkick','kick','punch','victory'].includes(actor.pose),'dance has no martial or winning gestures');
        assert.ok(Math.abs(actor.shadowY-actor.y-26)<1,'torso bounce remains below one pixel');
        assert.ok(Math.abs(actor.rotation)<=.04,'no ballet-like body spins');
        if(actor.costume) {
          assert.ok(actor.x-50*actor.scale>0&&actor.x+50*actor.scale<384,'hat and handkerchief remain horizontally inside arena');
          assert.ok(actor.y-55*actor.scale>0&&actor.y+28*actor.scale<216,'costume and boots remain vertically inside arena');
        }
      }
      assert.equal(frames[0][who].costume,undefined);assert.equal(frames[1000][who].costume,undefined);
    }
    for(const frame of frames) assert.ok(Math.hypot(frame.claude.x-frame.codex.x,frame.claude.y-frame.codex.y)>=90,'partners leave room for costumes while passing');
    const stamp=sampleScene('cueca',.82,variant);
    assert.ok(Math.abs(Math.sin(stamp.claude.stride*Math.PI*2)+Math.sin(stamp.codex.stride*Math.PI*2))<.000001,'partners alternate their stamping phase');
    assert.ok(sampleScene('cueca',.76,variant).claude.x>sampleScene('cueca',.76,variant).codex.x,'half-turn exchanges partners without crossing through each other');
    assert.deepEqual(frames[0].claude, {...frames[1000].claude,stride:frames[0].claude.stride});
    assert.deepEqual(frames[0].codex, {...frames[1000].codex,stride:frames[0].codex.stride});
  }
  assert.equal(new Set(variants.map(value=>JSON.stringify(value))).size,4,'four bounded dance scores vary direction and radius');
});
