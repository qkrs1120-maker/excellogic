'use strict';

// ══════════════════════════════════════════
// 1. 동적 타이틀
// ══════════════════════════════════════════
(function() {
  const titles = ["업무 데이터 검토","내부 분석 보고서","운영 프로세스 점검",
                  "일일 로그 분석","프로젝트 유지관리","데이터 무결성 검증"];
  const today  = new Date().toISOString().slice(0,10);
  const chosen = titles[new Date().getDate() % titles.length];
  const full   = chosen + ' – ' + today;
  document.getElementById('page-title').textContent = full;
  document.title = full;
  document.getElementById('doc-title').textContent = full;
  const code = today.replace(/-/g,'').slice(2);
  document.getElementById('file-name').textContent = '점검_' + code + '.xlsx';
})();

// ══════════════════════════════════════════
// 2. 그리드 상수
// ══════════════════════════════════════════
const COLS = 30;
const ROWS = 60;
const PUZ_ROW = 3;  // 퍼즐 앵커 행 (0-based)
const PUZ_COL = 2;  // 퍼즐 앵커 열 (0-based)

function colName(i) {
  return i < 26 ? String.fromCharCode(65+i)
                : String.fromCharCode(64+Math.floor(i/26)) + String.fromCharCode(65+(i%26));
}

// ══════════════════════════════════════════
// 3. 더미 데이터 (업무용, 한국어 감정 단어 없음)
// ══════════════════════════════════════════
function fakeVal(r, c) {
  return { v:'', st:'' };
}

