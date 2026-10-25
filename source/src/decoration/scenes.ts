import type { ActorPose, Character, Pose, Stage, View } from './renderer';

export type SceneId = 'kungfu' | 'swords' | 'lasers' | 'stones' | 'tennis' | 'grill' | 'dance' | 'cueca';
export type SceneSample = { claude: ActorPose; codex: ActorPose; phase: 'intro' | 'action' | 'payoff' | 'return'; variant: number };
type Key = { t: number; x: number; y: number; pose: Pose; view: View; rotation: number; ground: number };
const clamp = (n: number, low=0, high=1) => Math.max(low,Math.min(high,n));
const ease = (n: number) => n*n*(3-2*n);
const mix = (a: number,b: number,t: number) => a+(b-a)*t;
const key = (t: number,x: number,y=158,pose: Pose='run',view: View='threeQuarter',rotation=0,ground=184): Key => ({t,x,y,pose,view,rotation,ground});
const home = (who: Character,t: number) => key(t,who==='claude'?84:300,158,'idle','front');

// Positions are torso pivots. Each track contains genuine travelling, airborne,
// turning, contact and recovery poses; the scheduler remains the only clock.
const kungfu: Record<Character,Key[]> = {
  claude: [home('claude',0),key(.035,84,163,'bow','front',.15),key(.08,110,155,'guard'),key(.14,163,145,'run','side',-.1,174),key(.19,170,110,'airkick','threeQuarter',-.22,175),key(.235,143,152,'guard','side',.08),key(.29,71,142,'run','back',-.12,171),key(.34,55,112,'flip','side',-1.8,172),key(.39,117,73,'flip','back',-4.3,172),key(.44,215,132,'airkick','side',-6.05,184),key(.47,269,158,'guard','threeQuarter',-Math.PI*2),key(.52,315,151,'run','back',-Math.PI*2,177),key(.56,322,105,'kick','threeQuarter',-6.5,178),key(.61,262,140,'punch','side',-6.1,183),key(.655,218,157,'guard','threeQuarter',-Math.PI*2),key(.69,147,158,'duck','front',-.3),key(.73,89,124,'flip','back',-.8),key(.77,66,160,'duck','front',-.32),key(.815,73,161,'bow','front',.12),key(.865,81,154,'guard','threeQuarter'),key(.93,84,158,'run','front'),home('claude',1)],
  codex: [home('codex',0),key(.035,300,163,'bow','front',-.12),key(.08,276,155,'guard'),key(.14,219,151,'run','side',.08,181),key(.19,226,161,'duck','side',.22),key(.235,232,139,'kick','threeQuarter',-.1),key(.29,279,109,'airkick','side',.25,180),key(.34,321,74,'flip','back',1.8,180),key(.39,270,111,'flip','side',4.5,178),key(.44,167,156,'run','back',Math.PI*2,183),key(.47,112,158,'guard','threeQuarter',Math.PI*2),key(.52,65,151,'run','side',Math.PI*2,176),key(.56,78,89,'flip','front',8.7,176),key(.61,145,111,'airkick','side',Math.PI*4,179),key(.655,171,151,'punch','threeQuarter',Math.PI*4),key(.69,181,137,'kick','side',.2),key(.73,204,100,'airkick','threeQuarter',-.2),key(.77,231,151,'guard','front'),key(.815,263,122,'victory','front'),key(.865,283,156,'victory','front'),key(.93,300,158,'run','front'),home('codex',1)],
};

