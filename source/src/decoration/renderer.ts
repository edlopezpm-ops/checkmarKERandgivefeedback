export type Character = 'claude' | 'codex';
export type View = 'front' | 'threeQuarter' | 'side' | 'back';
export type Pose = 'idle' | 'run' | 'guard' | 'punch' | 'kick' | 'airkick' | 'flip' | 'duck' | 'bow' | 'victory' | 'dance' | 'throw' | 'cueca' | 'zapateo';
export type Expression = 'smile' | 'surprise' | 'happy';
export type ActorPose = {
  x: number; y: number; facing: 1 | -1; rotation: number; view: View;
  pose: Pose; stride: number; expression: Expression; shadowY: number; scale: number;
  costume?: 'huaso';
};
type Pixel = [number, number, number, number, string];
export const VIEWS: readonly View[] = ['front', 'threeQuarter', 'side', 'back'];
const palettes = {
  claude: { edge: '#9b5945', dark: '#ba6a50', body: '#dc8869', light: '#efa783', glint: '#f7b795', ink: '#473a32' },
  codex: { edge: '#326b6c', dark: '#3b9496', body: '#64c1bc', light: '#9bddd4', glint: '#c5eee2', ink: '#24484c' },
};

/** The exact same pixel geometry builds the hosted atlas and its offline fallback.
 * Frames are genuinely different projections, rather than mirrored front faces. */
export function torsoPixels(who: Character, view: View): Pixel[] {
  const p = palettes[who]; const a: Pixel[] = [];
  const r = (x: number, y: number, w: number, h: number, color: string) => a.push([x, y, w, h, color]);
  if (who === 'claude') {
    if (view === 'side') {
      r(-11,-25,21,27,p.edge); r(-14,-19,27,17,p.edge);
      r(-9,-25,17,4,p.light); r(-12,-19,23,15,p.body); r(-9,-21,18,21,p.body);
      r(-12,-19,6,18,p.dark); r(-6,-23,14,4,p.light); r(9,-17,5,9,p.body);
      r(-10,0,18,3,p.dark);
    } else {
      const back = view === 'back'; const quarter = view === 'threeQuarter';
      r(-23,-23,42,25,p.edge); r(-27,-17,50,15,p.edge);
      r(-20,-27,36,5,p.dark); r(-17,-29,30,3,p.light);
      r(-25,-17,46,15,p.body); r(-21,-23,38,25,p.body);
      r(-20,-25,34,4,p.light); r(-21,-21,5,18,p.light);
      r(17,-21,6,21,p.dark); r(14,-25,5,4,p.dark); r(-19,0,36,3,p.dark);
      if (quarter) { r(9,-21,8,21,p.dark); r(17,-17,6,13,p.edge); r(-21,-21,6,3,p.glint); }
      if (back) { r(-17,-20,30,3,p.light); r(-21,-14,5,13,p.dark); r(-14,-16,23,2,p.dark); }
    }
  } else {
    if (view === 'side') {
      r(-10,-29,21,28,p.edge); r(-13,-23,27,16,p.edge);
      r(-7,-31,15,3,p.light); r(-8,-27,17,24,p.body); r(-11,-23,6,16,p.dark);
      r(3,-24,9,15,p.ink); r(10,-20,5,9,p.dark); r(-8,-1,18,8,p.dark);
      r(-5,1,12,6,p.body); r(-9,-19,5,8,p.light); r(-8,-35,3,6,p.edge); r(-10,-37,6,3,p.light);
    } else {
      const back = view === 'back'; const quarter = view === 'threeQuarter';
      r(-17,-30,34,31,p.edge); r(-21,-24,42,19,p.edge);
      r(-14,-33,28,4,p.dark); r(-12,-34,25,3,p.light);
      r(-18,-24,36,20,p.body); r(-15,-28,30,27,p.body);
      r(-15,-28,28,4,p.light); r(15,-24,6,19,p.dark);
      r(-23,-19,5,10,p.dark); r(20,-19,5,10,p.dark);
      r(-11,0,22,9,p.edge); r(-8,1,16,7,p.body); r(-5,2,10,3,p.light);
      r(0,-38,3,5,p.edge); r(-2,-40,7,3,p.light);
      if (back) {
        r(-12,-23,24,18,p.dark); r(-9,-20,18,12,p.edge); r(-6,-18,12,2,p.light); r(-6,-13,12,2,p.body);
        r(10,-2,4,3,p.light);
      } else {
        r(quarter ? -15 : -14,-23,quarter ? 24 : 28,16,p.ink);
        r(quarter ? 9 : 14,-23,4,16,p.dark); r(-14,-24,24,2,p.light);
        if (quarter) r(13,-20,5,12,p.edge);
      }
    }
  }
  return a;
}