// ══════════════════════════════════════════
// 4. 그리드 빌드
// ══════════════════════════════════════════
function buildGrid() {
  const thead = document.getElementById('gthead');
  const tbody = document.getElementById('gtbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  // 헤더 행
  const hr = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'corner';
  hr.appendChild(corner);
  for (let c=0; c<COLS; c++) {
    const th = document.createElement('th');
    th.textContent = colName(c);
    th.dataset.col = c;
    th.addEventListener('click', () => selCol(c));
    hr.appendChild(th);
  }
  thead.appendChild(hr);

  // 바디
  for (let r=0; r<ROWS; r++) {
    const tr = document.createElement('tr');
    const rn = document.createElement('td');
    rn.className = 'rn';
    rn.textContent = r+1;
    rn.dataset.row = r;
    rn.addEventListener('click', () => selRow(r));
    tr.appendChild(rn);
    for (let c=0; c<COLS; c++) {
      const td = document.createElement('td');
      td.className = 'dc';
      td.dataset.r = r;
      td.dataset.c = c;
      const f = fakeVal(r,c);
      td.textContent = f.v;
      if (f.st) td.style.cssText = f.st;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  // 이벤트 위임
  tbody.addEventListener('mousedown', onMD);
  tbody.addEventListener('mouseover', onMO);
  document.addEventListener('mouseup', onMU);
  tbody.addEventListener('contextmenu', onRC);
}

function cell(r, c) {
  return document.querySelector('#gtbody td.dc[data-r="'+r+'"][data-c="'+c+'"]');
}
function colTH(c) {
  return document.querySelector('#gthead th[data-col="'+c+'"]');
}
function rowRN(r) {
  return document.querySelector('#gtbody td.rn[data-row="'+r+'"]');
}

// ══════════════════════════════════════════
// 5. 셀 선택
// ══════════════════════════════════════════
let sr1=0,sc1=0,sr2=0,sc2=0,dragging=false;
let pDrag=false, pDragState=null, pDragUsed=false;
let pRDrag=false, pRDragState=null;  // 우클릭 드래그

function clearSel() {
  document.querySelectorAll('.dc.sel,.dc.in-sel').forEach(e=>{e.classList.remove('sel','in-sel');});
  document.querySelectorAll('.ch-active').forEach(e=>e.classList.remove('ch-active'));
  document.querySelectorAll('.rh-active').forEach(e=>e.classList.remove('rh-active'));
}
function applySel(r1,c1,r2,c2) {
  clearSel();
  const minR=Math.min(r1,r2),maxR=Math.max(r1,r2);
  const minC=Math.min(c1,c2),maxC=Math.max(c1,c2);
  for(let r=minR;r<=maxR;r++) for(let c=minC;c<=maxC;c++) {
    const td=cell(r,c); if(!td) continue;
    td.classList.add(r===r1&&c===c1?'sel':'in-sel');
  }
  for(let c=minC;c<=maxC;c++){const th=colTH(c);if(th)th.classList.add('ch-active');}
  for(let r=minR;r<=maxR;r++){const rn=rowRN(r);if(rn)rn.classList.add('rh-active');}
  document.getElementById('namebox').value = colName(c1)+(r1+1)+(r1!==r2||c1!==c2?':'+colName(c2)+(r2+1):'');
  const td0=cell(r1,c1);
  document.getElementById('fbar-input').value = (td0&&!td0.classList.contains('pz'))?td0.textContent:'';
}
function selCol(c) {
  clearSel();
  for(let r=0;r<ROWS;r++){const td=cell(r,c);if(td)td.classList.add('in-sel');}
  const th=colTH(c);if(th)th.classList.add('ch-active');
  document.getElementById('namebox').value=colName(c)+'1:'+colName(c)+ROWS;
}
function selRow(r) {
  clearSel();
  for(let c=0;c<COLS;c++){const td=cell(r,c);if(td)td.classList.add('in-sel');}
  const rn=rowRN(r);if(rn)rn.classList.add('rh-active');
  document.getElementById('namebox').value='A'+(r+1)+':'+colName(COLS-1)+(r+1);
}

function onMD(e) {
  const td = e.target.closest('td.dc');
  if(!td) return;
  const r=+td.dataset.r, c=+td.dataset.c;

  // 퍼즐 셀 좌클릭 드래그 → 검정(2)
  if(e.button===0 && td.classList.contains('pz') && puzRegion) {
    pDrag=true; pDragUsed=true;
    const pr=+td.dataset.pr, pc=+td.dataset.pc;
    pDragState = puzStates[pr][pc]===2 ? 0 : 2;
    puzStates[pr][pc]=pDragState; renderCell(pr,pc); autoCheck();
    e.preventDefault(); return;
  }
  // 퍼즐 셀 우클릭 드래그 → 회색(1)
  if(e.button===2 && td.classList.contains('pz') && puzRegion) {
    pRDrag=true;
    const pr=+td.dataset.pr, pc=+td.dataset.pc;
    pRDragState = puzStates[pr][pc]===1 ? 0 : 1;
    puzStates[pr][pc]=pRDragState; renderCell(pr,pc);
    e.preventDefault(); return;
  }

  if(e.button!==0) return;
  dragging=true; sr1=sr2=r; sc1=sc2=c;
  applySel(r,c,r,c); e.preventDefault();
}
function onMO(e) {
  const td=e.target.closest('td.dc'); if(!td) return;
  // 좌클릭 드래그 페인트
  if(pDrag && td.classList.contains('pz') && puzRegion) {
    const pr=+td.dataset.pr,pc=+td.dataset.pc;
    if(puzStates[pr][pc]!==pDragState){puzStates[pr][pc]=pDragState;renderCell(pr,pc);autoCheck();}
    return;
  }
  // 우클릭 드래그 페인트
  if(pRDrag && td.classList.contains('pz') && puzRegion) {
    const pr=+td.dataset.pr,pc=+td.dataset.pc;
    if(puzStates[pr][pc]!==pRDragState){puzStates[pr][pc]=pRDragState;renderCell(pr,pc);}
    return;
  }
  if(!dragging) return;
  sr2=+td.dataset.r; sc2=+td.dataset.c; applySel(sr1,sc1,sr2,sc2);
}
function onMU() {
  dragging=false; pDrag=false; pRDrag=false; pDragState=null; pRDragState=null;
  setTimeout(()=>{pDragUsed=false;},0);
}
function onRC(e) {
  // 우클릭은 mousedown에서 처리하므로 기본 메뉴만 막음
  const td=e.target.closest('td.dc.pz'); if(td) e.preventDefault();
}

// ══════════════════════════════════════════
// 6. 퍼즐 상태
// ══════════════════════════════════════════
let puzRegion  = null;  // { ar, ac, hD, hW, rows, cols }
let puzStates  = [];
let puzCurrent = null;
let puzLevel   = null;
let puzIdx     = null;

function rowHints(g) {
  return g.map(row=>{const h=[];let n=0;row.forEach(v=>{if(v)n++;else if(n>0){h.push(n);n=0;}});if(n>0)h.push(n);return h.length?h:[0];});
}
function colHints(g) {
  const res=[];
  for(let c=0;c<g[0].length;c++){const h=[];let n=0;g.forEach(row=>{if(row[c])n++;else if(n>0){h.push(n);n=0;}});if(n>0)h.push(n);res.push(h.length?h:[0]);}
  return res;
}

// ══════════════════════════════════════════
// 7. 퍼즐을 그리드 셀에 직접 렌더링
// ══════════════════════════════════════════
function loadPuzzle(level, idx) {
  const list = window.PUZZLES && window.PUZZLES[level];
  if(!list||!list[idx]) { alert('퍼즐 데이터를 찾을 수 없습니다. ('+level+', '+idx+')'); return; }

  clearPuzzle();  // 이전 퍼즐 지우기

  puzLevel   = level;
  puzIdx     = idx;
  puzCurrent = list[idx];

  const grid = puzCurrent.grid || puzCurrent.solution;
  const R    = grid.length;
  const C    = grid[0].length;

  puzStates = Array.from({length:R}, ()=>new Array(C).fill(0));

  const rH = puzCurrent.rowHints || rowHints(grid);
  const cH = puzCurrent.colHints || colHints(grid);

  const maxRH = Math.max(...rH.map(h=>h.length));  // 행 힌트 폭
  const maxCH = Math.max(...cH.map(h=>h.length));  // 열 힌트 높이

  puzRegion = { ar:PUZ_ROW, ac:PUZ_COL, hD:maxCH, hW:maxRH, rows:R, cols:C };
  const {ar,ac,hD,hW} = puzRegion;

  // 제목 라벨
  if(ar>0) {
    const lc = cell(ar-1, ac);
    if(lc) { lc.textContent=puzCurrent.title||'항목 분석'; lc.style.cssText=''; lc.classList.add('hint-label'); }
  }

  // 코너
  for(let r=ar;r<ar+hD;r++) for(let c=ac;c<ac+hW;c++) {
    const td=cell(r,c); if(td){td.textContent='';td.style.cssText='';td.classList.add('hint-corner');}
  }

  // 열 힌트
  for(let c=0;c<C;c++) {
    const hints=cH[c], off=maxCH-hints.length;
    for(let hi=0;hi<maxCH;hi++) {
      const td=cell(ar+hi, ac+hW+c);
      if(td){td.style.cssText='';td.textContent=(hi>=off)?hints[hi-off]:'';td.classList.add('hint-col');}
    }
  }

  // 행 힌트
  for(let r=0;r<R;r++) {
    const hints=rH[r], off=maxRH-hints.length;
    for(let hi=0;hi<maxRH;hi++) {
      const td=cell(ar+hD+r, ac+hi);
      if(td){td.style.cssText='';td.textContent=(hi>=off)?hints[hi-off]:'';td.classList.add('hint-row');}
    }
  }

  // 퍼즐 셀
  for(let r=0;r<R;r++) for(let c=0;c<C;c++) {
    const td=cell(ar+hD+r, ac+hW+c);
    if(td){td.style.cssText='';td.textContent='';td.className='dc pz';td.dataset.pr=r;td.dataset.pc=c;}
  }

  // Name box & status
  document.getElementById('namebox').value = colName(ac+hW)+(ar+hD+1);
  document.getElementById('status-txt').textContent = '분석 중: '+puzCurrent.title+' ('+R+'×'+C+')';

  // 퍼즐로 스크롤
  const anchor = cell(Math.max(0,ar-1), ac);
  if(anchor) anchor.scrollIntoView({behavior:'smooth',block:'start',inline:'start'});

  renderShareBtn();
}

function clearPuzzle() {
  if(!puzRegion) return;
  const {ar,ac,hD,hW,rows,cols} = puzRegion;
  const labelR = ar-1;
  // 라벨 복구
  if(labelR>=0) {
    const lc=cell(labelR,ac);
    if(lc){lc.classList.remove('hint-label','hint-col','hint-row','hint-corner','pz','filled','marked');
           delete lc.dataset.pr; delete lc.dataset.pc;
           const f=fakeVal(labelR,ac);lc.textContent=f.v;lc.style.cssText=f.st||'';}
  }
  // 퍼즐+힌트 영역 복구
  for(let r=ar;r<ar+hD+rows;r++) for(let c=ac;c<ac+hW+cols;c++) {
    const td=cell(r,c); if(!td) continue;
    td.className='dc'; delete td.dataset.pr; delete td.dataset.pc;
    const f=fakeVal(r,c); td.textContent=f.v; td.style.cssText=f.st||'';
  }
  puzRegion=null; puzStates=[]; puzCurrent=null;
}

function renderCell(pr,pc) {
  const {ar,ac,hD,hW}=puzRegion;
  const td=cell(ar+hD+pr, ac+hW+pc); if(!td) return;
  td.classList.remove('filled','marked');
  if(puzStates[pr][pc]===2) td.classList.add('filled');
  else if(puzStates[pr][pc]===1) td.classList.add('marked');
}

// ══════════════════════════════════════════
// 8. 정답 확인
// ══════════════════════════════════════════
function autoCheck() {
  if(!puzCurrent||!puzRegion) return;
  const g=puzCurrent.grid||puzCurrent.solution;
  for(let r=0;r<g.length;r++) for(let c=0;c<g[0].length;c++) {
    if(g[r][c]&&puzStates[r][c]!==2) return;
    if(!g[r][c]&&puzStates[r][c]===2) return;
  }
  showWin();
}
function verifyNow() {
  if(!puzCurrent||!puzRegion){alert('분석 항목이 로드되지 않았습니다.');return;}
  const g=puzCurrent.grid||puzCurrent.solution;
  let ok=true;
  outer:for(let r=0;r<g.length;r++) for(let c=0;c<g[0].length;c++) {
    if(g[r][c]&&puzStates[r][c]!==2){ok=false;break outer;}
    if(!g[r][c]&&puzStates[r][c]===2){ok=false;break outer;}
  }
  if(ok) showWin();
  else document.getElementById('status-txt').textContent='⚠ 불일치 항목 발견 – 재확인하세요';
}
function resetPuz() {
  if(!puzRegion) return;
  const {rows,cols}=puzRegion;
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){puzStates[r][c]=0;renderCell(r,c);}
  document.getElementById('status-txt').textContent='분석 중: '+puzCurrent.title+' – 초기화됨';
}

// ══════════════════════════════════════════
// 9. 완료 팝업
// ══════════════════════════════════════════
function showWin() {
  if(puzLevel&&puzIdx!==null) markSolved(puzLevel,puzIdx);
  document.getElementById('win-msg').textContent =
    '"'+(puzCurrent.title||'분석 항목')+'" 패턴이 완전히 일치합니다.';
  document.getElementById('modal-win').classList.remove('hidden');
  // AdSense 광고 로드 시도
  try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}catch(e){}
}

// ══════════════════════════════════════════
// 10. 항목 목록 모달
// ══════════════════════════════════════════
function openList(level) {
  if(!level) {alert('분석 수준을 먼저 선택하세요.');return;}
  const labels={beginner:'기본 검토 항목',intermediate:'심화 분석 항목',expert:'전문 감사 항목'};
  document.getElementById('list-title').textContent=labels[level]||'분석 항목';
  const body=document.getElementById('list-body');
  body.innerHTML='';
  const list=window.PUZZLES&&window.PUZZLES[level];
  if(!list||!list.length){body.innerHTML='<p style="padding:12px;font-size:11px;color:#999">항목 없음</p>';
  } else {
    const solved=getSolved();
    list.forEach((p,i)=>{
      const done=!!solved[level+'_'+i];
      const row=document.createElement('div');
      row.className='li-row'+(done?' done':'');
      row.innerHTML='<span class="li-num">'+String(i+1).padStart(3,'0')+'</span>'
        +'<span>'+(p.title||'항목 '+(i+1))+'</span>'
        +'<span class="li-st">'+(done?'✔ 완료':'대기')+'</span>';
      row.addEventListener('click',()=>{closeModal('modal-list');loadPuzzle(level,i);});
      body.appendChild(row);
    });
  }
  document.getElementById('modal-list').classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
// 모달 배경 클릭 닫기
document.querySelectorAll('.modal-backdrop').forEach(el=>{
  el.addEventListener('click',e=>{if(e.target===el)el.classList.add('hidden');});
});

// ══════════════════════════════════════════
// 11. 버튼 이벤트
// ══════════════════════════════════════════
document.getElementById('btn-open-list').addEventListener('click',()=>{
  openList(document.getElementById('sel-level').value);
});
document.getElementById('sel-level').addEventListener('change',function(){
  if(this.value) openList(this.value);
});
document.getElementById('btn-verify').addEventListener('click', verifyNow);
document.getElementById('btn-reset').addEventListener('click', resetPuz);

// ══════════════════════════════════════════
// 12. 리본 탭
// ══════════════════════════════════════════
document.querySelectorAll('.rtab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.rtab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.rpanel').forEach(p=>p.classList.remove('active'));
    tab.classList.add('active');
    const p=document.getElementById(tab.dataset.p);
    if(p) p.classList.add('active');
  });
});

