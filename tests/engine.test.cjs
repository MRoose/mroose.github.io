const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Simulation,TYPES,WAVES,PATH,stats,upgradeCost,CAPACITY}=require('../js/engine.js');
function tick(s,seconds){for(let i=0;i<seconds*60;i++){s.step(1/60);s.events.length=0;}}
function isolated(type){
  const s=new Simulation(1);s.cash=10000;const {tower}=s.build(type,100,220);assert.ok(tower);
  s.startWave();s.spawned=WAVES[0].count;
  const e=s.spawn(0,160);s.lane[e]=0;s.locate(e);s.previousX[e]=s.x[e];s.previousY[e]=s.y[e];s.hp[e]=s.maxHp[e]=10000;s.velocity[e]=0;s.rebuildGrid();return {s,tower,e};
}
test('Path is continuous, winding, and spans entrance to base',()=>{
  assert.ok(PATH.length>2400);assert.ok(PATH.x[0]<0);assert.ok(PATH.x.at(-1)>1120);
  for(let i=1;i<PATH.x.length;i++)assert.ok(Math.hypot(PATH.x[i]-PATH.x[i-1],PATH.y[i]-PATH.y[i-1])<2.1);
});
test('Economy: purchase, snap, blocked road, overlap, insufficient funds, and 70% sale',()=>{
  const s=new Simulation();assert.equal(s.cash,700);
  assert.ok(s.build(0,100,135).error);assert.equal(s.cash,700);
  const {tower}=s.build(0,103,221);assert.equal(tower.x,100);assert.equal(tower.y,220);assert.equal(s.cash,610);
  assert.ok(s.build(0,100,220).error);s.cash=0;assert.ok(s.build(4,380,340).error);assert.equal(s.towers.length,1);
  const refund=s.sell(tower.id);assert.equal(refund,63);assert.equal(s.cash,63);assert.equal(s.towers.length,0);assert.equal(s.sell(tower.id),0);
});
test('Each of 6 modules has exactly 3 paid upgrades; sale includes invested upgrades',()=>{
  for(let type=0;type<TYPES.length;type++){
    const {s,tower}=isolated(type);const original=stats(tower);let invested=TYPES[type].cost;
    for(let i=0;i<3;i++){const price=upgradeCost(tower),before=s.cash;assert.equal(s.upgrade(tower.id),true);assert.equal(s.cash,before-price);invested+=price;}
    assert.equal(tower.level,3);assert.ok(stats(tower).damage>original.damage);assert.ok(stats(tower).range>original.range);assert.ok(stats(tower).interval<original.interval);assert.equal(s.upgrade(tower.id),false);
    assert.equal(s.sell(tower.id),Math.floor(invested*7/10));
  }
});
test('An unaffordable upgrade never changes the level or balance',()=>{const {s,tower}=isolated(0);s.cash=0;assert.equal(s.upgrade(tower.id),false);assert.equal(tower.level,0);assert.equal(s.cash,0);});
for(let type=0;type<6;type++)test(`${TYPES[type].name} damages targets using its actual simulation`,()=>{
  const {s,e}=isolated(type);tick(s,2);assert.ok(s.hp[e]<10000,`type ${type} dealt no damage`);
  if(type===2){assert.ok(s.slowUntil[e]>s.time);assert.ok(s.slowFactor[e]<1);}
  if(type===5){assert.ok(s.poisonUntil[e]>s.time);assert.ok(s.poisonDamage[e]>0);}
});
test('Mortar and rockets damage multiple enemies per explosion',()=>{
  for(const type of [1,4]){const {s,e}=isolated(type),e2=s.spawn(0,162);s.velocity[e2]=0;s.lane[e2]=0;s.locate(e2);s.hp[e2]=s.maxHp[e2]=10000;tick(s,1);assert.ok(s.hp[e]<10000);assert.ok(s.hp[e2]<10000);}
});
test('Laser pierces clustered enemies; poison bypasses armor',()=>{
  const {s,e}=isolated(3),e2=s.spawn(2,160);s.velocity[e2]=0;s.lane[e2]=0;s.locate(e2);s.hp[e2]=s.maxHp[e2]=10000;tick(s,.2);assert.ok(s.hp[e]<10000&&s.hp[e2]<10000);
  const a=new Simulation(),id=a.spawn(2);a.hp[id]=100;a.damage(id,10);assert.ok(Math.abs(a.hp[id]-93.7)<.001);a.damage(id,10,true);assert.ok(Math.abs(a.hp[id]-83.7)<.001);
});
test('Killing awards money once and reuses slots with a new generation',()=>{
  const s=new Simulation(),e=s.spawn(0),before=s.cash,generation=s.generation[e];s.damage(e,Infinity);assert.equal(s.cash,before+5);assert.equal(s.kills,1);s.damage(e,Infinity);assert.equal(s.cash,before+5);const e2=s.spawn(0);assert.equal(e2,e);assert.ok(s.generation[e2]>generation);
});
test('A homing rocket does not lock onto a recycled target slot',()=>{
  const {s,tower,e}=isolated(4);s.fire(tower,stats(tower),e);const p=s.projectiles[0],tx=p.tx,ty=p.ty;s.damage(e,Infinity);const replacement=s.spawn(0,1200);assert.equal(replacement,e);tick(s,.01);assert.equal(p.tx,tx);assert.equal(p.ty,ty);
});
test('Wave 8 naturally creates more than 2000 simultaneous enemies',()=>{
  const s=new Simulation();s.wave=7;s.startWave();tick(s,6.2);assert.equal(s.spawned,2600);assert.ok(s.count>=2500);assert.ok(s.peak>2000);assert.equal(s.lives,30);
});
test('Simulation survives 3600 active enemies with all 6 tower types and bounded effects',()=>{
  const s=new Simulation();s.cash=100000;s.wave=9;s.startWave();
  for(let y=60;y<680;y+=80)for(let x=60;x<1080;x+=80){if(!s.canBuild(x,y)&&s.towers.length<36){const {tower}=s.build(s.towers.length%6,x,y);for(let i=0;i<3;i++)s.upgrade(tower.id);}}
  for(let i=0;i<3600;i++)s.spawn(i%4,60+i%1400);s.spawned=3600;
  tick(s,7);assert.ok(s.peak>=3600);assert.ok(s.towers.every(t=>t.level===3));assert.ok(s.count<CAPACITY);assert.ok(s.projectiles.length<=256);assert.ok(s.cash>=0);assert.ok(s.kills>0);assert.ok(Number.isFinite(s.time));
});
test('Final boss spawns only on wave 10 and must die before victory',()=>{
  const s=new Simulation();s.wave=9;s.startWave();tick(s,6.2);assert.ok(s.bossSpawned);const boss=s.bossId;assert.equal(s.kind[boss],4);assert.equal(s.maxHp[boss],180000);
  for(let i=s.count-1;i>=0;i--){const e=s.active[i];if(e!==boss)s.damage(e,Infinity);}
  tick(s,.1);assert.equal(s.state,'running');s.damage(boss,Infinity);assert.equal(s.bossId,-1);tick(s,.1);assert.equal(s.state,'won');assert.equal(s.startWave(),false);assert.ok(s.build(0,100,220).error);
});
test('Leak damages the base and defeat stops simulation; boss leak is fatal',()=>{
  for(const boss of [false,true]){const s=new Simulation();s.startWave();s.spawned=24;s.lives=boss?30:1;const e=s.spawn(boss?4:0,PATH.length-45.01);s.velocity[e]=200;tick(s,.1);assert.equal(s.lives,0);assert.equal(s.state,'lost');const time=s.time;tick(s,1);assert.equal(s.time,time);}
});
test('All ten wave transitions award bonuses and never start automatically',()=>{
  const s=new Simulation();for(let wave=1;wave<=10;wave++){
    assert.equal(s.startWave(),true);assert.equal(s.wave,wave);assert.equal(s.startWave(),false);s.spawned=WAVES[wave-1].count;s.bossSpawned=wave===10;const cash=s.cash;tick(s,.02);assert.equal(s.cash,cash+90+wave*35);assert.equal(s.state,wave===10?'won':'prep');const before=s.wave;tick(s,1);assert.equal(s.wave,before);
  }
});