function standardTrack(id: SceneId,who: Character): Key[] {
  const left=who==='claude'; const x=(v: number)=>left?v:384-v;
  if(id==='grill') return [home(who,0),key(.11,x(122),158,'run','side'),key(.2,x(132),149,'guard','threeQuarter',0,175),key(.32,x(148),145,'throw','back',0,171),key(.46,x(118),158,'run','side'),key(.57,x(129),155,'throw','threeQuarter'),key(.7,x(128),155,'guard','front'),key(.79,x(125),128,'victory','front'),key(.87,x(117),156,'dance','front'),key(.94,x(93),158,'run','side'),home(who,1)];
  if(id==='dance') return [home(who,0),key(.1,x(106),155,'dance','front'),key(.2,x(151),134,'dance','side',left?-.2:.2,174),key(.31,x(177),147,'dance','back',0,174),key(.4,x(256),154,'run','side'),key(.49,x(304),115,'flip','threeQuarter',left?-2.6:2.6),key(.56,x(278),153,'dance','back',left?-Math.PI*2:Math.PI*2),key(.65,x(219),146,'dance','side',0,171),key(.74,x(135),155,'dance','front'),key(.83,x(92),124,'victory','front'),key(.92,x(87),158,'dance','front'),home(who,1)];
  if(id==='tennis') return [home(who,0),key(.09,x(111),156,'guard','threeQuarter'),key(.18,x(55),148,'run','side',0,174),key(.26,x(98),123,'punch','threeQuarter',left?-.2:.2,174),key(.34,x(139),158,'run','side'),key(.43,x(79),148,'throw','back',0,173),key(.52,x(53),155,'run','side'),key(.6,x(112),115,'airkick','threeQuarter'),key(.69,x(left?61:133),155,left?'run':'punch','side'),key(.77,x(left?55:124),159,left?'duck':'victory','front'),key(.86,x(86),left?158:133,left?'bow':'victory','front'),key(.94,x(84),158,'run','threeQuarter'),home(who,1)];
  if(id==='lasers') return [home(who,0),key(.1,x(115),155,'guard','threeQuarter'),key(.19,x(54),153,'duck','side'),key(.27,x(79),88,'airkick','threeQuarter'),key(.36,x(169),138,'run','back',0,167),key(.45,x(265),143,'guard','side',0,170),key(.53,x(324),119,'flip','back',left?2.8:-2.8),key(.61,x(267),155,'punch','threeQuarter',left?Math.PI*2:-Math.PI*2),key(.69,x(183),left?159:109,left?'duck':'airkick','side'),key(.76,x(104),left?159:145,left?'duck':'punch','front'),key(.84,x(83),left?158:128,left?'bow':'victory','front'),key(.94,x(84),158,'run','threeQuarter'),home(who,1)];
  if(id==='stones') return [home(who,0),key(.1,x(111),155,'guard','front'),key(.19,x(68),152,'throw','threeQuarter'),key(.29,x(141),146,'run','back',0,172),key(.38,x(98),97,'airkick','side',left?-.3:.3,172),key(.47,x(56),153,'duck','front'),key(.56,x(135),153,'throw','side'),key(.65,x(163),145,'run','back',0,171),key(.75,x(left?84:145),158,left?'duck':'guard','front'),key(.84,x(85),left?158:133,left?'bow':'victory','front'),key(.94,x(84),158,'run','threeQuarter'),home(who,1)];
  // Sword duel: a full airborne exchange changes sides, then Codex disarms Claude.
  return [home(who,0),key(.09,x(119),154,'guard','threeQuarter'),key(.17,x(152),147,'punch','side'),key(.25,x(99),112,'airkick','threeQuarter',left?-.2:.2),key(.34,x(63),151,'guard','back',0,175),key(.43,x(159),left?80:140,left?'flip':'run',left?'side':'back',left?-3.2:0,175),key(.51,x(266),151,'punch','side',left?-Math.PI*2:0),key(.59,x(314),120,'airkick','threeQuarter'),key(.67,x(243),151,'punch','side'),key(.75,x(left?288:230),left?159:128,left?'duck':'punch','front'),key(.84,x(left?228:182),left?158:137,left?'bow':'victory','front'),key(.93,x(97),158,'run','side'),home(who,1)];
}
const tracks = Object.fromEntries((['swords','lasers','stones','tennis','grill','dance'] as SceneId[]).map(id=>[id,{claude:standardTrack(id,'claude'),codex:standardTrack(id,'codex')}])) as Record<SceneId,Record<Character,Key[]>>;
tracks.kungfu=kungfu;