// ══════════════════════════════════════════
// 13. 줌
// ══════════════════════════════════════════
let zoomPct=100;
function changeZoom(d){
  zoomPct=Math.max(60,Math.min(180,zoomPct+d));
  document.getElementById('grid-scroll').style.zoom=zoomPct/100;
  document.getElementById('zoom-lbl').textContent=zoomPct+'%';
  document.getElementById('sbar-zoom').textContent=zoomPct+'%';
  document.getElementById('zoom-range').value=zoomPct;
}
document.getElementById('zoom-range').addEventListener('input',function(){zoomPct=+this.value;changeZoom(0);});

// ══════════════════════════════════════════
// 14. 시트 탭
// ══════════════════════════════════════════
document.querySelectorAll('.stab').forEach(t=>{
  t.addEventListener('click',()=>{
    document.querySelectorAll('.stab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    const sheet = t.dataset.sheet || '1';
    // 그리드 영역 토글
    document.getElementById('grid-wrap').style.display = sheet === '1' ? '' : 'none';
    // 시트 오버레이 토글
    document.querySelectorAll('.sheet-overlay').forEach(el => el.classList.add('hidden'));
    if (sheet !== '1') {
      const el = document.getElementById('sheet-' + sheet);
      if (el) el.classList.remove('hidden');
    }
  });
});

// ══════════════════════════════════════════
// 15. 우측 하단 광고 접기
// ══════════════════════════════════════════
document.getElementById('corner-toggle').addEventListener('click',function(){
  const b=document.getElementById('corner-ad-body');
  const c=b.classList.toggle('collapsed');
  this.textContent=c?'＋':'－';
});
// 우측 하단 광고 AdSense 로드
try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}catch(e){}

