/* ═══════════════════════════════════════════════════════
   VIEWER — viewer.js
   Read-only mode. Loads ../content/config.json.
   No edit logic, no drag handlers, no delete, no add.
   ═══════════════════════════════════════════════════════ */

const LINE_ANCHOR_OFFSET = 0;
let mvEl;

/* ─────────────────── CONFIG LOAD ───────────────────── */

async function loadConfig() {
  try {
    const res = await fetch('../content/config.json');
    if (!res.ok) throw new Error('config.json not found');
    const cfg = await res.json();

    // Populate INGREDIENTS
    (cfg.tags || []).forEach(t => INGREDIENTS.push({
      id:          t.id,
      emoji:       t.emoji       || '📌',
      name:        t.name        || 'Tag',
      b1:          t.b1          || '',
      b2:          t.b2          || '',
      x:           t.x           ?? 0,
      y:           t.y           ?? 0,
      z:           t.z           ?? 0,
      nx:          t.nx          ?? 0,
      ny:          t.ny          ?? 1,
      nz:          t.nz          ?? 0,
      tagPosition: t.tagPosition || '0 0.12 0'
    }));

    // Apply metadata to UI
    const s = cfg.stats || {};
    _setEl('dish-title',  cfg.title    || '');
    _setEl('dish-sub',    cfg.subtitle || '');
    _setEl('stat-cal',    s.calories   || '—');
    _setEl('stat-pro',    s.protein    || '—');
    _setEl('stat-carb',   s.carbs      || '—');
    _setEl('stat-price',  s.price      || '—');

    // Load model
    document.getElementById('mv').setAttribute('src', '../content/' + (cfg.model || 'model.glb'));

  } catch(e) {
    console.error('loadConfig failed:', e);
    _showBadge('⚠ Could not load config.json', '#ff6666');
  }
}

function _setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

/* ─────────────────── TAG POS ───────────────────────── */

function _parseTagPos(ing) {
  if (ing._tx !== undefined) return { x: ing._tx, y: ing._ty, z: ing._tz };
  if (ing.tagPosition) {
    const p = ing.tagPosition.split(' ').map(Number);
    return { x: p[0]||0, y: p[1]||0, z: p[2]||0 };
  }
  return { x: ing.x+0.5, y: ing.y+0.5, z: ing.z };
}

/* ─────────────────── BUILD HOTSPOTS ────────────────── */

function buildHotspotBtn(ing) {
  // ── Anchor button (holds dot + SVG line) ──────────────
  const btn = document.createElement('button');
  btn.className = 'hotspot hs-anchor';
  btn.id        = 'hs-' + ing.id;
  btn.slot      = 'hotspot-' + ing.id;
  btn.setAttribute('data-position', `${ing.x} ${ing.y} ${ing.z}`);
  btn.setAttribute('data-normal',   `${ing.nx} ${ing.ny} ${ing.nz}`);
  btn.setAttribute('data-visibility-attribute', 'visible');
  btn.style.cssText = 'width:0;height:0;padding:0;margin:0;border:none;background:none;position:relative;overflow:visible;pointer-events:none;';

  // No interactive dot in viewer — anchor is purely visual origin for the line
  const ns  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.classList.add('hs-line-svg');
  svg.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:visible;pointer-events:none;';

  const line = document.createElementNS(ns, 'line');
  line.id = 'hs-line-' + ing.id;
  line.setAttribute('x1','0'); line.setAttribute('y1','0');
  line.setAttribute('x2','80'); line.setAttribute('y2','-80');
  line.setAttribute('stroke','rgba(255,255,255,0.50)');
  line.setAttribute('stroke-width','0.9');
  line.setAttribute('stroke-linecap','round');
  line.classList.add('hs-line-el');
  line.style.opacity = '0';
  svg.appendChild(line); btn.appendChild(svg);

  // Measure + hide for draw-in animation
  setTimeout(() => {
    let len; try{len=line.getTotalLength();}catch(e){len=300;}
    if(!len||len<1) len=300;
    line.style.strokeDasharray=len; line.style.strokeDashoffset=len; line.style.transition='none';
  }, 600);

  // ── Tag button (holds card UI) ─────────────────────────
  const tp = _parseTagPos(ing);
  const tagBtn = document.createElement('button');
  tagBtn.className = 'hotspot hs-tag';
  tagBtn.id        = 'hs-tag-' + ing.id;
  tagBtn.slot      = 'hotspot-tag-' + ing.id;
  tagBtn.setAttribute('data-position', `${tp.x} ${tp.y} ${tp.z}`);
  tagBtn.setAttribute('data-visibility-attribute', 'visible');
  tagBtn.style.cssText = 'width:0;height:0;padding:0;margin:0;border:none;background:none;position:relative;overflow:visible;pointer-events:none;';

  const cardWrap = document.createElement('div');
  cardWrap.className = 'hs-card-wrap';
  cardWrap.id        = 'hs-card-' + ing.id;
  cardWrap.style.cssText = 'position:absolute;left:0px;top:0px;transform:translate(-50%,-50%) scale(0.8);pointer-events:none;user-select:none;-webkit-user-select:none;white-space:nowrap;opacity:0;';

  const titleEl = document.createElement('div');
  titleEl.className = 'hs-title'; titleEl.textContent = ing.name;

  const card = document.createElement('div');
  card.className = 'hs-card';

  const icon = document.createElement('div');
  icon.className = 'hs-icon'; icon.textContent = ing.emoji;

  const ul  = document.createElement('ul'); ul.className = 'hs-bullets';
  const li1 = document.createElement('li'); li1.textContent = ing.b1;
  const li2 = document.createElement('li'); li2.textContent = ing.b2;
  ul.appendChild(li1); ul.appendChild(li2);
  card.appendChild(icon); card.appendChild(ul);

  cardWrap.appendChild(titleEl); cardWrap.appendChild(card);
  tagBtn.appendChild(cardWrap);

  return { anchorBtn: btn, tagBtn };
}