function sampleTrack(keys: readonly Key[],p: number,who: Character): ActorPose {
  let index=keys.findIndex((k,i)=>i<keys.length-1&&p>=k.t&&p<keys[i+1].t);
  if(index<0)index=keys.length-2;
  const a=keys[index],b=keys[index+1], raw=clamp((p-a.t)/(b.t-a.t)),t=ease(raw);
  // The in-between projection makes front/back turns readable instead of
  // replacing one frozen face with another. Travel itself is interpolated.
  let view=a.view;
  if(a.view!==b.view&&raw>.6) view=raw>.83?b.view:(a.view==='back'||b.view==='back'?'side':'threeQuarter');
  const ground=mix(a.ground,b.ground,t);
  let turn=b.rotation-a.rotation;
  // Full rotations belong to explicit somersaults. Returning from an unwrapped
  // flip must not accidentally create another revolution in a walking pose.
  if(a.pose!=='flip'&&b.pose!=='flip') turn=Math.atan2(Math.sin(turn),Math.cos(turn));
  const isEnd=p===0||p===1;
  return {x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),facing:who==='claude'?1:-1,rotation:a.rotation+turn*t,view:isEnd?'front':view,
    pose:isEnd?'idle':a.pose,stride:p*22+(who==='codex'?.4:0),expression:'smile',shadowY:ground,scale:.9+(ground-167)/170};
}

function varyPosition(actor: ActorPose,id: SceneId,who: Character,p: number,v: number) {
    const envelope=Math.sin(p*Math.PI)**2;
    if(v) {
      const offset=Math.sin(p*Math.PI*(v+2)+(who==='claude'?0:Math.PI))*(v*8)*envelope;
      actor.x=clamp(actor.x+offset,52,332);
      // Real depth travel: ground position and scale move together.
      const depth=Math.sin(p*Math.PI*(v+1)+(who==='claude'?0:1))*6*envelope;
      actor.y+=depth;actor.shadowY+=depth;actor.scale+=depth/170;
      if(v>=2&&p>.11&&p<.76&&['kungfu','swords','lasers','dance'].includes(id)) {
        const mirror=ease(clamp((p-.11)/.12))*ease(clamp((.76-p)/.1));
        actor.x=mix(actor.x,384-actor.x,mirror);
      }
    }
}

// Alternate combinations change the actual articulated action order, not just
// its coordinates. Airborne flips, the decisive Codex strike and the friendly
// recovery remain in every score. Each interval leaves its own anticipation.
const kungfuCombinations: readonly (readonly [number,number,Pose,Pose][])[] = [
  [],
  [[.14,.19,'punch','guard'],[.235,.29,'kick','duck'],[.61,.655,'kick','airkick']],
  [[.14,.19,'guard','punch'],[.235,.29,'punch','guard'],[.655,.69,'duck','kick']],
  [[.08,.14,'run','run'],[.235,.29,'kick','punch'],[.47,.52,'punch','duck'],[.61,.655,'guard','airkick']],
];
function varyChoreography(actor: ActorPose,id: SceneId,who: Character,p: number,v: number) {
  if(id==='kungfu') {
    const combo=kungfuCombinations[v].find(([from,to])=>p>=from&&p<to);
    if(combo)actor.pose=combo[who==='claude'?2:3];
  } else if(v&&p>.15&&p<.7) {
    // Rallies alternate attacks, preparation and evasions while retaining
    // their character-specific props and the same narrative payoff.
    if(id==='swords'&&actor.pose==='guard'&&v%2===1)actor.pose='punch';
    if(id==='lasers'&&actor.pose==='punch'&&v===2)actor.pose='duck';
    if(id==='stones'&&actor.pose==='guard'&&v===3)actor.pose='throw';
    if(id==='dance'&&actor.pose==='dance'&&((Math.floor(p*18)+v)%4===0))actor.pose='victory';
  }
}

/** A partnered dance score: a shared ellipse keeps the two paths antipodal.
 * Its depth radius also leaves room for the raised handkerchief and huaso hat
 * when the partners exchange front/back positions. No airborne poses are used. */