// ══════════════════════════════════════════
// 16. localStorage
// ══════════════════════════════════════════
function getSolved(){try{return JSON.parse(localStorage.getItem('wl_solved')||'{}');}catch{return {};}}
function markSolved(l,i){const s=getSolved();s[l+'_'+i]=true;localStorage.setItem('wl_solved',JSON.stringify(s));}

// ══════════════════════════════════════════
// 17. 상태바 시계
// ══════════════════════════════════════════
function tick(){document.getElementById('sbar-status').textContent='준비  '+new Date().toTimeString().slice(0,8);}
setInterval(tick,1000); tick();

// ══════════════════════════════════════════
// 19. 스도쿠
// ══════════════════════════════════════════

// ── 퍼즐 데이터 (0=빈칸) ──
const SDK_DATA = {
  'sdk-easy': [
    { title:'수치 검토 케이스 001',
      q:[[5,3,0,0,7,0,0,0,0],[6,0,0,1,9,5,0,0,0],[0,9,8,0,0,0,0,6,0],
         [8,0,0,0,6,0,0,0,3],[4,0,0,8,0,3,0,0,1],[7,0,0,0,2,0,0,0,6],
         [0,6,0,0,0,0,2,8,0],[0,0,0,4,1,9,0,0,5],[0,0,0,0,8,0,0,7,9]],
      a:[[5,3,4,6,7,8,9,1,2],[6,7,2,1,9,5,3,4,8],[1,9,8,3,4,2,5,6,7],
         [8,5,9,7,6,1,4,2,3],[4,2,6,8,5,3,7,9,1],[7,1,3,9,2,4,8,5,6],
         [9,6,1,5,3,7,2,8,4],[2,8,7,4,1,9,6,3,5],[3,4,5,2,8,6,1,7,9]] },
    { title:'수치 검토 케이스 002',
      q:[[0,0,0,2,6,0,7,0,1],[6,8,0,0,7,0,0,9,0],[1,9,0,0,0,4,5,0,0],
         [8,2,0,1,0,0,0,4,0],[0,0,4,6,0,2,9,0,0],[0,5,0,0,0,3,0,2,8],
         [0,0,9,3,0,0,0,7,4],[0,4,0,0,5,0,0,3,6],[7,0,3,0,1,8,0,0,0]],
      a:[[4,3,5,2,6,9,7,8,1],[6,8,2,5,7,1,4,9,3],[1,9,7,8,3,4,5,6,2],
         [8,2,6,1,9,5,3,4,7],[3,7,4,6,8,2,9,1,5],[9,5,1,7,4,3,6,2,8],
         [5,1,9,3,2,6,8,7,4],[2,4,8,9,5,7,1,3,6],[7,6,3,4,1,8,2,5,9]] },
    { title:'수치 검토 케이스 003',
      q:[[0,0,3,0,2,0,6,0,0],[9,0,0,3,0,5,0,0,1],[0,0,1,8,0,6,4,0,0],
         [0,0,8,1,0,2,9,0,0],[7,0,0,0,0,0,0,0,8],[0,0,6,7,0,8,2,0,0],
         [0,0,2,6,0,9,5,0,0],[8,0,0,2,0,3,0,0,9],[0,0,5,0,1,0,3,0,0]],
      a:[[4,8,3,9,2,1,6,5,7],[9,6,7,3,4,5,8,2,1],[2,5,1,8,7,6,4,9,3],
         [5,4,8,1,3,2,9,7,6],[7,2,9,5,6,4,1,3,8],[1,3,6,7,9,8,2,4,5],
         [3,7,2,6,8,9,5,1,4],[8,1,4,2,5,3,7,6,9],[6,9,5,4,1,7,3,8,2]] }
  ],
  'sdk-mid': [
    { title:'수식 분석 케이스 001',
      q:[[0,2,0,0,0,0,0,0,0],[0,0,0,6,0,0,0,0,3],[0,7,4,0,8,0,0,0,0],
         [0,0,0,0,0,3,0,0,2],[0,8,0,0,4,0,0,1,0],[6,0,0,5,0,0,0,0,0],
         [0,0,0,0,1,0,7,8,0],[5,0,0,0,0,9,0,0,0],[0,0,0,0,0,0,0,4,0]],
      a:[[1,2,6,4,3,7,9,5,8],[8,9,5,6,2,1,4,7,3],[3,7,4,9,8,5,1,2,6],
         [4,5,7,1,9,3,8,6,2],[9,8,3,2,4,6,5,1,7],[6,1,2,5,7,8,3,9,4],
         [2,6,9,3,1,4,7,8,5],[5,4,8,7,6,9,2,3,1],[7,3,1,8,5,2,6,4,9]] },
    { title:'수식 분석 케이스 002',
      q:[[0,0,0,0,0,0,2,0,0],[0,0,0,0,3,0,0,0,0],[1,0,0,0,0,4,0,0,5],
         [0,0,0,8,0,0,0,0,0],[0,6,0,0,5,0,0,2,0],[0,0,0,0,0,7,0,0,0],
         [4,0,0,3,0,0,0,0,6],[0,0,0,0,2,0,0,0,0],[0,0,5,0,0,0,0,0,0]],
      a:[[6,4,8,5,7,3,2,9,1],[9,5,2,6,3,1,7,4,8],[1,3,7,2,9,4,6,8,5],
         [2,7,4,8,6,9,3,5,1],[3,6,9,4,5,8,1,2,7],[5,8,1,1,4,7,9,6,3],
         [4,2,3,3,1,5,8,7,6],[7,1,6,9,2,6,4,3,2],[8,9,5,7,8,2,5,1,4]] },
    { title:'수식 분석 케이스 003',
      q:[[0,0,0,0,0,7,0,0,0],[0,0,0,0,3,0,0,8,0],[0,0,1,0,0,0,5,0,0],
         [0,3,0,0,0,0,0,0,7],[0,0,0,6,0,1,0,0,0],[8,0,0,0,0,0,0,4,0],
         [0,0,9,0,0,0,4,0,0],[0,7,0,0,2,0,0,0,0],[0,0,0,5,0,0,0,0,0]],
      a:[[2,8,3,9,5,7,1,6,4],[6,5,7,4,3,2,9,8,1],[4,9,1,8,6,3,5,7,2],
         [1,3,6,2,9,4,8,5,7],[5,4,2,6,7,1,3,9,8],[8,7,5,3,1,6,2,4,9],
         [3,2,9,7,8,5,4,1,6],[9,7,4,1,2,8,6,3,5],[7,1,8,5,4,9,7,2,3]] }
  ],
  'sdk-hard': [
    { title:'통계 감사 케이스 001',
      q:[[8,0,0,0,0,0,0,0,0],[0,0,3,6,0,0,0,0,0],[0,7,0,0,9,0,2,0,0],
         [0,5,0,0,0,7,0,0,0],[0,0,0,0,4,5,7,0,0],[0,0,0,1,0,0,0,3,0],
         [0,0,1,0,0,0,0,6,8],[0,0,8,5,0,0,0,1,0],[0,9,0,0,0,0,4,0,0]],
      a:[[8,1,2,7,5,3,6,4,9],[9,4,3,6,8,2,1,7,5],[6,7,5,4,9,1,2,8,3],
         [1,5,4,2,3,7,8,9,6],[3,6,9,8,4,5,7,2,1],[2,8,7,1,6,9,5,3,4],
         [5,2,1,9,7,4,3,6,8],[4,3,8,5,2,6,9,1,7],[7,9,6,3,1,8,4,5,2]] },
    { title:'통계 감사 케이스 002',
      q:[[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,3,0,8,5],[0,0,1,0,2,0,0,0,0],
         [0,0,0,5,0,7,0,0,0],[0,0,4,0,0,0,1,0,0],[0,9,0,0,0,0,0,0,0],
         [5,0,0,0,0,0,0,7,3],[0,0,2,0,1,0,0,0,0],[0,0,0,0,4,0,0,0,9]],
      a:[[9,8,7,6,5,4,3,2,1],[2,4,6,1,7,3,9,8,5],[3,5,1,9,2,8,7,4,6],
         [1,2,8,5,3,7,6,9,4],[6,3,4,8,9,2,1,5,7],[7,9,5,4,6,1,8,3,2],
         [5,1,9,2,8,6,4,7,3],[4,7,2,3,1,5,8,6,9],[8,6,3,7,4,9,2,1,5]] },
    { title:'통계 감사 케이스 003',
      q:[[0,0,5,3,0,0,0,0,0],[8,0,0,0,0,0,0,2,0],[0,7,0,0,1,0,5,0,0],
         [4,0,0,0,0,5,3,0,0],[0,1,0,0,7,0,0,0,6],[0,0,3,2,0,0,0,8,0],
         [0,6,0,5,0,0,0,0,9],[0,0,4,0,0,0,0,3,0],[0,0,0,0,0,9,7,0,0]],
      a:[[1,4,5,3,2,7,9,6,8],[8,3,9,6,5,4,1,2,7],[6,7,2,9,1,8,5,4,3],
         [4,9,6,1,8,5,3,7,2],[2,1,8,4,7,3,6,5,9],[7,5,3,2,9,6,4,8,1],
         [3,6,7,5,4,2,8,1,9],[9,2,4,8,6,1,2,3,5],[5,8,1,7,3,9,7,9,4]] }
  ]
};

