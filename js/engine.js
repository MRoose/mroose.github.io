/* Deterministic, DOM-free simulation. The same engine runs in the browser and tests. */
(function (root) {
  'use strict';
  const W = 1120, H = 720, CELL = 64, GRID_W = Math.ceil(W / CELL), GRID_H = Math.ceil(H / CELL), CAPACITY = 16384;
  const TYPES = [
    { name: 'Пулемёт', tag: 'СКОРОСТРЕЛЬНОСТЬ', color: '#d0ef94', cost: 90, range: 153, damage: 9, interval: .13, description: 'Быстрый прицельный огонь. Надёжно отсекает одиночные цели.', mechanic: '9 урона / выстрел' },
    { name: 'Мортира', tag: 'УРОН ПО ПЛОЩАДИ', color: '#f4b878', cost: 170, range: 182, damage: 27, interval: 1.15, radius: 49, description: 'Навесные снаряды взрываются в толпе. Чем плотнее рой, тем выше урон.', mechanic: 'Взрыв в радиусе 49' },
    { name: 'Крио', tag: 'ЗАМЕДЛЕНИЕ', color: '#8dd9e5', cost: 120, range: 140, damage: 2, interval: .65, description: 'Импульс замедляет всех врагов в радиусе на 48%. Даёт время остальным башням.', mechanic: '−48% скорости / 1,1 с' },
    { name: 'Лазер', tag: 'ПРОБИТИЕ', color: '#f19b92', cost: 240, range: 205, damage: 12, interval: .18, description: 'Луч прошивает линию целей и игнорирует броню. Наносит тройной урон боссу.', mechanic: 'Сквозной луч · до 64 целей' },
    { name: 'Ракеты', tag: 'САМОНАВЕДЕНИЕ', color: '#d5b8f5', cost: 310, range: 258, damage: 85, interval: 1.65, radius: 73, description: 'Самонаводящиеся ракеты с большим радиусом взрыва. Приоритет — ближайший к базе.', mechanic: 'Взрыв в радиусе 73' },
    { name: 'Токсин', tag: 'ПЕРИОДИЧЕСКИЙ УРОН', color: '#b2d879', cost: 190, range: 169, damage: 9, interval: .85, radius: 46, description: 'Заражает область на 4 секунды. Яд игнорирует броню; повторный удар обновляет эффект.', mechanic: '9 урона / с · 4 секунды' }
  ];
  const WAVES = [
    { name: 'Первый контакт', count: 24, rate: 3, note: '24 разведчика · базовая броня' },
    { name: 'Быстрее ветра', count: 65, rate: 7, note: '65 целей · быстрые бегуны' },
    { name: 'Броневой кулак', count: 140, rate: 15, note: '140 целей · тяжёлая броня' },
    { name: 'Сигнал тревоги', count: 280, rate: 30, note: '280 целей · смешанный отряд' },
    { name: 'Прилив', count: 520, rate: 60, note: '520 целей · плотные группы' },
    { name: 'Линия разлома', count: 900, rate: 110, note: '900 целей · усиленная броня' },
    { name: 'Нулевой горизонт', count: 1500, rate: 200, note: '1 500 целей · элитный авангард' },
    { name: 'Рой', count: 2600, rate: 430, note: '2 600 целей · массовое вторжение' },
    { name: 'Перед бурей', count: 3200, rate: 540, note: '3 200 целей · предельная угроза' },
    { name: 'Последний рассвет', count: 3600, rate: 600, note: '3 600 целей + финальный босс' }
  ];
  const POINTS = [[-45,134],[100,134],[230,134],[287,207],[287,267],[186,326],[155,392],[205,468],[340,490],[470,490],[565,416],[565,302],[580,222],[668,167],[801,167],[899,235],[912,332],[853,410],[789,457],[790,533],[866,588],[1015,588],[1160,588]];
  function createPath() {
    const raw = [];
    for (let i = 0; i < POINTS.length - 1; i++) {
      const a = POINTS[Math.max(0,i-1)], b = POINTS[i], c = POINTS[i+1], d = POINTS[Math.min(POINTS.length-1,i+2)];
      for (let j = 0; j < 24; j++) {
        const t=j/24,t2=t*t,t3=t2*t;
        raw.push([.5*((2*b[0])+(-a[0]+c[0])*t+(2*a[0]-5*b[0]+4*c[0]-d[0])*t2+(-a[0]+3*b[0]-3*c[0]+d[0])*t3),.5*((2*b[1])+(-a[1]+c[1])*t+(2*a[1]-5*b[1]+4*c[1]-d[1])*t2+(-a[1]+3*b[1]-3*c[1]+d[1])*t3)]);
      }
    }
    raw.push(POINTS[POINTS.length-1]);
    let length=0; const distances=[0];
    for(let i=1;i<raw.length;i++){length+=Math.hypot(raw[i][0]-raw[i-1][0],raw[i][1]-raw[i-1][1]);distances.push(length);}
    const n=Math.ceil(length/2)+1,x=new Float32Array(n),y=new Float32Array(n),nx=new Float32Array(n),ny=new Float32Array(n);
    let j=1;
    for(let i=0;i<n;i++){
      const p=Math.min(length,i*2);while(j<raw.length-1&&distances[j]<p)j++;
      const f=(p-distances[j-1])/(distances[j]-distances[j-1]);
      x[i]=raw[j-1][0]+(raw[j][0]-raw[j-1][0])*f;y[i]=raw[j-1][1]+(raw[j][1]-raw[j-1][1])*f;
      const dx=raw[j][0]-raw[j-1][0],dy=raw[j][1]-raw[j-1][1],len=Math.hypot(dx,dy)||1;nx[i]=-dy/len;ny[i]=dx/len;
    }
    return { x,y,nx,ny,length,raw };
  }
  const PATH=createPath();
  const upgradeCost=t=>Math.round(TYPES[t.type].cost*[.8,1.1,1.5][t.level]);
  const stats=t=>({range:TYPES[t.type].range+t.level*15,damage:TYPES[t.type].damage*(1+t.level*.85),interval:TYPES[t.type].interval/(1+t.level*.16),radius:(TYPES[t.type].radius||0)+t.level*7});
  class Simulation {
    constructor(seed=737) {
      this.seed=seed;this.cash=700;this.lives=30;this.wave=0;this.state='prep';this.time=0;this.waveTime=0;this.kills=0;this.leaked=0;this.earned=0;
      this.count=0;this.nextId=0;this.free=[];this.towers=[];this.projectiles=[];this.events=[];this.serial=0;this.spawned=0;this.spawnBudget=0;this.bossId=-1;this.bossSpawned=false;this.peak=0;
      this.active=new Int32Array(CAPACITY);this.slot=new Int32Array(CAPACITY);this.alive=new Uint8Array(CAPACITY);this.kind=new Uint8Array(CAPACITY);this.generation=new Uint32Array(CAPACITY);this.next=new Int32Array(CAPACITY);this.head=new Int32Array(GRID_W*GRID_H);
      for(const key of ['x','y','previousX','previousY','hp','maxHp','progress','lane','velocity','slowUntil','slowFactor','poisonUntil','poisonDamage'])this[key]=new Float32Array(CAPACITY);
      this.head.fill(-1);
    }
    random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
    event(type,data={}){if(this.events.length<256)this.events.push({type,...data});}
    canBuild(x,y){
      if(x<50||y<55||x>W-50||y>H-55)return 'За границей строительного сектора';
      for(let i=0;i<PATH.x.length;i+=5)if((x-PATH.x[i])**2+(y-PATH.y[i])**2<51**2)return 'Дорога должна оставаться свободной';
      for(const t of this.towers)if((x-t.x)**2+(y-t.y)**2<38**2)return 'Здесь уже стоит башня';
      if(this.towers.length>=96)return 'Лимит сектора: 96 башен';
      return '';
    }
    build(type,x,y){
      if(this.state==='won'||this.state==='lost')return {error:'Операция завершена'};
      if(!TYPES[type])return {error:'Неизвестный модуль'};
      x=Math.floor(x/40)*40+20;y=Math.floor(y/40)*40+20;
      const error=this.canBuild(x,y);if(error)return {error};
      if(this.cash<TYPES[type].cost)return {error:'Недостаточно кредитов'};
      const t={id:++this.serial,type,x,y,level:0,spent:TYPES[type].cost,cooldown:0,angle:-Math.PI/2,target:-1,beamUntil:0,beamX:x,beamY:y,kills:0};
      this.cash-=t.spent;this.towers.push(t);this.event('build',{x,y,color:TYPES[type].color});return {tower:t};
    }
    upgrade(id){
      const t=this.towers.find(t=>t.id===id);if(!t)return false;
      if(t.level>=3||this.state==='won'||this.state==='lost')return false;
      const cost=upgradeCost(t);if(this.cash<cost)return false;
      this.cash-=cost;t.spent+=cost;t.level++;this.event('build',{x:t.x,y:t.y,color:TYPES[t.type].color});return true;
    }
    sell(id){
      const i=this.towers.findIndex(t=>t.id===id);if(i<0||this.state==='won'||this.state==='lost')return 0;
      const t=this.towers[i],refund=Math.floor(t.spent*7/10);this.cash+=refund;this.towers.splice(i,1);this.event('sell',{x:t.x,y:t.y});return refund;
    }
    startWave(){
      if(this.state!=='prep'||this.wave>=10)return false;
      this.wave++;this.waveTime=0;this.spawned=0;this.spawnBudget=0;this.bossSpawned=false;this.bossId=-1;this.state='running';this.event('wave',{wave:this.wave});return true;
    }
    spawn(kind=0,progress=0){
      if(this.count>=CAPACITY)return -1;
      const e=this.free.length?this.free.pop():this.nextId++;
      if(e>=CAPACITY)return -1;
      this.active[this.count]=e;this.slot[e]=this.count++;this.alive[e]=1;this.kind[e]=kind;this.generation[e]++;
      // Late waves have enough endurance to fill the route even against upgraded defenses.
      const base=(22+this.wave*5)*(this.wave>=8?30+(this.wave-7)*20:this.wave===7?8:this.wave===6?3:1);
      this.maxHp[e]=this.hp[e]=kind===4?180000:base*[1,.68,3.4,1.9][kind];
      this.velocity[e]=kind===4?24:(43+this.wave*1.5)*[1,1.5,.70,1.07][kind]*(.92+this.random()*.16);
      this.progress[e]=progress;this.lane[e]=kind===4?0:(this.random()-.5)*28;
      this.slowUntil[e]=0;this.slowFactor[e]=1;this.poisonUntil[e]=0;this.poisonDamage[e]=0;this.locate(e);
      this.previousX[e]=this.x[e];this.previousY[e]=this.y[e];this.peak=Math.max(this.peak,this.count);
      if(kind===4){this.bossId=e;this.event('boss');}return e;
    }
    locate(e){
      const p=Math.max(0,Math.min(PATH.x.length-1.001,this.progress[e]/2)),i=Math.floor(p),f=p-i;
      this.x[e]=PATH.x[i]+(PATH.x[i+1]-PATH.x[i])*f+PATH.nx[i]*this.lane[e];
      this.y[e]=PATH.y[i]+(PATH.y[i+1]-PATH.y[i])*f+PATH.ny[i]*this.lane[e];
    }
    remove(e){
      if(!this.alive[e])return;
      this.alive[e]=0;if(this.bossId===e)this.bossId=-1;const s=this.slot[e],last=this.active[--this.count];this.active[s]=last;this.slot[last]=s;this.free.push(e);
    }
    damage(e,amount,pierce=false,tower=null){
      if(!this.alive[e])return false;
      this.hp[e]-=amount*(this.kind[e]===2&&!pierce?.63:1);
      if(this.hp[e]>0)return false;
      const boss=this.kind[e]===4,reward=boss?2000:[5,6,9,12][this.kind[e]];
      this.cash+=reward;this.earned+=reward;this.kills++;if(tower)tower.kills++;
      if(boss||this.count<200||e%11===0)this.event(boss?'bossKill':'kill',{x:this.x[e],y:this.y[e],color:boss?'#f3ab70':'#c6b179'});
      this.remove(e);return true;
    }
    rebuildGrid(){
      this.head.fill(-1);
      for(let i=0;i<this.count;i++){
        const e=this.active[i],cx=Math.max(0,Math.min(GRID_W-1,(this.x[e]/CELL)|0)),cy=Math.max(0,Math.min(GRID_H-1,(this.y[e]/CELL)|0)),c=cy*GRID_W+cx;
        this.next[e]=this.head[c];this.head[c]=e;
      }
    }
    query(x,y,r,visit){
      const x0=Math.max(0,Math.floor((x-r)/CELL)),x1=Math.min(GRID_W-1,Math.floor((x+r)/CELL)),y0=Math.max(0,Math.floor((y-r)/CELL)),y1=Math.min(GRID_H-1,Math.floor((y+r)/CELL)),r2=r*r;
      for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++)for(let e=this.head[cy*GRID_W+cx];e!==-1;e=this.next[e])if(this.alive[e]&&(this.x[e]-x)**2+(this.y[e]-y)**2<=r2)visit(e);
    }
    target(t,r){let best=-1,progress=-1;this.query(t.x,t.y,r,e=>{if(this.progress[e]>progress){best=e;progress=this.progress[e];}});return best;}
    blast(x,y,r,amount,t,color='#f4b878'){
      this.query(x,y,r,e=>this.damage(e,amount,false,t));this.event('explosion',{x,y,r,color});
    }
    fire(t,s,e){
      const type=t.type,x=this.x[e],y=this.y[e];t.target=e;t.angle=Math.atan2(y-t.y,x-t.x);
      if(type===0){this.damage(e,s.damage,false,t);this.event('shot',{x:t.x,y:t.y,tx:x,ty:y,color:TYPES[0].color});}
      if(type===1||type===4){
        if(this.projectiles.length<256)this.projectiles.push({type,x:t.x,y:t.y,tx:x,ty:y,target:e,targetGeneration:this.generation[e],speed:type===4?350:420,life:0,damage:s.damage,r:s.radius,tower:t});
        this.event('launch',{x:t.x,y:t.y,rocket:type===4});
      }
      if(type===2){
        this.query(t.x,t.y,s.range,v=>{this.slowUntil[v]=this.time+1.1;this.slowFactor[v]=this.kind[v]===4?.78:Math.max(.25,.52-t.level*.065);this.damage(v,s.damage,true,t);});
        this.event('frost',{x:t.x,y:t.y,r:s.range,color:TYPES[2].color});
      }
      if(type===3){
        const dx=Math.cos(t.angle),dy=Math.sin(t.angle);let hits=0;
        this.query(t.x,t.y,s.range,v=>{const vx=this.x[v]-t.x,vy=this.y[v]-t.y,d=vx*dx+vy*dy;if(d>=0&&Math.abs(vx*dy-vy*dx)<(this.kind[v]===4?30:8+t.level*2)&&hits++<64)this.damage(v,s.damage*(this.kind[v]===4?3:1),true,t);});
        t.beamX=t.x+dx*s.range;t.beamY=t.y+dy*s.range;t.beamUntil=this.time+.16;
      }
      if(type===5){
        this.query(x,y,s.radius,v=>{this.poisonUntil[v]=this.time+4;this.poisonDamage[v]=Math.max(this.poisonDamage[v],s.damage);this.damage(v,s.damage*.3,true,t);});
        this.event('toxin',{x,y,r:s.radius,color:TYPES[5].color});this.event('shot',{x:t.x,y:t.y,tx:x,ty:y,color:TYPES[5].color});
      }
    }
    step(dt){
      if(this.state!=='running')return;
      this.time+=dt;this.waveTime+=dt;
      const wave=WAVES[this.wave-1];this.spawnBudget+=wave.rate*dt;
      while(this.spawnBudget>=1&&this.spawned<wave.count){
        const p=this.random();let kind=0;
        if(this.wave>=2&&p<.27)kind=1;if(this.wave>=3&&p>.75)kind=2;if(this.wave>=6&&p>.62&&p<.75)kind=3;
        this.spawn(kind);this.spawned++;this.spawnBudget--;
      }
      this.spawnBudget=Math.min(this.spawnBudget,1);
      if(this.wave===10&&!this.bossSpawned&&this.waveTime>=5.5){this.spawn(4);this.bossSpawned=true;}
      for(let i=0;i<this.count;){
        const e=this.active[i];
        if(this.poisonUntil[e]>this.time&&this.damage(e,this.poisonDamage[e]*dt,true))continue;
        this.previousX[e]=this.x[e];this.previousY[e]=this.y[e];
        this.progress[e]+=this.velocity[e]*dt*(this.slowUntil[e]>this.time?this.slowFactor[e]:1);
        this.locate(e);
        if(this.progress[e]>=PATH.length-45){
          this.lives=Math.max(0,this.lives-(this.kind[e]===4?30:1));this.leaked++;
          this.event('leak',{x:1080,y:588});this.remove(e);
          if(!this.lives){this.state='lost';this.event('end',{won:false});return;}continue;
        }i++;
      }
      this.rebuildGrid();
      for(const t of this.towers){
        t.cooldown-=dt;if(t.cooldown>0)continue;const s=stats(t),e=this.target(t,s.range);
        if(e<0){t.cooldown=.07;continue;}this.fire(t,s,e);t.cooldown+=s.interval;
      }
      for(let i=this.projectiles.length-1;i>=0;i--){
        const p=this.projectiles[i];p.life+=dt;
        if(p.type===4&&this.alive[p.target]&&this.generation[p.target]===p.targetGeneration){p.tx=this.x[p.target];p.ty=this.y[p.target];}
        const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy);
        if(d<=p.speed*dt||p.life>3){this.blast(p.tx,p.ty,p.r,p.damage,p.tower,TYPES[p.type].color);this.projectiles[i]=this.projectiles[this.projectiles.length-1];this.projectiles.pop();}
        else{p.x+=dx/d*p.speed*dt;p.y+=dy/d*p.speed*dt;}
      }
      if(this.spawned>=wave.count&&!this.count&&(this.wave!==10||this.bossSpawned)){
        this.cash+=90+this.wave*35;this.projectiles.length=0;
        this.state=this.wave===10?'won':'prep';this.event(this.state==='won'?'end':'clear',{won:true,wave:this.wave});
      }
    }
  }
  const API={Simulation,TYPES,WAVES,PATH,W,H,CAPACITY,stats,upgradeCost};
  if(typeof module==='object'&&module.exports)module.exports=API;else root.TDEngine=API;
})(typeof window==='object'?window:globalThis);