function sampleCueca(p: number,variant: number): SceneSample {
  const direction=variant%2===0?1:-1,rx=[104,100,108,102][variant],center=192+[-2,2,-3,3][variant];
  const orbit=(who: Character,turn: number) => {
    const angle=(who==='claude'?Math.PI:0)+direction*turn;
    const vertical=Math.cos(angle)*direction;
    const view: View=vertical>.6?'front':vertical<-.6?'back':Math.abs(vertical)<.18?'side':'threeQuarter';
    return {x:center+rx*Math.cos(angle),y:122+46*Math.sin(angle),view,facing:(-Math.sin(angle)*direction>=0?1:-1) as 1|-1};
  };
  const pair={} as Record<Character,ActorPose>;
  for(const who of ['claude','codex'] as const) {
    const left=who==='claude',homeX=left?84:300,nearX=center+(left?-76:76),oppositeX=center+(left?76:-76);
    const phaseOffset=left?0:.5;
    let point={x:homeX,y:158,view:'front' as View,facing:(left?1:-1) as 1|-1},pose: Pose='cueca';
    const between=(from: ReturnType<typeof orbit>,to: ReturnType<typeof orbit>,q: number) => ({...to,x:mix(from.x,to.x,ease(clamp(q))),y:mix(from.y,to.y,ease(clamp(q)))});
    const initial=orbit(who,0),opposite=orbit(who,Math.PI);
    const near={x:nearX,y:148,view:'front' as View,facing:(left?1:-1) as 1|-1};
    const far={x:oppositeX,y:148,view:'front' as View,facing:(left?-1:1) as 1|-1};
    if(p<.16) {
      point=between(point,initial,p/.16);pose=p<.055?'idle':p<.125?'bow':'cueca';point.view=p<.125?'front':'threeQuarter';
    } else if(p<.43) point=orbit(who,(p-.16)/.27*Math.PI*2);
    else if(p<.49) point=between(initial,near,(p-.43)/.06);
    else if(p<.62) {
      const q=(p-.49)/.13;
      point={...near,x:near.x+Math.sin(q*Math.PI*4)*(left?12:-12),view:(['front','threeQuarter','side','threeQuarter'] as const)[Math.floor(q*8)%4]};
    } else if(p<.65) point=between(near,initial,(p-.62)/.03);
    else if(p<.75) point=orbit(who,(p-.65)/.1*Math.PI);
    else if(p<.79) point=between(opposite,far,(p-.75)/.04);
    else if(p<.86) {point={...far,x:far.x+Math.sin((p-.79)/.07*Math.PI*2)*(left?2:-2)};pose='zapateo';}
    else if(p<.89) {point=far;pose='bow';}
    else if(p<.92) {point=between(far,opposite,(p-.89)/.03);pose='cueca';}
    else if(p<.985) {point=orbit(who,Math.PI+(p-.92)/.065*Math.PI);pose='run';}
    else {point=between(initial,{x:homeX,y:158,view:'front',facing:1},(p-.985)/.015);pose='run';}
    const stride=p*(pose==='zapateo'?56:36)+phaseOffset;
    const bounce=pose==='cueca'||pose==='zapateo'?Math.abs(Math.sin(stride*Math.PI*2))*.9:0;
    const ground=point.y+26;
    pair[who]={...point,y:point.y-bounce,pose,stride,rotation:pose==='bow'?(left?.035:-.035):Math.sin(stride*Math.PI*2)*.018,shadowY:ground,scale:.98+(ground-158)/550,expression:p>=.75&&p<.92?'happy':'smile',...(p>=.055&&p<.92?{costume:'huaso' as const}:{})};
    if(p===0||p===1) pair[who]={x:homeX,y:158,facing:1,rotation:0,view:'front',pose:'idle',stride:p*36+phaseOffset,expression:'smile',shadowY:184,scale:1};
  }
  return {...pair,phase:p<.16?'intro':p<.75?'action':p<.89?'payoff':'return',variant};
}

/** Public deterministic sampling for browser evidence; variant is selected once
 * per episode. Four bounded spatial scores vary arcs, depth and travel direction. */