// 스도쿠 상태
let sdkRegion = null;   // { ar, ac }
let sdkOrig   = null;   // 원본 퍼즐 (0=빈칸)
let sdkBoard  = null;   // 현재 입력값
let sdkAnswer = null;   // 정답
let sdkSelR   = -1, sdkSelC = -1;  // 선택된 빈칸

// 스도쿠를 그리드 셀에 직접 렌더링
function loadSudokuIntoGrid(level, idx) {
  const list = SDK_DATA[level];
  if (!list || !list[idx]) return;

  // 기존 퍼즐/스도쿠 클리어
  clearPuzzle();
  clearSudoku();

  const puz   = list[idx];
  sdkOrig     = puz.q.map(r => [...r]);
  sdkBoard    = puz.q.map(r => [...r]);
  sdkAnswer   = puz.a;
  sdkSelR = -1; sdkSelC = -1;

  const ar = 1, ac = 1;  // B열 2행 (0-based)
  sdkRegion = { ar, ac };

  // 제목 라벨 — A열(col 0)에 배치하여 스도쿠 열 너비에 영향 없게
  const titleCell = cell(ar - 1 >= 0 ? ar - 1 : ar, 0);
  if (titleCell) { titleCell.textContent = puz.title; titleCell.style.cssText = ''; titleCell.classList.add('hint-label'); }

  // 9×9 셀 렌더링
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const td = cell(ar + r, ac + c);
      if (!td) continue;
      td.style.cssText = '';
      td.classList.remove('hint-col','hint-row','hint-corner','pz','pz-fill','pz-mark');

      const val = sdkOrig[r][c];
      // 3×3 박스 굵은 테두리
      const bT = r % 3 === 0 ? '2px solid #555' : '1px solid #ccc';
      const bL = c % 3 === 0 ? '2px solid #555' : '1px solid #ccc';
      const bB = r === 8      ? '2px solid #555' : '1px solid #ccc';
      const bR = c === 8      ? '2px solid #555' : '1px solid #ccc';

      td.style.borderTop    = bT;
      td.style.borderLeft   = bL;
      td.style.borderBottom = bB;
      td.style.borderRight  = bR;
      td.style.textAlign    = 'center';
      td.style.fontSize     = '13px';
      td.style.fontWeight   = val ? '600' : '400';
      td.style.cursor       = val ? 'default' : 'pointer';
      td.style.background   = val ? '#f5f5f5' : '#fff';
      td.style.color        = val ? '#222' : '#1565c0';
      td.textContent        = val || '';

      td.dataset.sdk = '1';
      td.dataset.sdkR = r;
      td.dataset.sdkC = c;
      td.dataset.sdkFixed = val ? '1' : '0';
    }
  }

  document.getElementById('status-txt').textContent =
    '수치 분석 중: ' + puz.title + ' — 빈 칸을 클릭 후 숫자키로 입력';
  document.getElementById('namebox').value = colName(ac) + (ar + 1);

  const anchor = cell(Math.max(0, ar - 1), ac);
  if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' });

  renderShareBtn();
}