function buildAnchors(mv) {
  INGREDIENTS.forEach(ing => {
    const { anchorBtn, tagBtn } = buildHotspotBtn(ing);
    mv.appendChild(anchorBtn);
    mv.appendChild(tagBtn);
  });
}

/* ─────────────────── LINE UPDATE LOOP ──────────────── */

function _updateLine(ing) {
  const line      = document.getElementById('hs-line-' + ing.id);
  const anchorBtn = document.getElementById('hs-' + ing.id);
  const cardWrap  = document.getElementById('hs-card-' + ing.id);
  if (!line || !anchorBtn || !cardWrap) return;
  const aRect = anchorBtn.getBoundingClientRect();
  const cRect = cardWrap.getBoundingClientRect();
  const cx = cRect.left + cRect.width / 2;
  const cy = cRect.top  + cRect.height - LINE_ANCHOR_OFFSET;
  line.setAttribute('x2', (cx - aRect.left).toFixed(1));
  line.setAttribute('y2', (cy - aRect.top ).toFixed(1));
}

/* ─────────────────── ANIMATION ─────────────────────── */

function startTagAnimation() {
  INGREDIENTS.forEach((ing, index) => {
    const delay    = index * 400;
    const line     = document.getElementById('hs-line-'+ing.id);
    const card     = document.querySelector('#hs-card-'+ing.id+' .hs-card');
    const cardWrap = document.getElementById('hs-card-'+ing.id);
    if (!card || !cardWrap) return;

    if (line) {
      setTimeout(() => {
        let len; try{len=line.getTotalLength();}catch(e){len=300;}
        if(!len||len<1) len=300;
        line.style.transition='none'; line.style.opacity='0';
        line.style.strokeDasharray=len; line.style.strokeDashoffset=len;
        line.classList.remove('line-visible');
        void line.getBoundingClientRect();
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          line.style.opacity='1';
          line.style.transition='stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)';
          line.style.strokeDashoffset='0';
          setTimeout(()=>{line.style.transition='';line.classList.add('line-visible');},1300);
        }));
      }, delay);
    }
    setTimeout(()=>{cardWrap.style.opacity='1';cardWrap.style.transform='translate(-50%,-50%) scale(1)';card.classList.add('card-animate');}, delay+900);
    setTimeout(()=>card.classList.add('content-animate'),  delay+1300);
    setTimeout(()=>cardWrap.classList.add('title-animate'),delay+1700);
  });
}