export function sampleScene(id: SceneId,progress: number,variant=0): SceneSample {
  const p=clamp(progress),v=((Math.floor(variant)%4)+4)%4;
  if(id==='cueca')return sampleCueca(p,v);
  const sample: SceneSample={claude:sampleTrack(tracks[id].claude,p,'claude'),codex:sampleTrack(tracks[id].codex,p,'codex'),phase:p<.1?'intro':p<.74?'action':p<.88?'payoff':'return',variant:v};
  for(const who of ['claude','codex'] as const) {
    const actor=sample[who]; varyPosition(actor,id,who,p,v);
    varyChoreography(actor,id,who,p,v);
    if(sample.phase==='payoff') actor.expression=['grill','dance'].includes(id)||who==='codex'?'happy':'surprise';
  }
  sample.claude.facing=sample.claude.x<=sample.codex.x?1:-1;
  sample.codex.facing=sample.codex.x<=sample.claude.x?1:-1;
  // Running uses the actual variant's travel direction. Combat poses can step
  // backwards while maintaining a guard toward their friendly opponent.
  for(const who of ['claude','codex'] as const) if(sample[who].pose==='run') {
    const before=sampleTrack(tracks[id][who],clamp(p-.003),who);
    varyPosition(before,id,who,clamp(p-.003),v);
    const dx=sample[who].x-before.x;
    if(Math.abs(dx)>.02)sample[who].facing=dx>0?1:-1;
  }
  if(p===0||p===1) {sample.claude.facing=1;sample.codex.facing=1;sample.claude.scale=sample.codex.scale=1;}
  return sample;
}

function propAt(s: Stage,a: ActorPose,draw:()=>void) {const c=s.ctx;c.save();c.translate(Math.round(a.x),Math.round(a.y));c.rotate(a.rotation);c.scale(a.facing*a.scale,a.scale);draw();c.restore();}
function sword(s: Stage,a: ActorPose,cyan: boolean,p: number) { propAt(s,a,()=>{const c=s.ctx;c.save();c.translate(28,-13);c.rotate(-.45+Math.sin(p*Math.PI*24)*.7);s.rect(-2,-32,5,30,cyan?'#8accc7':'#ddc4a3');s.rect(-1,-36,3,6,'#f2e6c8');s.rect(-7,-6,15,4,'#8f7c55');s.rect(-1,-2,4,9,'#77614e');c.restore();}); }
function racket(s: Stage,a: ActorPose) {propAt(s,a,()=>{s.line([[23,-4],[30,-19]],'#99845f',3);s.line([[30,-19],[23,-27],[25,-39],[36,-43],[44,-35],[42,-24],[30,-19]],'#659e8f',3);s.line([[27,-34],[40,-30]],'#bccbb1',1);s.line([[31,-38],[35,-24]],'#bccbb1',1);});}
function puff(s: Stage,x: number,y: number,amount: number,color='#a9b1a14d') {for(let i=0;i<4;i++){const angle=i*1.8; s.rect(x+Math.cos(angle)*amount-2,y+Math.sin(angle)*amount-2,4,4,color);}}