// 스도쿠 셀 그리드에서 제거
function clearSudoku() {
  if (!sdkRegion) return;
  const { ar, ac } = sdkRegion;

  // 제목 라벨 복구 (A열)
  const titleRow = ar - 1 >= 0 ? ar - 1 : ar;
  const titleC = cell(titleRow, 0);
  if (titleC) { titleC.classList.remove('hint-label'); const f = fakeVal(titleRow, 0); titleC.textContent = f.v; titleC.style.cssText = f.st || ''; }
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const td = cell(ar + r, ac + c);
    if (!td) continue;
    td.style.cssText = '';
    td.className = 'dc';
    delete td.dataset.sdk; delete td.dataset.sdkR; delete td.dataset.sdkC; delete td.dataset.sdkFixed;
    const f = fakeVal(ar + r, ac + c); td.textContent = f.v; if (f.st) td.style.cssText = f.st;
  }
  sdkRegion = null; sdkOrig = null; sdkBoard = null; sdkAnswer = null;
  sdkSelR = -1; sdkSelC = -1;
}

// 스도쿠 셀 클릭 (gtbody 이벤트 위임에서 처리)
function handleSdkClick(td) {
  if (td.dataset.sdkFixed === '1') return;
  // 이전 선택 해제
  if (sdkSelR >= 0) {
    const prev = cell(sdkRegion.ar + sdkSelR, sdkRegion.ac + sdkSelC);
    if (prev) prev.style.background = '#fff';
  }
  sdkSelR = +td.dataset.sdkR;
  sdkSelC = +td.dataset.sdkC;
  td.style.background = '#e3f2fd';
}

