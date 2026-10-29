(function () {
  'use strict';
  const {Simulation,TYPES,WAVES,PATH,W,H,stats,upgradeCost}=window.TDEngine;
  const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d',{alpha:false});
  const fmt=n=>Math.floor(n).toLocaleString('ru-RU'),roman=['I','II','III','IV'];
  let sim=new Simulation(),buildType=0,selectedId=null,paused=false,speed=1,hover=null,last=performance.now(),accumulator=0,uiTimer=0,toastTimer=0,ended=false,modalPreviousFocus=null,modalWasPaused=false;
  const metrics={fps:60,frameTimes:[],drawMs:0,steps:0},fx=[],MAX_FX=560;
  let quality=1,frameCounter=0,frameElapsed=0;
  const audio={enabled:true,context:null,lastShot:0,
    unlock(){if(!this.enabled)return;try{if(!this.context)this.context=new (window.AudioContext||window.webkitAudioContext)();if(this.context.state==='suspended')this.context.resume().catch(()=>{});}catch(_){this.enabled=false;}},
    tone(frequency,duration=.08,type='sine',volume=.025,endFrequency=frequency){
      if(!this.enabled||!this.context||this.context.state!=='running')return;
      const c=this.context,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(frequency,t);o.frequency.exponentialRampToValueAtTime(Math.max(10,endFrequency),t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+duration);o.onended=()=>{o.disconnect();g.disconnect();};
    },
    play(type){
      if(type==='shot'||type==='launch'||type==='explosion'){
        const t=performance.now();if(t-this.lastShot<85)return;this.lastShot=t;
        if(type==='explosion')this.tone(90,.19,'triangle',.04,22);else this.tone(type==='shot'?240:150,.05,'triangle',.013,65);
      }else if(type==='build'){this.tone(480,.12,'sine',.035,880);}
      else if(type==='wave'||type==='boss'){this.tone(type==='boss'?110:260,.4,'sawtooth',.025,type==='boss'?55:520);}
      else if(type==='leak')this.tone(140,.2,'square',.018,60);
      else if(type==='clear')this.tone(520,.45,'sine',.03,1040);
      else if(type==='end')this.tone(sim.state==='won'?440:150,1.2,'triangle',.05,sim.state==='won'?880:38);
      else if(type==='sell')this.tone(700,.15,'sine',.025,350);
    }
  };
  function polygon(c,x,y,r,n,rotation=0){c.beginPath();for(let i=0;i<n;i++){const a=rotation+i*Math.PI*2/n;if(i)c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);else c.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}c.closePath();}
  function towerArt(c,x,y,type,level=0,angle=-Math.PI/2,scale=1){
    c.save();c.translate(x,y);c.scale(scale,scale);
    c.fillStyle='#09161180';c.beginPath();c.ellipse(2,7,22,15,0,0,Math.PI*2);c.fill();
    polygon(c,0,0,22,6,Math.PI/6);c.fillStyle='#25382d';c.fill();c.strokeStyle='#53654a';c.lineWidth=1;c.stroke();
    polygon(c,0,0,17,6,Math.PI/6);c.fillStyle='#18271e';c.fill();c.strokeStyle='#718960';c.stroke();
    c.strokeStyle=TYPES[type].color;c.fillStyle=TYPES[type].color;c.lineWidth=2;
    for(let i=0;i<=level;i++){c.beginPath();c.arc(-9+i*6,15,1.5,0,Math.PI*2);c.fill();}
    c.rotate(angle);
    if(type===0){c.fillStyle='#9cb179';c.fillRect(0,-5,26,3);c.fillRect(0,2,26,3);c.fillStyle='#445c3d';c.fillRect(16,-6,6,12);c.fillStyle=TYPES[type].color;c.fillRect(-8,-8,16,16);c.fillStyle='#5c7045';c.fillRect(-5,-5,10,10);}
    if(type===1){c.fillStyle='#665440';c.fillRect(-10,-11,20,22);c.fillStyle='#e8ad70';c.fillRect(-4,-8,24,16);c.fillStyle='#403a2e';c.fillRect(11,-6,9,12);c.strokeRect(11,-6,9,12);}
    if(type===2){c.rotate(-angle);polygon(c,0,0,12,6);c.fillStyle='#386168';c.fill();c.stroke();c.beginPath();c.arc(0,0,6,0,Math.PI*2);c.fillStyle='#b3edf0';c.fill();for(let a=0;a<6;a++){const q=a*Math.PI/3;c.beginPath();c.moveTo(Math.cos(q)*12,Math.sin(q)*12);c.lineTo(Math.cos(q)*18,Math.sin(q)*18);c.stroke();}}
    if(type===3){c.fillStyle='#765852';c.fillRect(-10,-9,18,18);c.fillStyle='#e1a092';c.fillRect(0,-4,24,8);c.strokeStyle='#ffe1bc';c.beginPath();c.moveTo(-7,0);c.lineTo(23,0);c.stroke();c.fillStyle='#ebd9a8';c.fillRect(21,-5,4,10);}
    if(type===4){c.fillStyle='#6c6177';c.fillRect(-12,-12,26,24);for(let i=-1;i<=1;i+=2){c.fillStyle='#d0b7e9';c.fillRect(-6,i*7-4,26,8);c.fillStyle='#463c54';c.fillRect(10,i*7-3,9,6);c.fillStyle='#f3d3ba';c.fillRect(-8,i*7-2,3,4);}}
    if(type===5){c.rotate(-angle);c.fillStyle='#475c35';c.fillRect(-12,-9,24,18);for(let a=-1;a<=1;a+=2){c.beginPath();c.arc(a*7,0,6,0,Math.PI*2);c.fillStyle='#accb70';c.fill();c.fillStyle='#4c6b37';c.beginPath();c.arc(a*7,0,3,0,Math.PI*2);c.fill();}c.rotate(angle);c.fillStyle='#bbdc86';c.fillRect(3,-3,19,6);}
    c.restore();
  }
  const terrain=document.createElement('canvas');terrain.width=W;terrain.height=H;
  function makeTerrain(){
    const c=terrain.getContext('2d');c.fillStyle='#18251f';c.fillRect(0,0,W,H);
    let seed=912;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const g=c.createRadialGradient(580,330,50,580,330,700);g.addColorStop(0,'#273523');g.addColorStop(1,'#111f1b');c.fillStyle=g;c.fillRect(0,0,W,H);
    c.lineWidth=.6;c.strokeStyle='#92b6820b';c.beginPath();for(let x=0;x<W;x+=40){c.moveTo(x,0);c.lineTo(x,H);}for(let y=0;y<H;y+=40){c.moveTo(0,y);c.lineTo(W,y);}c.stroke();
    for(let i=0;i<5400;i++){const x=rand()*W,y=rand()*H;c.fillStyle=rand()<.5?'#c6d19507':'#0000000b';c.fillRect(x,y,rand()*3+1,rand()*2+1);}
    for(const [cx,cy,r] of [[420,157,113],[355,650,104],[740,330,72],[1050,147,120],[50,577,96]]){
      for(let ring=0;ring<5;ring++){c.beginPath();for(let a=0;a<=80;a++){const q=a/80*Math.PI*2,rr=r+ring*13+Math.sin(q*3+ring*.2)*8+Math.cos(q*5)*4;const x=cx+Math.cos(q)*rr,y=cy+Math.sin(q)*rr*.64;if(a)c.lineTo(x,y);else c.moveTo(x,y);}c.strokeStyle='#95b47b0c';c.lineWidth=1;c.stroke();}
    }
    function nearRoad(x,y){for(let i=0;i<PATH.x.length;i+=12)if((x-PATH.x[i])**2+(y-PATH.y[i])**2<62**2)return true;return false;}
    for(let i=0;i<210;i++){
      const x=rand()*W,y=rand()*H;if(nearRoad(x,y))continue;
      const r=2+rand()*9;c.fillStyle='#0c19164b';c.beginPath();c.ellipse(x+2,y+3,r*1.4,r*.8,0,0,Math.PI*2);c.fill();polygon(c,x,y,r,5,rand()*3);c.fillStyle=rand()<.5?'#34442a':'#2b3b28';c.fill();c.strokeStyle='#52654338';c.stroke();
    }
    const trace=()=>{c.beginPath();PATH.raw.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));};
    c.lineJoin='round';c.lineCap='round';trace();c.strokeStyle='#080e0b55';c.lineWidth=75;c.stroke();trace();c.strokeStyle='#5e6e414a';c.lineWidth=65;c.stroke();trace();c.strokeStyle='#3a4731';c.lineWidth=61;c.stroke();trace();c.strokeStyle='#263027';c.lineWidth=54;c.stroke();
    trace();c.strokeStyle='#6f7b4933';c.lineWidth=1;c.setLineDash([6,13]);c.stroke();c.setLineDash([]);
    for(let i=25;i<PATH.x.length;i+=38){for(const s of [-1,1]){const x=PATH.x[i]+PATH.nx[i]*s*31,y=PATH.y[i]+PATH.ny[i]*s*31;c.fillStyle='#87945c80';c.beginPath();c.arc(x,y,1.3,0,Math.PI*2);c.fill();}}
    c.font='9px Consolas,monospace';c.fillStyle='#c99368';c.fillText('01 / ТОЧКА ВХОДА',32,76);c.strokeStyle='#b48657';c.lineWidth=2;c.beginPath();c.moveTo(22,108);c.lineTo(22,96);c.lineTo(43,96);c.moveTo(22,161);c.lineTo(22,173);c.lineTo(43,173);c.stroke();
    c.font='8px Consolas,monospace';c.fillStyle='#82916d77';c.fillText('ВЫСОТА 248 М',377,90);c.fillText('+ СЕКТОР СТРОИТЕЛЬСТВА',371,604);c.fillText('СЕВЕР ↑',1021,40);
    c.strokeStyle='#74886644';c.lineWidth=1;c.strokeRect(19,20,W-38,H-40);for(const [x,y] of [[19,20],[W-19,20],[19,H-20],[W-19,H-20]]){c.strokeStyle='#7c936988';c.beginPath();c.moveTo(x-4,y);c.lineTo(x+4,y);c.moveTo(x,y-4);c.lineTo(x,y+4);c.stroke();}
    c.fillStyle='#a3b783';c.fillText('БАЗА / ПОСЛЕДНИЙ РУБЕЖ',927,665);
  }
  makeTerrain();
  function drawBase(time){
    const x=1044,y=588;ctx.save();ctx.translate(x,y);ctx.strokeStyle='#b7e67c23';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(0,0,53,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(0,0,45,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;ctx.save();ctx.rotate(a);ctx.fillStyle='#455d37';ctx.fillRect(20,-6,27,12);ctx.fillStyle='#a6cf76';ctx.fillRect(41,-4,4,8);ctx.restore();}
    polygon(ctx,0,0,33,6,Math.PI/6);ctx.fillStyle='#273d2a';ctx.fill();ctx.strokeStyle='#7d9c60';ctx.lineWidth=2;ctx.stroke();polygon(ctx,0,0,23,6,Math.PI/6);ctx.fillStyle='#12251c';ctx.fill();ctx.strokeStyle='#c6f28c';ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle='#c6f28c';ctx.globalAlpha=.78+Math.sin(time*2)*.15;polygon(ctx,0,0,11,4,Math.PI/4);ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle='#c6f28c55';ctx.beginPath();ctx.arc(0,0,16,time*.3,time*.3+Math.PI*1.5);ctx.stroke();ctx.restore();
  }
  function drawEnemies(alpha){
    const colors=['#edba7c','#e1d39d','#c1a986','#d9a490'];
    for(let kind=0;kind<4;kind++){
      ctx.fillStyle=colors[kind];ctx.beginPath();
      for(let i=0;i<sim.count;i++){
        const e=sim.active[i];if(sim.kind[e]!==kind)continue;
        const x=sim.previousX[e]+(sim.x[e]-sim.previousX[e])*alpha,y=sim.previousY[e]+(sim.y[e]-sim.previousY[e])*alpha;
        const r=kind===2?5:kind===3?4.5:3.2;
        if(kind===1){ctx.moveTo(x+4,y);ctx.lineTo(x-2,y-3);ctx.lineTo(x-2,y+3);ctx.closePath();}
        else if(kind===2){ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath();}
        else ctx.rect(x-r,y-r,r*2,r*2);
      }ctx.fill();
    }
    // Status markers are batched: no per-enemy shadow, save/restore, text or DOM node.
    for(let status=0;status<2;status++){
      ctx.fillStyle=status?'#85e0ed':'#b4f17b';ctx.beginPath();
      for(let i=0;i<sim.count;i++){const e=sim.active[i];if(sim.kind[e]===4)continue;if((status?sim.slowUntil[e]:sim.poisonUntil[e])<=sim.time)continue;ctx.rect(sim.x[e]-2,sim.y[e]-2,4,4);}ctx.fill();
    }
    if(sim.bossId>=0&&sim.alive[sim.bossId]){
      const e=sim.bossId,x=sim.x[e],y=sim.y[e];ctx.save();ctx.translate(x,y);
      ctx.fillStyle='#090f0baa';ctx.beginPath();ctx.ellipse(4,9,36,23,0,0,Math.PI*2);ctx.fill();
      ctx.rotate(-.1);polygon(ctx,0,0,33,6,0);ctx.fillStyle='#654e3a';ctx.fill();ctx.strokeStyle='#f5b475';ctx.lineWidth=3;ctx.stroke();polygon(ctx,0,0,22,6,0);ctx.fillStyle='#302d25';ctx.fill();ctx.strokeStyle='#aa7850';ctx.lineWidth=1;ctx.stroke();polygon(ctx,0,0,12,4,Math.PI/4);ctx.fillStyle='#f1aa6c';ctx.fill();
      ctx.restore();ctx.fillStyle='#302923';ctx.fillRect(x-30,y-45,60,4);ctx.fillStyle='#f3ab70';ctx.fillRect(x-30,y-45,60*Math.max(0,sim.hp[e]/sim.maxHp[e]),4);
    }
  }
  function addFx(p){if(fx.length<MAX_FX)fx.push(p);}
  function processEvents(){
    for(const e of sim.events){
      audio.play(e.type);
      if(e.type==='shot')addFx({...e,life:.075,max:.075});
      if(['explosion','frost','toxin','build','sell','bossKill'].includes(e.type)){
        const frost=e.type==='frost',toxin=e.type==='toxin';
        addFx({type:'ring',x:e.x,y:e.y,r:e.r||(e.type==='bossKill'?170:38),color:e.color||'#c6f28c',life:frost?.35:toxin?.5:.4,max:frost?.35:toxin?.5:.4,fill:toxin});
      }
      if(['explosion','kill','build','bossKill'].includes(e.type)){
        const n=e.type==='bossKill'?65:e.type==='explosion'?9:e.type==='build'?12:3;
        for(let i=0;i<n*quality;i++){const a=Math.random()*Math.PI*2,v=15+Math.random()*(e.type==='bossKill'?260:100);addFx({type:'particle',x:e.x,y:e.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,color:e.color||'#c6f28c',life:.2+Math.random()*.4,max:.6});}
      }
      if(e.type==='leak')addFx({type:'ring',x:e.x,y:e.y,r:65,color:'#f27f73',life:.45,max:.45});
      if(e.type==='clear')toast(`Волна ${sim.wave} отражена. Бонус +${90+sim.wave*35} ⬡`);
      if(e.type==='boss')toast('ТИТАН В СЕКТОРЕ. Лазеры наносят ему тройной урон.');
      if(e.type==='end')ended=true;
    }sim.events.length=0;
  }
  function drawFx(dt){
    for(let i=fx.length-1;i>=0;i--){
      const f=fx[i];if(!paused)f.life-=dt*speed;
      if(f.life<=0){fx[i]=fx[fx.length-1];fx.pop();continue;}
      const a=Math.min(1,f.life/f.max);ctx.globalAlpha=a;
      if(f.type==='shot'){ctx.strokeStyle=f.color;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.tx,f.ty);ctx.stroke();}
      else if(f.type==='ring'){ctx.strokeStyle=f.color;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(f.x,f.y,Math.max(1,f.r*(1-a*.8)),0,Math.PI*2);if(f.fill){ctx.globalAlpha=a*.11;ctx.fillStyle=f.color;ctx.fill();ctx.globalAlpha=a*.6;}ctx.stroke();}
      else{if(!paused){f.x+=f.vx*dt*speed;f.y+=f.vy*dt*speed;}ctx.fillStyle=f.color;ctx.fillRect(f.x,f.y,2,2);}
    }ctx.globalAlpha=1;
  }
  function draw(dt,alpha,now){
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.drawImage(terrain,0,0);drawBase(now/1000);
    const selected=sim.towers.find(t=>t.id===selectedId);
    if(selected){const r=stats(selected).range;ctx.fillStyle=TYPES[selected.type].color+'0b';ctx.strokeStyle=TYPES[selected.type].color+'66';ctx.lineWidth=1;ctx.beginPath();ctx.arc(selected.x,selected.y,r,0,Math.PI*2);ctx.fill();ctx.setLineDash([5,7]);ctx.stroke();ctx.setLineDash([]);}
    if(sim.towers.length===0&&!hover){
      for(const [x,y]of [[220,220],[460,380],[740,260]]){ctx.strokeStyle='#bad68d55';ctx.fillStyle='#bddb8f0a';polygon(ctx,x,y,23,6,Math.PI/6);ctx.fill();ctx.stroke();ctx.strokeStyle='#bad68d88';ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);ctx.moveTo(x,y-5);ctx.lineTo(x,y+5);ctx.stroke();}
      ctx.fillStyle='#bed39899';ctx.font='9px Consolas,monospace';ctx.fillText('РАЗМЕСТИТЕ ПЕРВУЮ БАШНЮ',327,362);
    }
    drawEnemies(alpha);
    for(const t of sim.towers){
      towerArt(ctx,t.x,t.y,t.type,t.level,t.angle);
      if(t.type===3&&t.beamUntil>sim.time&&sim.state==='running'){
        ctx.strokeStyle='#ef9d8780';ctx.lineWidth=5+t.level;ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(t.beamX,t.beamY);ctx.stroke();ctx.strokeStyle='#ffe8d0';ctx.lineWidth=1.3;ctx.stroke();
      }
      if(t.id===selectedId){ctx.strokeStyle='#d4f59b';ctx.lineWidth=1;polygon(ctx,t.x,t.y,29,6,Math.PI/6);ctx.stroke();}
    }
    for(const p of sim.projectiles){
      ctx.strokeStyle=TYPES[p.type].color;ctx.fillStyle=TYPES[p.type].color;ctx.lineWidth=p.type===4?3:4;const a=Math.atan2(p.ty-p.y,p.tx-p.x);ctx.beginPath();ctx.moveTo(p.x-Math.cos(a)*11,p.y-Math.sin(a)*11);ctx.lineTo(p.x,p.y);ctx.stroke();
      if(p.type===4){ctx.strokeStyle='#f7b97588';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x-Math.cos(a)*11,p.y-Math.sin(a)*11);ctx.lineTo(p.x-Math.cos(a)*20,p.y-Math.sin(a)*20);ctx.stroke();}
    }
    drawFx(dt);
    if(hover&&buildType!==null&&sim.state!=='won'&&sim.state!=='lost'){
      const x=Math.floor(hover.x/40)*40+20,y=Math.floor(hover.y/40)*40+20,valid=!sim.canBuild(x,y)&&sim.cash>=TYPES[buildType].cost,color=valid?'#c6f28c':'#f27f73',r=TYPES[buildType].range;
      ctx.fillStyle=color+'0d';ctx.strokeStyle=color+'77';ctx.lineWidth=1;ctx.setLineDash([4,6]);ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle=color;ctx.strokeRect(x-19,y-19,38,38);ctx.globalAlpha=.7;towerArt(ctx,x,y,buildType);ctx.globalAlpha=1;
    }
    if(paused){ctx.fillStyle='#0d181635';ctx.fillRect(0,0,W,H);}
  }
  function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,1.6);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);}
  new ResizeObserver(resize).observe(canvas);
  function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3000);}
  function makeCards(){
    $('tower-cards').innerHTML=TYPES.map((t,i)=>`<button class="tower-card${i===buildType?' selected':''}" data-type="${i}" aria-label="${t.name}, ${t.cost} кредитов" aria-pressed="${i===buildType}"><canvas width="100" height="82" aria-hidden="true"></canvas><span class="card-key">0${i+1}</span><span class="card-name">${t.name}</span><span class="card-bottom"><span class="card-tag">${['ОГОНЬ','СПЛЭШ','КОНТРОЛЬ','ЛУЧ','ВЗРЫВ','ЯД'][i]}</span><span class="card-price">⬡ ${t.cost}</span></span></button>`).join('');
    document.querySelectorAll('.tower-card').forEach((el,i)=>{const c=el.querySelector('canvas').getContext('2d');towerArt(c,46,40,i,0,-Math.PI/4,1.45);el.addEventListener('click',()=>selectType(i));});
    $('wave-timeline').innerHTML=WAVES.map((w,i)=>`<div class="wave-step${i===9?' boss':''}" title="${w.name}: ${w.note}">${i===9?'◈':String(i+1).padStart(2,'0')}</div>`).join('');
  }
  function selectType(type){audio.unlock();buildType=type;selectedId=null;refreshSelection();refreshUI();}
  function refreshSelection(){
    const t=sim.towers.find(t=>t.id===selectedId),type=t?t.type:buildType;
    document.querySelectorAll('.tower-card').forEach((el,i)=>{el.classList.toggle('selected',i===buildType);el.setAttribute('aria-pressed',String(i===buildType));});
    if(type===null||type===undefined){$('selection').innerHTML='<div class="selection-title"><h3>Контроль сектора</h3><span class="level">◈</span></div><p>Выберите установленную башню, чтобы улучшить или продать её. Или выберите новый модуль в арсенале.</p><div class="build-tip">⌖ Нажмите на башню на карте</div>';return;}
    const info=TYPES[type],s=stats(t||{type,level:0});
    $('selection').innerHTML=`<div class="selection-title"><h3>${info.name}</h3><span class="level">${t?'УРОВЕНЬ '+roman[t.level]:'МОДУЛЬ 0'+(type+1)}</span></div><p>${info.description}</p><div class="stats"><div><span>УРОН</span>${Number(s.damage.toFixed(1))}${type===5?'/с':''}</div><div><span>РАДИУС</span>${s.range}</div><div><span>ТЕМП</span>${(1/s.interval).toFixed(1)}/с</div></div>${t?`<div class="selection-actions"><button id="upgrade" ${t.level===3||sim.cash<upgradeCost(t)?'disabled':''}>${t.level===3?'МАКС. УРОВЕНЬ':`↑ ${roman[t.level+1]} · ⬡ ${upgradeCost(t)}`}</button><button id="sell">Продать · ${Math.floor(t.spent*7/10)}</button></div><div class="build-tip">Улучшения: ${t.level}/3 ${t.level<3?'· урон, дальность и темп ↑':''}</div>`:'<div class="build-tip">⌖ Нажмите на свободный участок карты</div>'}`;
    if(t){$('upgrade').addEventListener('click',upgradeSelected);$('sell').addEventListener('click',sellSelected);}
  }
  function upgradeSelected(){audio.unlock();const t=sim.towers.find(t=>t.id===selectedId);if(!t)return;if(sim.upgrade(selectedId)){refreshSelection();refreshUI();}else toast(t.level===3?'Башня уже улучшена полностью':'Недостаточно кредитов для улучшения');}
  function sellSelected(){audio.unlock();if(selectedId===null)return;const refund=sim.sell(selectedId);if(refund){selectedId=null;refreshSelection();refreshUI();toast(`Башня продана. Возвращено ${refund} ⬡`);}}
  function refreshUI(){
    $('money').textContent=fmt(sim.cash);$('lives').textContent=sim.lives;$('life-bar').style.width=sim.lives/30*100+'%';$('wave').textContent=String(sim.wave).padStart(2,'0');$('enemies').textContent=fmt(sim.count);$('fps').textContent=Math.round(metrics.fps);
    $('wave-label').textContent=sim.state==='running'?'АТАКА':sim.state==='won'?'ПОБЕДА':sim.state==='lost'?'БАЗА ПОТЕРЯНА':'ПОДГОТОВКА';
    const next=Math.min(sim.wave,9),wave=WAVES[next];$('next-number').textContent=String(next+1).padStart(2,'0')+' / 10';$('next-title').textContent=wave.name;$('next-description').textContent=wave.note;$('threat-bar').style.width=(next+1)*10+'%';
    $('next-wave').disabled=sim.state!=='prep';$('next-text').textContent=sim.state==='running'?`ВОЛНА ${String(sim.wave).padStart(2,'0')} · В БОЮ`:sim.state==='won'?'ОПЕРАЦИЯ ЗАВЕРШЕНА':sim.state==='lost'?'БАЗА ПОТЕРЯНА':`НАЧАТЬ ВОЛНУ ${String(next+1).padStart(2,'0')}`;
    $('wave-help').textContent=sim.state==='running'?`Выведено ${fmt(sim.spawned)} из ${fmt(WAVES[sim.wave-1].count)} · можно строить в бою`:'Постройте башни перед наступлением';
    document.querySelectorAll('.wave-step').forEach((el,i)=>{el.classList.toggle('done',i<sim.wave-(sim.state==='running'||sim.state==='lost'?1:0));el.classList.toggle('current',i===(sim.state==='running'||sim.state==='lost'?sim.wave-1:sim.wave)&&sim.state!=='won');});
    document.querySelectorAll('.tower-card').forEach((el,i)=>el.classList.toggle('unaffordable',sim.cash<TYPES[i].cost));
    const t=sim.towers.find(t=>t.id===selectedId);if(t&&$('upgrade'))$('upgrade').disabled=t.level>=3||sim.cash<upgradeCost(t);
    const boss=sim.bossId>=0&&sim.alive[sim.bossId]&&sim.kind[sim.bossId]===4;$('boss-hud').hidden=!boss;
    if(boss){const percent=Math.max(0,sim.hp[sim.bossId]/sim.maxHp[sim.bossId])*100;$('boss-percent').textContent=Math.ceil(percent)+'%';$('boss-bar').style.width=percent+'%';}
  }
  function setPause(value){paused=value;accumulator=0;$('pause-label').hidden=!paused;$('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Продолжить':'Пауза');$('pause').classList.toggle('active',paused);}
  function setSpeed(value){speed=value;document.querySelectorAll('.speed').forEach(el=>{el.classList.toggle('active',Number(el.dataset.speed)===speed);el.setAttribute('aria-pressed',String(Number(el.dataset.speed)===speed));});}
  function showModal(html){modalPreviousFocus=document.activeElement;modalWasPaused=paused;setPause(true);$('modal-content').innerHTML=html;$('modal').hidden=false;const button=$('modal').querySelector('button');if(button)button.focus();}
  function closeModal(){const resume=modalWasPaused;$('modal').hidden=true;setPause(resume);if(modalPreviousFocus&&modalPreviousFocus.isConnected)modalPreviousFocus.focus();}
  function showHelp(){
    showModal('<div class="eyebrow">ПОЛЕВОЕ РУКОВОДСТВО / 01</div><h2 id="modal-title">Удержать любой ценой.</h2><p>Враг идёт по руслу к базе. Переживите 10 волн и уничтожьте Титана. За каждого пропущенного врага база теряет жизнь; Титан уничтожает её сразу.</p><div class="help-grid"><div><strong>01 / Строительство</strong>Выберите модуль или клавишу 1–6. Нажмите на участок вне дороги. Escape отменяет выбор.</div><div><strong>02 / Улучшения</strong>Выберите башню на карте. Три улучшения увеличивают урон, радиус и темп. U — улучшить.</div><div><strong>03 / Экономика</strong>За уничтожение врагов и конец волны — кредиты. Продажа возвращает 70% вложений. X — продать.</div><div><strong>04 / Тактика</strong>Крио задерживает рой, мортира и яд поражают толпу. Лазер пробивает броню и особенно силён против босса.</div></div><p>Пробел — пауза · N — следующая волна · F — сменить скорость · M — звук. Строительство и улучшения доступны даже на паузе. Звук синтезируется после первого нажатия.</p><button id="close-modal" class="primary-button"><span>К ОБОРОНЕ</span><span>↗</span></button>');$('close-modal').onclick=closeModal;
  }
  function reset(){sim=new Simulation();buildType=0;selectedId=null;hover=null;ended=false;fx.length=0;accumulator=0;setPause(false);setSpeed(1);$('modal').hidden=true;refreshSelection();refreshUI();}
  function showResult(){
    const won=sim.state==='won';
    showModal(`<div class="result-symbol${won?'':' loss'}">${won?'◈':'◇'}</div><div class="eyebrow">ОПЕРАЦИЯ ${won?'ЗАВЕРШЕНА':'ПРЕРВАНА'}</div><h2 id="modal-title">${won?'Рассвет за нами.':'Рубеж пал.'}</h2><p>${won?'Титан уничтожен. Все десять волн отражены. База продолжает передавать сигнал.':'Сигнал базы потерян. Попробуйте сочетать замедление с уроном по площади и улучшать башни в узких местах дороги.'}</p><div class="result-stats"><div><strong>${sim.wave}/10</strong><span>ВОЛН</span></div><div><strong>${fmt(sim.kills)}</strong><span>УНИЧТОЖЕНО</span></div><div><strong>${Math.floor(sim.time/60)}:${String(Math.floor(sim.time%60)).padStart(2,'0')}</strong><span>ВРЕМЯ ОБОРОНЫ</span></div></div><button id="play-again" class="primary-button"><span>НОВАЯ ОПЕРАЦИЯ</span><span>↗</span></button>`);$('play-again').onclick=reset;
  }
  function pointerPosition(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H};}
  canvas.addEventListener('pointermove',e=>{hover=pointerPosition(e);});canvas.addEventListener('pointerleave',()=>hover=null);
  canvas.addEventListener('contextmenu',e=>{e.preventDefault();buildType=null;selectedId=null;refreshSelection();});
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||sim.state==='won'||sim.state==='lost')return;audio.unlock();const p=pointerPosition(e);hover=p;
    const t=sim.towers.find(t=>Math.hypot(t.x-p.x,t.y-p.y)<26);
    if(t){selectedId=t.id;buildType=null;refreshSelection();refreshUI();return;}
    if(buildType!==null){const result=sim.build(buildType,p.x,p.y);if(result.error)toast(result.error);else toast(`${TYPES[buildType].name} установлен · ${TYPES[buildType].cost} ⬡`);refreshUI();}
    else{selectedId=null;refreshSelection();}
  });
  $('next-wave').onclick=()=>{audio.unlock();if(sim.startWave()){refreshUI();toast(`Волна ${sim.wave}: ${WAVES[sim.wave-1].name}`);}};
  $('pause').onclick=()=>{audio.unlock();setPause(!paused);};document.querySelectorAll('.speed').forEach(el=>el.onclick=()=>setSpeed(Number(el.dataset.speed)));
  $('sound').onclick=()=>{audio.enabled=!audio.enabled;if(audio.enabled)audio.unlock();$('sound').textContent=audio.enabled?'♫':'♪̸';$('sound').setAttribute('aria-label',audio.enabled?'Выключить звук':'Включить звук');$('sound').style.color=audio.enabled?'':'#536850';};
  $('help').onclick=showHelp;$('restart').onclick=()=>{
    showModal('<div class="eyebrow">ПЕРЕЗАПУСК ПРОТОКОЛА</div><h2 id="modal-title">Новая операция?</h2><p>Текущая оборона будет завершена. Вы начнёте с первой волны и 700 кредитами.</p><button id="confirm-restart" class="primary-button"><span>НАЧАТЬ ЗАНОВО</span><span>↗</span></button><button id="cancel-restart" class="secondary-button">Продолжить оборону</button>');$('confirm-restart').onclick=reset;$('cancel-restart').onclick=closeModal;
  };
  document.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(!$('modal').hidden){
      if(e.key==='Escape'&&!ended){e.preventDefault();closeModal();}
      if(e.key==='Tab'){const buttons=[...$('modal').querySelectorAll('button')];if(buttons.length){e.preventDefault();const i=buttons.indexOf(document.activeElement);buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}}return;
    }
    // Native buttons already handle Space/Enter when focused; do not activate twice.
    if(e.code==='Space'){e.preventDefault();setPause(!paused);return;}
    if(e.code.startsWith('Digit')&&Number(e.code.slice(5))>=1&&Number(e.code.slice(5))<=6)selectType(Number(e.code.slice(5))-1);
    if(e.key==='Escape'){buildType=null;selectedId=null;refreshSelection();}
    if(e.code==='KeyU')upgradeSelected();if(e.code==='KeyX')sellSelected();if(e.code==='KeyM')$('sound').click();if(e.code==='KeyH')showHelp();if(e.code==='KeyN'&&!$('next-wave').disabled)$('next-wave').click();if(e.code==='KeyF')setSpeed(speed===4?1:speed*2);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&sim.state==='running'){setPause(true);toast('Оборона приостановлена, пока вкладка скрыта');}last=performance.now();});
  function frame(now){
    const rawDt=Math.max(0,(now-last)/1000),dt=Math.min(rawDt,.1);last=now;frameElapsed+=rawDt;frameCounter++;
    if(frameElapsed>=.5){metrics.fps=frameCounter/frameElapsed;frameCounter=0;frameElapsed=0;quality=metrics.fps<40?.45:1;}
    metrics.frameTimes.push(rawDt*1000);if(metrics.frameTimes.length>1800)metrics.frameTimes.shift();
    let steps=0;
    if(!paused&&!document.hidden){accumulator+=dt*speed;while(accumulator>=1/60&&steps<24){sim.step(1/60);accumulator-=1/60;steps++;}}else accumulator=0;
    metrics.steps=steps;processEvents();const start=performance.now();draw(dt,paused||sim.state!=='running'?1:accumulator*60,now);metrics.drawMs=performance.now()-start;
    uiTimer+=dt;if(uiTimer>=.15){uiTimer=0;refreshUI();}
    if(ended&&$('modal').hidden)showResult();requestAnimationFrame(frame);
  }
  makeCards();refreshSelection();refreshUI();requestAnimationFrame(frame);
  // Readable diagnostics for the included local QA page; no network, dependency or cheat UI.
  window.TD={get sim(){return sim;},get paused(){return paused;},get speed(){return speed;},get buildType(){return buildType;},metrics,audio,reset,setSpeed,setPause,refreshUI,
    loadScenario(s){sim=s;buildType=null;selectedId=null;ended=false;fx.length=0;accumulator=0;last=performance.now();$('modal').hidden=true;setPause(false);refreshSelection();refreshUI();}};
})();