/** Draw-only lifecycle. All props vanish at finish; no timers or background loops. */
export function createScene(id: SceneId,competitive: boolean,seed?: number) {
  let variant=seed??0;
  return {
    start(s: Stage) {variant=seed??Math.floor(Math.random()*4);s.idle();},
    finish(s: Stage) {s.idle();},
    frame(s: Stage,progress: number) {
      const p=clamp(progress),motion=sampleScene(id,p,variant),a=motion.claude,b=motion.codex;
      s.clear();
      // A farther character is drawn first, including when paths cross.
      if(a.shadowY<=b.shadowY){s.actor('claude',a);s.actor('codex',b);}else{s.actor('codex',b);s.actor('claude',a);}
      if(p<.065||p>.925)return;
      const active=motion.phase==='action',payoff=motion.phase==='payoff';
      if(id==='kungfu') {
        if(active) {
          for(const actor of [a,b]) if(['airkick','flip'].includes(actor.pose)) {
            const dx=-actor.facing;
            s.line([[clamp(actor.x+dx*32,12,372),actor.y+1],[clamp(actor.x+dx*44,12,372),actor.y+4]],'#9baaa34b',2);
            s.line([[clamp(actor.x+dx*30,12,372),actor.y+9],[clamp(actor.x+dx*39,12,372),actor.y+11]],'#9baaa330',2);
          }
          if((p>.64&&p<.67)||(p>.18&&p<.205)) puff(s,(a.x+b.x)/2,Math.max(70,Math.min(a.y,b.y)-6),8+Math.sin(p*180)*3,'#d0b58c91');
        }
        if(payoff){s.sparkle(b.x-27,b.y-32);s.sparkle(b.x+27,b.y-23,'#8ebeb1');if(p<.81)s.label('!',a.x,a.y-37,'#ad806a');}
      }
      if(id==='swords') {
        if(!payoff)sword(s,a,false,p);sword(s,b,true,p+.12);
        if(active&&Math.abs(a.x-b.x)<90)puff(s,(a.x+b.x)/2,Math.min(a.y,b.y)-30,9,'#b8c6aa8c');
        if(payoff){s.rect(clamp(a.x-32,12,360),189,23,3,'#c8b491');s.sparkle(b.x,b.y-43);}
      }
      if(id==='lasers') {
        for(const [actor,color] of [[a,'#c79778'],[b,'#68a9b0']] as const) propAt(s,actor,()=>{s.rect(24,-14,18,8,color);s.rect(26,-8,5,8,color);s.rect(40,-12,4,4,'#e8dcb1');});
        if(active) {const shot=(p*14)%1,from=Math.floor(p*14)%2?a:b,to=from===a?b:a;const x=mix(from.x,to.x,shot),y=mix(from.y-12,to.y-12,shot);s.rect(x-4,y,9,3,from===a?'#dcb79c':'#83bbb6');}
        if(payoff){puff(s,a.x+10,a.y-27,12,'#a9c0b970');s.sparkle(b.x,b.y-43);}
      }
      if(id==='stones') {
        if(active){const travel=(p*9)%1,from=Math.floor(p*9)%2?a:b,to=from===a?b:a,x=mix(from.x,to.x,travel),y=mix(from.y-20,to.y-20,travel)-Math.sin(travel*Math.PI)*55;s.rect(x,y,7,6,'#a3a496');s.rect(x+1,y-1,4,2,'#c9c7b7');}
        if(payoff){for(let i=0;i<3;i++){s.rect(b.x-31+i*3,184-i*7,17-i*3,6,'#a4a99b');s.rect(b.x-29+i*3,184-i*7,10-i*2,2,'#c8ccba');}s.sparkle(b.x+26,b.y-26);s.label('?',a.x,a.y-37,'#ac8970');}
      }
      if(id==='tennis') {
        s.line([[192,147],[192,192]],'#9aab96',3);s.line([[179,153],[205,153],[205,183],[179,183],[179,153]],'#aebca4',2);
        for(let y=160;y<183;y+=7)s.line([[179,y],[205,y]],'#c3cbb4',1);
        racket(s,a);racket(s,b);
        if(active){const travel=(p*11)%1,from=Math.floor(p*11)%2?a:b,to=from===a?b:a;s.rect(mix(from.x,to.x,travel),mix(from.y-28,to.y-28,travel)-Math.sin(travel*Math.PI)*39,5,5,'#b6bc72');}
        if(payoff){s.rect(a.x-28,183,5,5,'#b6bc72');s.label('0 : 1',192,109);s.sparkle(b.x,b.y-43);}
      }
      if(id==='grill') {
        s.line([[177,176],[171,194]],'#818b7a',4);s.line([[207,176],[213,194]],'#818b7a',4);
        s.rect(167,162,50,15,'#87887b');s.rect(173,177,38,5,'#686f63');
        for(let x=173;x<214;x+=7)s.rect(x,159,3,6,'#c8c5a7');
        s.rect(178,155,13,5,'#ca9c64');s.rect(199,155,9,5,'#a1b680');
        if(active){const drift=(p*4)%1;s.rect(186+Math.sin(drift*5)*5,149-drift*28,4,4,'#a9b0a238');s.line([[b.x-20,b.y-8],[205,151]],'#98a18d',2);s.rect(201,149,9,3,'#b5bba5');}
        if(payoff){s.sparkle(a.x,a.y-38);s.sparkle(b.x,b.y-44);}
      }
      if(id==='dance'&&active){const beat=Math.sin(p*Math.PI*28);s.sparkle(174,72+beat*5,'#c6b18b');s.sparkle(212,91-beat*5,'#92b9ab');s.line([[188,107],[188,94],[196,91],[196,104]],'#a5ac95',2);s.rect(184,105,5,3,'#a5ac95');s.rect(192,102,5,3,'#a5ac95');}
    },
  };
}