type Point = [number, number];
type Limbs = { rearArm: Point[]; arm: Point[]; rearLeg: Point[]; leg: Point[] };
function limbs(p: ActorPose, who: Character): Limbs {
  const wave = Math.sin(p.stride * Math.PI * 2); const w = who === 'claude' ? 22 : 17;
  const result: Limbs = {
    rearArm: [[-w,-10],[-w-5,-4],[-w-4,1]], arm: [[w-2,-10],[w+4,-4],[w+3,1]],
    rearLeg: [[-10,1],[-11,13],[-13,23]], leg: [[10,1],[11,13],[13,23]],
  };
  if (p.pose === 'run') {
    result.arm = [[w-2,-10],[w+3+wave*4,-4-wave*8],[w+6+wave*5,-1-wave*10]];
    result.rearArm = [[-w,-10],[-w-4-wave*4,-5+wave*8],[-w-5-wave*5,-2+wave*10]];
    result.leg = [[9,1],[8+wave*9,12],[10+wave*15,22-Math.max(0,-wave)*9]];
    result.rearLeg = [[-9,1],[-8-wave*9,12],[-10-wave*15,22-Math.max(0,wave)*9]];
  }
  if (['guard','punch','kick','airkick','flip'].includes(p.pose)) {
    result.arm = [[w-2,-11],[w+5,-6],[w+7,-19]];
    result.rearArm = [[-w,-10],[-w-3,0],[-w+8,2]];
    result.rearLeg = [[-9,1],[-15,12],[-20,23]]; result.leg = [[9,1],[16,12],[21,23]];
  }
  if (p.pose === 'punch') result.arm = [[w-2,-11],[w+12,-14],[w+22,-13]];
  if (p.pose === 'kick' || p.pose === 'airkick') {
    result.leg = [[7,1],[20,-6],[36,-13]];
    result.arm = [[w-2,-11],[w+5,-22],[w+1,-29]];
    result.rearLeg = [[-8,1],[-16,12],[-11,p.pose === 'airkick' ? 16 : 24]];
  }
  if (p.pose === 'flip') { result.leg = [[8,1],[18,9],[19,-2]]; result.rearLeg = [[-8,1],[-16,8],[-16,-4]]; result.arm = [[w-2,-11],[w+7,-20],[w,-27]]; }
  if (p.pose === 'duck' || p.pose === 'bow') {
    result.leg = [[8,1],[20,9],[25,12]]; result.rearLeg = [[-8,1],[-17,9],[-21,12]];
    result.arm = [[w-2,-11],[w+2,0],[w+8,3]];
  }
  if (p.pose === 'victory' || p.pose === 'dance' || p.pose === 'throw') {
    const beat = p.pose === 'victory' ? 1 : wave;
    result.arm = [[w-2,-11],[w+7,-22],[w+3,-33+beat*3]];
    result.rearArm = [[-w,-10],[-w-7,-16],[-w-3,-28-beat*4]];
    if (p.pose === 'dance') {
      result.leg = [[8,1],[13+wave*5,12],[16+wave*10,22-Math.max(0,wave)*8]];
      result.rearLeg = [[-8,1],[-13+wave*5,12],[-16+wave*10,22-Math.max(0,-wave)*8]];
    }
  }
  if (p.pose === 'cueca' || p.pose === 'zapateo') {
    // The raised hand carries one pañuelo; the other stays beside the waist.
    result.arm = [[w-2,-10],[w+8,-24],[w+5+wave*3,-36+Math.cos(p.stride*Math.PI*2)*3]];
    result.rearArm = [[-w,-10],[-w-8,-2],[-w-1,8]];
    if (p.pose === 'cueca') {
      result.leg = [[9,2],[12+wave*4,13],[14+wave*7,23-Math.max(0,wave)*5]];
      result.rearLeg = [[-9,2],[-12+wave*4,13],[-14+wave*7,23-Math.max(0,-wave)*5]];
    } else {
      // Opposed half-beats lift one boot while the other stamps the ground.
      const frontLift = Math.max(0,wave), rearLift = Math.max(0,-wave);
      result.leg = [[9,2],[11+frontLift*4,12-frontLift*3],[14+frontLift*4,24-frontLift*11]];
      result.rearLeg = [[-9,2],[-11-rearLift*4,12-rearLift*3],[-14-rearLift*4,24-rearLift*11]];
    }
  }
  // Side projections overlap limbs; rear limbs remain darker and offset.
  if (p.view === 'side') for (const key of ['arm','rearArm','leg','rearLeg'] as const) result[key] = result[key].map(([x,y]) => [x*.72,y]);
  return result;
}

