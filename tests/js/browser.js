/* Real browser integration + requestAnimationFrame benchmark. No third-party runner. */
'use strict';
const frame=document.getElementById('frame'),results=document.getElementById('results'),status=document.getElementById('status'),run=document.getElementById('run');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let report;
function check(name,condition){report.checks.push({name,passed:!!condition});if(!condition)throw new Error(name);results.textContent=JSON.stringify(report,null,2);}
function sample(duration,td){
  return new Promise(resolve=>{
    const frames=[],draws=[];let start=0,last=0,minimum=Infinity,windowStart=0,windowFrames=0;
    function next(t){
      if(!start){start=last=windowStart=t;requestAnimationFrame(next);return;}
      frames.push(t-last);draws.push(td.metrics.drawMs);last=t;windowFrames++;
      if(t-windowStart>=1000){minimum=Math.min(minimum,windowFrames*1000/(t-windowStart));windowFrames=0;windowStart=t;}
      if(t-start<duration){requestAnimationFrame(next);return;}
      const sorted=[...frames].sort((a,b)=>a-b),round=x=>Math.round(x*10)/10;
      resolve({speed:td.speed,enemies:td.sim.count,towers:td.sim.towers.length,samples:frames.length,seconds:round((t-start)/1000),averageFPS:round(frames.length*1000/(t-start)),minimumOneSecondFPS:round(minimum),p95FrameMs:round(sorted[Math.floor(sorted.length*.95)]),p99FrameMs:round(sorted[Math.floor(sorted.length*.99)]),averageDrawMs:round(draws.reduce((a,b)=>a+b,0)/draws.length)});
    }requestAnimationFrame(next);
  });
}
run.onclick=async()=>{
  run.disabled=true;report={date:new Date().toISOString(),userAgent:navigator.userAgent,viewport:[innerWidth,innerHeight],checks:[],benchmarks:[],errors:[],passed:false};
  const w=frame.contentWindow,d=frame.contentDocument,td=w.TD,E=w.TDEngine;
  w.addEventListener('error',e=>report.errors.push(e.message));w.addEventListener('unhandledrejection',e=>report.errors.push(String(e.reason)));
  const el=id=>d.getElementById(id),click=id=>el(id).click(),key=code=>d.dispatchEvent(new w.KeyboardEvent('keydown',{code,key:code==='Space'?' ':code,bubbles:true}));
  const mapClick=(x,y)=>{const r=el('game').getBoundingClientRect();el('game').dispatchEvent(new w.PointerEvent('pointerdown',{clientX:r.left+x/E.W*r.width,clientY:r.top+y/E.H*r.height,button:0,bubbles:true}));};
  try{
    td.reset();check('Initial HUD / 700 credits / 30 lives / 6 modules / 10 waves',el('money').textContent==='700'&&td.sim.lives===30&&d.querySelectorAll('.tower-card').length===6&&d.querySelectorAll('.wave-step').length===10);
    td.audio.unlock();await sleep(80);check('Procedural Web Audio starts after a user gesture',td.audio.context&&td.audio.context.state==='running');
    click('sound');check('Mute',td.audio.enabled===false);click('sound');check('Unmute',td.audio.enabled===true);click('sound');
    mapClick(100,134);check('Road cannot be built on',td.sim.towers.length===0&&td.sim.cash===700);
    mapClick(100,220);check('Map placement deducts credits',td.sim.towers.length===1&&td.sim.cash===610);
    mapClick(100,220);check('Selecting a placed tower opens its controls',!!el('upgrade')&&!!el('sell'));
    for(let i=0;i<3;i++)click('upgrade');check('Three upgrades reach level IV',td.sim.towers[0].level===3&&el('upgrade').disabled);
    click('sell');check('Sale refunds 70% of all investment',td.sim.towers.length===0&&td.sim.cash===581);
    d.querySelector('[data-type="4"]').click();mapClick(100,220);mapClick(180,220);check('Cannot build without enough credits',td.sim.towers.length===1&&td.sim.cash===271);
    key('Escape');check('Escape cancels construction',td.buildType===null);
    key('Digit3');check('Keyboard tower selection',td.buildType===2);
    click('next-wave');await sleep(180);check('Starting a wave and disabling duplicate start',td.sim.state==='running'&&td.sim.wave===1&&el('next-wave').disabled);
    key('Space');const time=td.sim.time;await sleep(180);check('Space pauses simulation',td.paused&&td.sim.time===time&&!el('pause-label').hidden);
    key('Space');await sleep(180);check('Space resumes simulation',!td.paused&&td.sim.time>time);
    for(const rate of [1,2,4]){d.querySelector(`[data-speed="${rate}"]`).click();check(`Speed ×${rate}`,td.speed===rate);}
    click('help');check('Help pauses and opens a dialog',td.paused&&!el('modal').hidden);click('close-modal');check('Closing help resumes previous state',!td.paused&&el('modal').hidden);
    click('restart');click('cancel-restart');check('Cancel restart preserves game',td.sim.wave===1);click('restart');click('confirm-restart');check('Confirmed restart resets game',td.sim.wave===0&&td.sim.cash===700&&td.speed===1&&!td.paused);
    class StressSimulation extends E.Simulation {
      step(dt){super.step(dt);for(let i=0;i<this.count;i++){const e=this.active[i];this.hp[e]=this.maxHp[e];if(this.progress[e]>E.PATH.length-170){this.progress[e]=60;this.locate(e);this.previousX[e]=this.x[e];this.previousY[e]=this.y[e];}}}
    }
    const maximumOnly=new URLSearchParams(location.search).has('maximum');
    const scenarios=maximumOnly?[{rate:4,count:3600,towers:96}]:[{rate:1,count:3000,towers:48},{rate:2,count:3000,towers:48},{rate:4,count:3000,towers:48},{rate:4,count:3600,towers:96}];
    for(const scenario of scenarios){
      const {rate,count,towers}=scenario;
      const s=new StressSimulation(711);s.cash=1000000;s.wave=9;s.startWave();s.spawned=3600;s.bossSpawned=true;
      // Place towers all along the path, not just at its entrance.
      const spots=[];for(let y=60;y<680;y+=40)for(let x=60;x<1080;x+=40)if(!s.canBuild(x,y)){let dist=Infinity;for(let i=0;i<E.PATH.x.length;i+=20)dist=Math.min(dist,Math.hypot(x-E.PATH.x[i],y-E.PATH.y[i]));if(dist<150)spots.push([x,y]);}
      for(let i=0;i<towers;i++){const at=Math.floor(i*spots.length/towers),p=spots[at],r=s.build(i%6,p[0],p[1]);if(r.tower)for(let k=0;k<3;k++)s.upgrade(r.tower.id);}
      for(let i=0;i<count;i++){const e=s.spawn(i%4,60+s.random()*(E.PATH.length-350));s.maxHp[e]=s.hp[e]=1000000;}
      s.rebuildGrid();td.loadScenario(s);td.setSpeed(rate);status.textContent=`Замер ×${rate}: ${count} движущихся врагов, ${s.towers.length} башен, яд, замедление и взрывы…`;
      await sleep(1800);check(`Stress ×${rate} has ${count} active enemies and ${towers} towers`,s.count===count&&s.towers.length===towers);
      const measured=await sample(8000,td);report.benchmarks.push(measured);check(`Stress ${count} / ${towers} / ×${rate} minimum one-second FPS ≥ 30`,measured.minimumOneSecondFPS>=30);check(`Stress ${count} / ${towers} / ×${rate} actual projectiles and status effects`,s.projectiles.length>0&&s.poisonUntil.some(t=>t>s.time)&&s.slowUntil.some(t=>t>s.time));
    }
    const defeat=new E.Simulation();defeat.startWave();defeat.spawned=24;defeat.lives=1;const e=defeat.spawn(0,E.PATH.length-45.1);defeat.velocity[e]=500;td.loadScenario(defeat);await sleep(200);check('Defeat screen is rendered',td.sim.state==='lost'&&!el('modal').hidden&&el('modal-title').textContent==='Рубеж пал.');
    click('play-again');check('Restart from defeat',td.sim.cash===700&&td.sim.state==='prep');
    const victory=new E.Simulation();victory.wave=9;victory.startWave();victory.spawned=3600;victory.bossSpawned=true;const boss=victory.spawn(4,500);victory.rebuildGrid();td.loadScenario(victory);await sleep(200);check('Boss HUD rendered',!el('boss-hud').hidden);victory.damage(boss,Infinity);await sleep(200);check('Victory screen is rendered only after final boss dies',td.sim.state==='won'&&!el('modal').hidden&&el('modal-title').textContent==='Рассвет за нами.');
    click('play-again');check('Restart from victory',td.sim.cash===700&&td.sim.wave===0);check('No JavaScript errors or unhandled rejections',report.errors.length===0);
    report.passed=true;status.textContent='PASS — интерфейс, звук, исходы и производительность проверены';
  }catch(error){report.errors.push(error.stack||String(error));status.textContent='FAIL — подробности ниже';}
  results.textContent=JSON.stringify(report,null,2);run.disabled=false;
};
