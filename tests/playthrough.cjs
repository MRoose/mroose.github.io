// Deterministic player: spends only earned credits, using ordinary build/upgrade calls.
const {Simulation,WAVES,PATH,upgradeCost}=require('../js/engine.js');
const assert=require('node:assert/strict');
const s=new Simulation(737);
for(const [type,x,y]of [[0,100,220],[0,220,220],[1,220,380],[2,260,380],[5,460,380]]){
  const result=s.build(type,x,y);assert.ok(result.tower,result.error);
}
const sites=[];
for(let y=60;y<680;y+=40)for(let x=60;x<1080;x+=40){
  if(s.canBuild(x,y))continue;let distance=Infinity,progress=0;
  for(let i=0;i<PATH.x.length;i+=12){const d=Math.hypot(x-PATH.x[i],y-PATH.y[i]);if(d<distance){distance=d;progress=i*2;}}
  if(distance<120)sites.push({x,y,progress,distance});
}
sites.sort((a,b)=>a.progress-b.progress);
function prepare(){
  for(let round=0;round<8;round++){
    const order=[...s.towers].sort((a,b)=>([3,0,2,4,1,0][b.type]-[3,0,2,4,1,0][a.type]));
    for(const t of order)if(t.level<3&&s.cash>=upgradeCost(t))s.upgrade(t.id);
    const cycle=[1,5,2,3,4,1,3,5];let added=false;
    for(let i=0;i<sites.length;i++){
      const p=sites[i],type=cycle[s.towers.length%cycle.length];
      if(!s.canBuild(p.x,p.y)){const result=s.build(type,p.x,p.y);if(result.tower){added=true;break;}}
    }
    if(!added)break;
  }
}
const summary=[];
for(let wave=1;wave<=10;wave++){
  if(wave>1)prepare();assert.ok(s.startWave());
  const before=s.kills;let steps=0,peak=0;
  while(s.state==='running'&&steps<60*240){s.step(1/60);s.events.length=0;peak=Math.max(peak,s.count);steps++;}
  summary.push({wave,towers:s.towers.length,lives:s.lives,kills:s.kills-before,peak,seconds:+(steps/60).toFixed(1),cash:s.cash,state:s.state});
  if(s.state==='lost')break;
  assert.equal(s.state,wave===10?'won':'prep',`Wave ${wave} timed out`);
}
console.table(summary);
assert.equal(s.state,'won','An ordinary funded strategy must be able to win all ten waves');
assert.ok(summary[8].peak>2000&&summary[9].peak>2000,'Late waves must retain 2000+ enemies even against a funded, upgraded defense');