export class Stage {
  ctx: CanvasRenderingContext2D;
  sprites?: HTMLImageElement;
  constructor(canvas: HTMLCanvasElement) { this.ctx = canvas.getContext('2d')!; this.ctx.imageSmoothingEnabled = false; }
  clear() { this.ctx.clearRect(0,0,384,216); }
  rect(x: number,y: number,w: number,h: number,color: string) { this.ctx.fillStyle=color; this.ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }
  line(points: number[][], color: string, width = 3) {
    // Stepped pixel segments stay crisp for bent knees and diagonal props.
    for (let n=1;n<points.length;n++) {
      const [x0,y0]=points[n-1], [x1,y1]=points[n]; const length=Math.max(Math.abs(x1-x0),Math.abs(y1-y0));
      for(let i=0;i<=length;i+=1.5) { const t=length ? i/length : 0; this.rect(Math.round((x0+(x1-x0)*t)/2)*2-width/2,Math.round((y0+(y1-y0)*t)/2)*2-width/2,width,width,color); }
    }
  }
  actor(who: Character, pose: ActorPose) {
    const c=this.ctx,p=palettes[who],l=limbs(pose,who),huaso=pose.costume==='huaso';
    const height=Math.max(0,pose.shadowY-pose.y-25); const shadowWidth=46-height*.16;
    this.rect(pose.x-shadowWidth/2-5,pose.shadowY+1,shadowWidth+10,2,'#53645b0b');
    this.rect(pose.x-shadowWidth/2,pose.shadowY,shadowWidth,4,'#53645b14');
    this.rect(pose.x-shadowWidth/2+7,pose.shadowY+1,shadowWidth-14,2,'#53645b13');
    c.save(); c.translate(Math.round(pose.x),Math.round(pose.y)); c.rotate(pose.rotation); c.scale(pose.facing*pose.scale,pose.scale);
    const limb=(points: Point[],front: boolean,foot=false) => {
      this.line(points,p.edge,6); this.line(points,front?p.body:p.dark,4);
      const [x,y]=points[points.length-1]; this.rect(x-3,y-2,foot?9:7,5,front?p.body:p.dark);
      if(front) this.rect(x-2,y-2,foot?6:4,2,p.light);
      if(foot&&huaso) { this.rect(x-3,y-8,6,9,front?'#40392f':'#302f2b'); this.rect(x-4,y-2,11,5,'#302f2b'); if(front)this.rect(x-2,y-7,2,5,'#69604c'); }
    };
    limb(l.rearLeg,false,true); if(!huaso)limb(l.rearArm,false);
    // Claude's four stalk legs preserve its pixel-crab silhouette in every view.
    if(who==='claude'&&pose.view!=='side') {
      const rear=l.rearLeg.map(([x,y])=>[x+7,y-2] as Point); const front=l.leg.map(([x,y])=>[x-6,y-2] as Point);
      limb(rear,false,true); limb(front,false,true);
    }
    limb(l.leg,true,true);
    if(this.sprites) { const column=(who==='codex'?4:0)+VIEWS.indexOf(pose.view); c.drawImage(this.sprites,column*64,0,64,72,-32,-44,64,72); }
    else for(const [x,y,w,h,color] of torsoPixels(who,pose.view)) this.rect(x,y,w,h,color);
    if(huaso) this.poncho(who,pose);
    this.face(who,pose.view,pose.expression);
    if(huaso) limb(l.rearArm,false);
    limb(l.arm,true);
    if(huaso) { this.hat(who,pose.view); this.handkerchief(l.arm[l.arm.length-1],pose.stride); }
    c.restore();
  }
  private poncho(who: Character,pose: ActorPose) {
    const side=pose.view==='side',back=pose.view==='back',width=side?15:who==='claude'?27:23;
    const wool=who==='claude'?'#aa5747':'#477f7c',shade=who==='claude'?'#763f37':'#315d5c';
    // Stepped shoulders and hem form a chamanto below the unchanged face.
    this.rect(-width,-5,width*2,8,shade); this.rect(-width+2,1,width*2-4,8,wool); this.rect(-width+5,9,width*2-10,6,wool);
    for(let x=-width+5;x<width-3;x+=8) { this.rect(x,-4,2,14,'#dfbd83'); this.rect(x+3,-4,1,14,shade); }
    this.rect(-width+5,10,width*2-10,2,'#dfbd83');
    for(let x=-width+6;x<width-5;x+=5)this.rect(x,14,2,3,'#bda77e');
    if(!back) { this.line([[-6,-5],[0,0],[6,-5]],'#e6d4a7',2); this.rect(-2,0,3,9,shade); }
  }
  private hat(who: Character,view: View) {
    const top=who==='claude'?-30:-36,width=view==='side'?20:who==='claude'?30:27;
    this.rect(-width+8,top-8,width*2-16,8,'#5a4230'); this.rect(-width+10,top-7,width*2-20,5,'#b89a6b');
    this.rect(-width+8,top-2,width*2-16,3,'#3c342b');
    this.rect(-width,top+1,width*2,3,'#46392c'); this.rect(-width+2,top,width*2-4,2,'#d0b889');
  }
  private handkerchief(hand: Point,stride: number) {
    const [x,y]=hand,flutter=Math.sin(stride*Math.PI*4)*2;
    // Its knot shares the actual articulated hand endpoint in every projection.
    this.rect(x+1,y-2,3,3,'#f7f5df');
    this.line([[x+3,y-2],[x+8,y-8+flutter],[x+14,y-5-flutter]],'#e1dfd0',2);
    this.rect(x+5,y-8+flutter,7,5,'#fffef1'); this.rect(x+9,y-5+flutter,7,5,'#fffef1');
    this.rect(x+13,y-1+flutter,3,3,'#e9e6d4');
  }
  private face(who: Character,view: View,expression: Expression) {
    if(view==='back') return;
    const p=palettes[who]; const side=view==='side'; const quarter=view==='threeQuarter';
    const eyes=side?[8]:who==='claude'?(quarter?[-12,1]:[-12,5]):(quarter?[-9,2]:[-8,6]);
    const y=who==='claude'?-14:-18; const color=who==='claude'?p.ink:p.glint;
    for(const x of eyes) {
      if(expression==='happy') { this.rect(x-1,y+2,3,2,color);this.rect(x+1,y,3,2,color); }
      else this.rect(x,y,who==='claude'?4:3,expression==='surprise'?7:6,color);
    }
    if(side) return;
    const mouth=quarter?-5:-2;
    if(expression==='surprise') this.rect(mouth,y+10,5,5,color);
    else if(who==='codex') this.rect(mouth,y+10,6,2,p.body);
  }
  character(who: Character,x: number,y=134,jump=0,tilt=0,face: Expression='smile') {
    this.actor(who,{x,y:y+24-jump,facing:1,rotation:tilt,view:'front',pose:'idle',stride:0,expression:face,shadowY:y+50,scale:1});
  }
  idle() { this.clear(); this.character('claude',84); this.character('codex',300); }
  sparkle(x: number,y: number,color='#c6a76b') { this.rect(x-1,y-5,2,10,color);this.rect(x-5,y-1,10,2,color); }
  label(text: string,x: number,y: number,color='#59746e') { const c=this.ctx;c.fillStyle=color;c.font='9px monospace';c.textAlign='center';c.fillText(text,x,y); }
}
