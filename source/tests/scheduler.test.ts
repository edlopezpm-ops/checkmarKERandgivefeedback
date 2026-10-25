import test from 'node:test';
import assert from 'node:assert/strict';
import { EpisodeScheduler, chooseScene, type Clock } from '../src/decoration/scheduler.ts';

class FakeClock implements Clock {
  time=0; next=0; jobs=new Map<number,{at:number;cb:()=>void}>();
  now=()=>this.time;
  set=(cb:()=>void,delay:number)=>{const id=++this.next;this.jobs.set(id,{at:this.time+delay,cb});return id;};
  clear=(id:unknown)=>{this.jobs.delete(id as number);};
  advance(ms:number){const end=this.time+ms;while(true){const next=[...this.jobs.entries()].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;this.time=next[1].at;this.jobs.delete(next[0]);next[1].cb();}this.time=end;}
}
const scenes=[{id:'a',duration:10000,weight:1},{id:'b',duration:6000,weight:1}];
test('first episode waits 30–60 seconds, next wait starts after finish',()=>{
  const c=new FakeClock(),events:string[]=[];
  const s=new EpisodeScheduler(scenes,item=>events.push(item.id),()=>events.push('end'),c,()=>.5);
  s.start();c.advance(44999);assert.deepEqual(events,[]);c.advance(1);assert.deepEqual(events,['b']);
  c.advance(6000);assert.deepEqual(events,['b','end']);c.advance(44999);assert.equal(events.length,2);c.advance(1);assert.equal(events[2],'a');assert.equal(c.jobs.size,1);s.dispose();
});
test('hidden wait resumes remaining time without catch-up',()=>{
  const c=new FakeClock();let starts=0;const s=new EpisodeScheduler(scenes,()=>starts++,()=>{},c,()=>0);
  s.start();c.advance(10000);s.setPaused(true);c.advance(3600000);assert.equal(starts,0);assert.equal(c.jobs.size,0);
  s.setPaused(false);c.advance(19999);assert.equal(starts,0);c.advance(1);assert.equal(starts,1);s.dispose();
});
test('hidden episode pauses completion; dispose cancels all timers',()=>{
  const c=new FakeClock();let ends=0;const s=new EpisodeScheduler(scenes,()=>{},()=>ends++,c,()=>0);
  s.start();c.advance(34000);s.setPaused(true);c.advance(60000);assert.equal(ends,0);s.setPaused(false);c.advance(5999);assert.equal(ends,0);c.advance(1);assert.equal(ends,1);s.dispose();assert.equal(c.jobs.size,0);c.advance(120000);assert.equal(ends,1);
});
test('no immediate repetition, weighted selection and paused startup',()=>{
  assert.equal(chooseScene(scenes,'a',()=>0).id,'b');assert.equal(chooseScene(scenes,'b',()=>.999).id,'a');
  const c=new FakeClock();let starts=0;const s=new EpisodeScheduler(scenes,()=>starts++,()=>{},c,()=>0);
  s.start(true);c.advance(100000);assert.equal(starts,0);assert.equal(c.jobs.size,0);s.setPaused(false);c.advance(30000);assert.equal(starts,1);s.dispose();
});
test('development interruption finishes previous episode and owns one timer',()=>{
  const c=new FakeClock(),events:string[]=[];const s=new EpisodeScheduler(scenes,x=>events.push(x.id),()=>events.push('end'),c,()=>0);
  s.start();s.play(scenes[0]);s.play(scenes[1]);assert.deepEqual(events,['a','end','b']);assert.equal(c.jobs.size,1);s.dispose();
});