// 키보드 입력
document.addEventListener('keydown', e => {
  if (!sdkRegion || sdkSelR < 0) return;
  const n = parseInt(e.key);
  if (n >= 1 && n <= 9) {
    sdkBoard[sdkSelR][sdkSelC] = n;
    const td = cell(sdkRegion.ar + sdkSelR, sdkRegion.ac + sdkSelC);
    if (td) { td.textContent = n; td.style.background = '#e3f2fd'; }
  }
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
    sdkBoard[sdkSelR][sdkSelC] = 0;
    const td = cell(sdkRegion.ar + sdkSelR, sdkRegion.ac + sdkSelC);
    if (td) { td.textContent = ''; td.style.background = '#e3f2fd'; }
  }
  // 방향키로 이동
  const moves = { ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1] };
  if (moves[e.key]) {
    e.preventDefault();
    const [dr, dc] = moves[e.key];
    const nr = Math.max(0, Math.min(8, sdkSelR + dr));
    const nc = Math.max(0, Math.min(8, sdkSelC + dc));
    const ntd = cell(sdkRegion.ar + nr, sdkRegion.ac + nc);
    if (ntd && ntd.dataset.sdkFixed !== '1') { handleSdkClick(ntd); }
  }
});

// 스도쿠 정답 체크
function checkSudokuAnswer() {
  if (!sdkRegion) { alert('수치 분석 항목이 로드되지 않았습니다.'); return; }
  // 행/열/박스 중복 체크
  for (let i = 0; i < 9; i++) {
    const row = sdkBoard[i].filter(Boolean);
    const col = sdkBoard.map(r => r[i]).filter(Boolean);
    if (new Set(row).size !== row.length || new Set(col).size !== col.length) {
      document.getElementById('status-txt').textContent = '⚠ 중복된 수치가 있습니다. 재확인하세요.';
      return;
    }
  }
  // 빈칸 확인
  if (sdkBoard.some(r => r.some(v => v === 0))) {
    document.getElementById('status-txt').textContent = '진행 중입니다. 빈 칸을 모두 채워주세요.';
    return;
  }
  // 정답 비교
  let correct = true;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++)
    if (sdkBoard[r][c] !== sdkAnswer[r][c]) { correct = false; break; }
  if (correct) {
    document.getElementById('win-msg').textContent = '"' + SDK_DATA[sdkCurLevel][sdkCurIdx].title + '" 수치 검증 완료';
    document.getElementById('modal-win').classList.remove('hidden');
  } else {
    document.getElementById('status-txt').textContent = '⚠ 수치가 일치하지 않습니다. 다시 확인하세요.';
  }
}
let sdkCurLevel = '', sdkCurIdx = 0;

