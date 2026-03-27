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
  t.addEventListener('click',()=>{document.querySelectorAll('.stab').forEach(x=>x.classList.remove('active'));t.classList.add('active');});
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
// 18. 초기화
// ══════════════════════════════════════════
buildGrid();
applySel(0,0,0,0);