function runFullSequence() {
  document.querySelectorAll('.hs-line-el').forEach(line=>{
    line.classList.remove('line-visible'); line.style.transition='none'; line.style.opacity='0';
    if(line.style.strokeDasharray) line.style.strokeDashoffset=line.style.strokeDasharray;
  });
  document.querySelectorAll('.hs-card').forEach(el=>el.classList.remove('card-animate','content-animate'));
  document.querySelectorAll('.hs-card-wrap').forEach(el=>{
    el.classList.remove('title-animate'); el.style.transition='none'; el.style.opacity='0'; el.style.transform='translate(-50%,-50%) scale(0.8)';
  });
  void document.body.offsetWidth;
  animateModelCinematic(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>startTagAnimation())));
}

function animateModelCinematic(onComplete) {
  const model=document.getElementById('mv'), duration=2600, startTime=performance.now();
  function ease(t){return 1-Math.pow(1-t,3);}
  function animate(time) {
    const p=Math.min((time-startTime)/duration,1), e=ease(p);
    model.orientation=`0deg 0deg ${(e*360).toFixed(2)}deg`;
    model.scale=`${(0.3+e*0.7).toFixed(4)} ${(0.3+e*0.7).toFixed(4)} ${(0.3+e*0.7).toFixed(4)}`;
    if(p<1){requestAnimationFrame(animate);}else{model.orientation='0deg 0deg 0deg';model.scale='1 1 1';onComplete();}
  }
  requestAnimationFrame(animate);
}

/* ─────────────────── GLOBALS ───────────────────────── */

function launchAR() {
  if(mvEl.canActivateAR){mvEl.activateAR();}
  else{_showBadge('📱 Open this page on your phone to view in AR', '#fff');}
}

function _showBadge(msg, color) {
  const b=document.getElementById('placing-badge'); if(!b) return;
  b.textContent=msg; b.style.color=color||'#4dbb6d';
  b.classList.add('show'); clearTimeout(b._t);
  b._t=setTimeout(()=>{b.classList.remove('show');b.style.color='';},2600);
}

/* ─────────────────── INIT ───────────────────────────── */

async function initViewer() {
  mvEl = document.getElementById('mv');

  await loadConfig();
  buildAnchors(mvEl);

  // Double-tap resets camera
  let lastTap=0;
  mvEl.addEventListener('touchend',()=>{
    const now=Date.now();
    if(now-lastTap<280){mvEl.cameraOrbit='0deg 75deg auto';mvEl.cameraTarget='auto auto auto';lastTap=0;}
    else{lastTap=now;}
  });

  // Model load → hide loader
  mvEl.addEventListener('load',()=>{
    const l=document.getElementById('load');
    l.style.opacity='0'; setTimeout(()=>{l.style.display='none';},700);
    setTimeout(()=>{document.getElementById('bar').classList.add('on');},1000);
    setTimeout(()=>{document.getElementById('dbl-hint').style.opacity='0';},5000);
  });
  setTimeout(()=>{
    const l=document.getElementById('load');
    if(l&&l.style.display!=='none'){l.style.opacity='0';setTimeout(()=>{l.style.display='none';document.getElementById('bar').classList.add('on');},500);}
  },15000);

  // Triple-click restarts animation
  let _clicks=0,_ct;
  document.addEventListener('click',()=>{
    _clicks++; clearTimeout(_ct);
    _ct=setTimeout(()=>{_clicks=0;},400);
    if(_clicks===3){runFullSequence();_clicks=0;}
  });

  // Auto-start after model loads
  let started=false;
  const _start=()=>{if(started)return;started=true;setTimeout(runFullSequence,800);};
  mvEl.addEventListener('load',_start);
  setTimeout(_start,4000);

  // AR restart
  mvEl.addEventListener('ar-status',e=>{if(e.detail?.status==='session-started') runFullSequence();});

  // Triple-click hint — gently fades in/out every 10s
  const _tripHint=document.getElementById('trip-hint');
  if(_tripHint){
    const _pulse=()=>{
      _tripHint.style.opacity='1';
      setTimeout(()=>{_tripHint.style.opacity='0';},3500);
    };
    setTimeout(_pulse,6000);           // first appearance once intro settles
    setInterval(_pulse,10000);         // then every 10 seconds
  }

  // Line update loop
  (function _loop(){ INGREDIENTS.forEach(ing=>_updateLine(ing)); requestAnimationFrame(_loop); })();
}

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initViewer);}
else{initViewer();}