// ── openList / verifyNow 에 스도쿠 분기 추가 ──
const _origOpenList = openList;
openList = function(level) {
  if (level.startsWith('sdk-')) {
    openSdkList(level);
  } else {
    _origOpenList(level);
  }
};

function openSdkList(level) {
  const labels = { 'sdk-easy':'수치 입력 검토 항목', 'sdk-mid':'표준 수식 분석 항목', 'sdk-hard':'심층 통계 감사 항목' };
  document.getElementById('list-title').textContent = labels[level] || '수치 분석 항목';
  const body = document.getElementById('list-body');
  body.innerHTML = '';
  const list = SDK_DATA[level] || [];
  const solved = getSolved();
  list.forEach((p, i) => {
    const done = !!solved['sdk_' + level + '_' + i];
    const row = document.createElement('div');
    row.className = 'li-row' + (done ? ' done' : '');
    row.innerHTML = '<span class="li-num">' + String(i+1).padStart(3,'0') + '</span>'
      + '<span>' + p.title + '</span>'
      + '<span class="li-st">' + (done ? '✔ 완료' : '대기') + '</span>';
    row.addEventListener('click', () => {
      closeModal('modal-list');
      sdkCurLevel = level; sdkCurIdx = i;
      loadSudokuIntoGrid(level, i);
    });
    body.appendChild(row);
  });
  document.getElementById('modal-list').classList.remove('hidden');
}

const _origVerify = verifyNow;
verifyNow = function() {
  if (sdkRegion) checkSudokuAnswer();
  else _origVerify();
};

const _origReset = resetPuz;
resetPuz = function() {
  if (sdkRegion) {
    sdkBoard = sdkOrig.map(r => [...r]);
    sdkSelR = -1; sdkSelC = -1;
    loadSudokuIntoGrid(sdkCurLevel, sdkCurIdx);
  } else {
    _origReset();
  }
};

// gtbody 클릭에서 스도쿠 셀 처리 (이벤트 위임 확장)
document.getElementById('gtbody').addEventListener('click', e => {
  const td = e.target.closest('td[data-sdk]');
  if (td && sdkRegion) handleSdkClick(td);
});

// ══════════════════════════════════════════
// 20. 공유 버튼 (D26 = row 25, col 3)
// ══════════════════════════════════════════
const SHARE_R = 25, SHARE_C = 3;  // D열 26행 (0-based)

function renderShareBtn() {
  const btn = cell(SHARE_R, SHARE_C);
  const info = cell(SHARE_R + 1, SHARE_C);
  if (!btn) return;

  btn.innerHTML = '<button onclick="doShare()" style="'
    + 'width:100%;height:100%;border:1px solid #1f6b3e;background:#f0faf5;'
    + 'color:#1f6b3e;font-size:10px;font-weight:600;cursor:pointer;'
    + 'border-radius:2px;white-space:nowrap;padding:0 4px;">⬆ 공유</button>';
  btn.style.padding = '2px';
  btn.dataset.shareBtn = '1';

  if (info) {
    const cnt = Number(localStorage.getItem('wl_shareCount') || 0);
    info.innerHTML = '<span style="font-size:9px;color:#888;white-space:nowrap;">'
      + (cnt > 0 ? '공유 ' + cnt + '회 — 많아지면 새 단계 추가!' : '공유 수가 많아지면<br>새로운 단계가 추가됩니다!')
      + '</span>';
    info.style.padding = '2px';
    info.dataset.shareInfo = '1';
  }
}

function clearShareBtn() {
  const btn = cell(SHARE_R, SHARE_C);
  const info = cell(SHARE_R + 1, SHARE_C);
  if (btn && btn.dataset.shareBtn) {
    btn.innerHTML = ''; btn.style.padding = '';
    const f = fakeVal(SHARE_R, SHARE_C); btn.textContent = f.v; btn.style.cssText = f.st || '';
    delete btn.dataset.shareBtn;
  }
  if (info && info.dataset.shareInfo) {
    info.innerHTML = ''; info.style.padding = '';
    const f = fakeVal(SHARE_R + 1, SHARE_C); info.textContent = f.v; info.style.cssText = f.st || '';
    delete info.dataset.shareInfo;
  }
}

function doShare() {
  const shareData = { title: document.title, url: location.href };
  const cnt = Number(localStorage.getItem('wl_shareCount') || 0) + 1;
  localStorage.setItem('wl_shareCount', cnt);
  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    navigator.clipboard && navigator.clipboard.writeText(location.href).then(() => {
      document.getElementById('status-txt').textContent = '링크가 클립보드에 복사되었습니다.';
    });
  }
  const info = cell(SHARE_R + 1, SHARE_C);
  if (info) {
    info.innerHTML = '<span style="font-size:9px;color:#1f6b3e;white-space:nowrap;">'
      + '공유 ' + cnt + '회 — 많아지면 새 단계 추가!</span>';
  }
}

// ══════════════════════════════════════════
// 18. 초기화
// ══════════════════════════════════════════
buildGrid();
applySel(0,0,0,0);

