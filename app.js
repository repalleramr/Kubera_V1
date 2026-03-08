let appState={axyapatra:30000,startAxyapatra:30000,chakra:1,yNums:{},kNums:{}};
let settings={targetUsd:1000,targetPct:10,stopLoss:10000,minBet:100,maxBet:5000,multiple:1,isDouble:false,maxSteps:5,safetyReserve:5000,capRule:true,payoutMultiplier:9};
let ladder=[],stateHistory=[],visualTimeline=[],pendingY=null,pendingK=null;
let drishtiStats={roundsPlayed:0,totalBets:0,netProfit:0,maxExposure:0,numData:{}};
const STORAGE_KEY='KUBERA_WARHUNT_V2_ARCHIVE';
const formatCompact=(num)=>num>=1000?((num%1000===0)?(num/1000)+'k':(num/1000).toFixed(1)+'k'):num;
const formatCurrency=(num)=>new Intl.NumberFormat('en-IN').format(num);

function initNumbersState(){
  appState.yNums={}; appState.kNums={};
  for(let i=1;i<=9;i++){appState.yNums[i]={state:'INACTIVE',step:0};appState.kNums[i]={state:'INACTIVE',step:0};}
}
function initDrishtiData(){
  drishtiStats.numData={};
  ['Y','K'].forEach(side=>{for(let i=1;i<=9;i++){drishtiStats.numData[`${side}_${i}`]={activationRound:'-',repeatRound:'-',winStep:'-',netProfit:0,capOccurrence:0};}});
}
function injectModalStyles(){
  if(document.getElementById('kubera-modal-styles')) return;
  const style=document.createElement('style');
  style.id='kubera-modal-styles';
  style.innerHTML=`
  .kubera-toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#ffd700;color:#000;padding:10px 20px;border-radius:4px;z-index:10000;font-weight:bold;animation:fadeOut 3s forwards;pointer-events:none;text-transform:uppercase;}
  .kubera-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:9999;}
  .kubera-modal{background:#0a1128;border:2px solid #ff4500;padding:20px;border-radius:8px;text-align:center;color:white;width:80%;max-width:400px;text-transform:uppercase;}
  .kubera-modal h3{color:#ff4500;margin-bottom:15px;}
  .kubera-modal-btns{display:flex;gap:10px;margin-top:20px;}
  .kubera-modal-btns button{flex:1;padding:10px;background:#111d40;color:white;border:1px solid #ffd700;cursor:pointer;border-radius:4px;font-weight:bold;}
  @keyframes fadeOut{0%{opacity:1;}80%{opacity:1;}100%{opacity:0;}}`;
  document.head.appendChild(style);
}
function showToast(msg){const t=document.createElement('div');t.className='kubera-toast';t.innerText=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3000);}
function showModal(title,msg,onContinue,onEnd){
  const overlay=document.createElement('div');overlay.className='kubera-overlay';
  const buttons=(onContinue||onEnd)?`<div class="kubera-modal-btns">${onContinue?'<button id="k-mod-cont">Continue</button>':''}${onEnd?'<button id="k-mod-end">End</button>':''}</div>`:`<div class="kubera-modal-btns"><button id="k-mod-ok">Acknowledge</button></div>`;
  overlay.innerHTML=`<div class="kubera-modal"><h3>${title}</h3><p>${msg}</p>${buttons}</div>`;
  document.body.appendChild(overlay);
  if(onContinue) document.getElementById('k-mod-cont').onclick=()=>{overlay.remove();onContinue();};
  if(onEnd) document.getElementById('k-mod-end').onclick=()=>{overlay.remove();onEnd();};
  if(!onContinue&&!onEnd) document.getElementById('k-mod-ok').onclick=()=>overlay.remove();
}

function saveArchive(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify({visualTimeline,history:document.getElementById('history-body').innerHTML}));
}
function loadArchive(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const data=JSON.parse(raw);
    visualTimeline=data.visualTimeline||[];
    if(data.history) document.getElementById('history-body').innerHTML=data.history;
  }catch(e){}
}

function bindEvents(){
  document.querySelectorAll('.num-btn').forEach(btn=>btn.addEventListener('click',e=>handleInput(e.target.getAttribute('data-side'),parseInt(e.target.getAttribute('data-val'),10))));
  document.getElementById('btn-undo').onclick=undo;
  document.getElementById('btn-clear').onclick=clearKumbha;
  document.getElementById('btn-new').onclick=startNewPrayoga;
  document.getElementById('btn-apply-yantra').onclick=applyYantra;
  document.getElementById('btn-export-medha-csv').onclick=exportMedhaCSV;
  document.getElementById('btn-clear-medha-archive').onclick=()=>{localStorage.removeItem(STORAGE_KEY);showToast('SACRED ARCHIVE PURGED');};
  document.getElementById('btn-export-granth').onclick=exportHistoryCSV;
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',e=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    const target=e.target.closest('.nav-btn').getAttribute('data-target');
    e.target.closest('.nav-btn').classList.add('active');
    document.getElementById(target).classList.add('active');
    if(target==='timeline') renderTimeline();
    if(target==='vyuha') renderVyuha();
  }));
}

function syncSettingsFromUI(){
  appState.startAxyapatra=parseInt(document.getElementById('set-axyapatra').value)||30000;
  settings.targetUsd=parseInt(document.getElementById('set-target-usd').value)||1000;
  settings.targetPct=parseInt(document.getElementById('set-target-pct').value)||10;
  settings.stopLoss=parseInt(document.getElementById('set-stop-loss').value)||10000;
  settings.minBet=parseInt(document.getElementById('set-min-bet').value)||100;
  settings.maxBet=parseInt(document.getElementById('set-max-bet').value)||5000;
  settings.multiple=parseInt(document.getElementById('set-multiple').value)||1;
  settings.isDouble=document.getElementById('set-double-ladder').checked;
  settings.maxSteps=parseInt(document.getElementById('set-max-steps').value)||5;
  settings.safetyReserve=parseInt(document.getElementById('set-safety').value)||5000;
  settings.capRule=document.getElementById('set-cap-rule').checked;
}
function rebuildLadder(){
  ladder=[]; let currentAmt=settings.minBet*settings.multiple;
  for(let i=1;i<=Math.max(10,settings.maxSteps);i++){ladder.push({step:i,amount:Math.min(currentAmt,settings.maxBet)}); currentAmt=settings.isDouble?currentAmt*2:currentAmt+(settings.minBet*settings.multiple);}
}
function applyYantra(){syncSettingsFromUI();rebuildLadder();document.getElementById('start-axyapatra').innerText=appState.startAxyapatra;updateAllUI();showToast('YANTRA APPLIED');}
function getBet(step){if(step<1)return 0; const s=Math.min(step,settings.maxSteps); return ladder[s-1]?ladder[s-1].amount:0;}

function handleInput(side,val){
  if(side==='Y') pendingY=val; if(side==='K') pendingK=val; highlightPending();
  if(pendingY!==null&&pendingK!==null){processChakra(pendingY,pendingK); pendingY=null; pendingK=null; highlightPending();}
}
function highlightPending(){
  document.querySelectorAll('.num-btn').forEach(btn=>{
    const side=btn.getAttribute('data-side'), val=parseInt(btn.getAttribute('data-val'),10);
    if((side==='Y'&&val===pendingY)||(side==='K'&&val===pendingK)){btn.style.boxShadow='inset 0 0 10px #ffd700';btn.style.background='#ffd700';btn.style.color='black';}
    else{btn.style.boxShadow='';btn.style.background='';btn.style.color='';}
  });
}

function processChakra(yVal,kVal){
  stateHistory.push(JSON.parse(JSON.stringify({appState,drishtiStats,visualTimeline})));
  let roundExposure=0, roundBetsCount=0, roundEvents=[];
  const calcExposure=dict=>{for(let i=1;i<=9;i++){if(dict[i].state==='ACTIVE'){roundExposure+=getBet(dict[i].step);roundBetsCount++;}}};
  calcExposure(appState.yNums); calcExposure(appState.kNums);
  appState.axyapatra-=roundExposure;
  drishtiStats.totalBets+=roundBetsCount; drishtiStats.roundsPlayed++;
  if(roundExposure>drishtiStats.maxExposure) drishtiStats.maxExposure=roundExposure;
  let isCapReturnTriggered=false;

  const advanceStep=(obj,statKey,sideStr,num)=>{
    obj.step++;
    if(obj.step>settings.maxSteps){
      if(settings.capRule){obj.state='CAP'; obj.step=settings.maxSteps; drishtiStats.numData[statKey].capOccurrence++; roundEvents.push({side:sideStr,num,type:'CAP'});}
      else obj.step=settings.maxSteps;
    }
  };

  const processSide=(val,dict,sideStr)=>{
    if(val===0){
      for(let i=1;i<=9;i++) if(dict[i].state==='ACTIVE') advanceStep(dict[i],`${sideStr}_${i}`,sideStr,i);
      return;
    }
    for(let i=1;i<=9;i++){
      const obj=dict[i], stat=drishtiStats.numData[`${sideStr}_${i}`];
      if(i===val){
        if(obj.state==='INACTIVE'){obj.state='ACTIVE';obj.step=1;stat.activationRound=appState.chakra;roundEvents.push({side:sideStr,num:i,type:'ACTIVATE'});}
        else if(obj.state==='ACTIVE'){
          const currentBet=getBet(obj.step), payout=currentBet*settings.payoutMultiplier;
          let totalInvested=0; for(let s=1;s<=obj.step;s++) totalInvested+=getBet(s);
          const profitAmount=payout-totalInvested;
          appState.axyapatra+=payout; stat.netProfit+=profitAmount; stat.repeatRound=appState.chakra; stat.winStep=obj.step;
          roundEvents.push({side:sideStr,num:i,type:'REPEAT'}); obj.state='LOCKED'; roundEvents.push({side:sideStr,num:i,type:'WIN'}); showToast('TREASURY TRIUMPH');
        } else if(obj.state==='CAP'){isCapReturnTriggered=true; roundEvents.push({side:sideStr,num:i,type:'CAP RETURN'});}
      } else if(obj.state==='ACTIVE'){advanceStep(obj,`${sideStr}_${i}`,sideStr,i);}
    }
  };

  processSide(yVal,appState.yNums,'Y');
  processSide(kVal,appState.kNums,'K');

  visualTimeline.push({chakra:appState.chakra,yVal,kVal,events:roundEvents});
  addHistoryRow(appState.chakra,yVal,kVal,roundExposure,appState.axyapatra);
  appState.chakra++;
  drishtiStats.netProfit=appState.axyapatra-appState.startAxyapatra;
  checkThresholds(); updateAllUI(); saveArchive();
  if(isCapReturnTriggered) showModal('CAP RETURNED','A capped number has returned.',()=>{},()=>clearKumbha());
}

function checkThresholds(){
  if(appState.axyapatra<=(appState.startAxyapatra-settings.stopLoss)) showModal('TREASURY WARNING',`Axyapatra reached Stop Loss (Down by ₹${settings.stopLoss})`);
  else if(appState.axyapatra<=settings.safetyReserve) showModal('TREASURY WARNING',`Axyapatra reached Safety Reserve (₹${settings.safetyReserve})`);
}
function undo(){
  if(stateHistory.length===0){showToast('No history to undo'); return;}
  const prev=stateHistory.pop();
  appState=prev.appState; drishtiStats=prev.drishtiStats; visualTimeline=prev.visualTimeline;
  const tbody=document.getElementById('history-body'); if(tbody.firstElementChild) tbody.removeChild(tbody.firstElementChild);
  updateAllUI(); saveArchive(); showToast('UNDO SUCCESSFUL');
}
function clearKumbha(){appState.chakra=1; initNumbersState(); stateHistory=[]; visualTimeline=[]; pendingY=null; pendingK=null; highlightPending(); updateAllUI(); saveArchive(); showToast('KUMBHA RESET');}
function startNewPrayoga(){
  appState.chakra=1; initNumbersState(); stateHistory=[]; visualTimeline=[];
  const tbody=document.getElementById('history-body');
  if(tbody.innerHTML.trim()!=='') tbody.insertAdjacentHTML('afterbegin',`<tr style="background:#2a3f70;"><td colspan="5" style="color:#ffd700;font-weight:bold;text-align:center;">--- NEW PRAYOGA ---</td></tr>`);
  pendingY=null; pendingK=null; highlightPending(); updateAllUI(); saveArchive(); showToast('ĀHUTI PRAYOGA READY');
}

function getStatFor(side,num){
  const entry=drishtiStats.numData[`${side}_${num}`];
  const dict=side==='Y'?appState.yNums:appState.kNums;
  const obj=dict[num];
  let capProb=entry.capOccurrence>0?Math.min(100,entry.capOccurrence*25):0;
  let stabilityScore=obj.state==='LOCKED'?30:(obj.state==='ACTIVE'?15-(obj.step*2):0);
  let futureRiskProbability=Math.min(100,(obj.state==='CAP'?90:0)+(obj.state==='ACTIVE'?obj.step*15:0)+capProb);
  return {capProbability:capProb,stabilityScore,futureRiskProbability};
}

function updateRiskMeter(){
  let recentCaps=0;
  const startIdx=Math.max(0,visualTimeline.length-10);
  for(let i=startIdx;i<visualTimeline.length;i++) recentCaps+=visualTimeline[i].events.filter(e=>e.type==='CAP').length;
  let riskScore=Math.min(100,(recentCaps*15)+(drishtiStats.maxExposure/1000)+(Object.values(appState.yNums).filter(n=>n.state==='ACTIVE').length*4)+(Object.values(appState.kNums).filter(n=>n.state==='ACTIVE').length*4));
  let riskLvl='LOW'; const fillPct=Math.min(100,riskScore);
  if(riskScore>75) riskLvl='EXTREME'; else if(riskScore>50) riskLvl='HIGH'; else if(riskScore>25) riskLvl='MEDIUM';
  const rmText=document.getElementById('risk-meter-text'), rmFill=document.getElementById('risk-meter-fill');
  if(rmText) rmText.innerText=riskLvl;
  if(rmFill){rmFill.style.width=fillPct+'%'; rmFill.className='risk-meter-fill '+riskLvl.toLowerCase();}
  const stormBanner=document.getElementById('cap-storm-banner');
  if(stormBanner){
    if(recentCaps>=3){let intensity='LOW'; if(recentCaps>=7) intensity='HIGH'; else if(recentCaps>=5) intensity='MEDIUM'; stormBanner.style.display='block'; document.getElementById('storm-intensity').innerText=intensity;}
    else stormBanner.style.display='none';
  }
}

function renderYKTPanel(){
  let yArr=[], kArr=[], nextExposure=0;
  const mapBets=(dict,arr)=>{for(let i=1;i<=9;i++){if(dict[i].state==='ACTIVE'){const amt=getBet(dict[i].step);arr.push(`${formatCompact(amt)} on ${i}(<span class="step-s${Math.min(dict[i].step,5)}">S${dict[i].step}</span>)`);nextExposure+=amt;}}};
  mapBets(appState.yNums,yArr); mapBets(appState.kNums,kArr);
  document.querySelector('#y-plan .content').innerHTML=yArr.length?yArr.join(' | '):'--';
  document.querySelector('#k-plan .content').innerHTML=kArr.length?kArr.join(' | '):'--';
  document.querySelector('#t-plan .content').innerText=formatCompact(nextExposure);
}
function renderVyuha(){
  const yGrid=document.getElementById('vyuha-y'), kGrid=document.getElementById('vyuha-k');
  if(!yGrid||!kGrid) return;
  yGrid.innerHTML=''; kGrid.innerHTML='';
  const buildTile=(num,obj,side)=>{
    let cssClass='heatmap-normal';
    const stat=getStatFor(side,num);
    if(obj.state==='CAP') cssClass='heatmap-cap';
    else if(obj.state==='LOCKED') cssClass='heatmap-locked';
    else if(obj.state!=='INACTIVE'){
      if(stat.futureRiskProbability>70) cssClass='heatmap-danger';
      else if(stat.capProbability>40) cssClass='heatmap-risk';
      else if(stat.stabilityScore>20) cssClass='heatmap-safe';
    }
    if(obj.state==='INACTIVE') cssClass='heatmap-inactive';
    const pct=(obj.state==='INACTIVE'||obj.state==='LOCKED')?0:Math.min(100,(obj.step/settings.maxSteps)*100);
    return `<div class="vyuha-tile ${cssClass}"><div class="vyuha-progress" style="height:${pct}%;"></div><div style="position:relative;z-index:2;text-align:center;"><span style="font-size:1.2rem;">${num}</span><br><span style="font-size:0.6rem;opacity:0.9;">S${obj.step}</span></div></div>`;
  };
  for(let i=1;i<=9;i++){yGrid.innerHTML+=buildTile(i,appState.yNums[i],'Y');kGrid.innerHTML+=buildTile(i,appState.kNums[i],'K');}
}
function renderTimeline(){
  const container=document.getElementById('timeline-body'); if(!container) return; container.innerHTML='';
  for(let i=visualTimeline.length-1;i>=0;i--){
    const item=visualTimeline[i];
    const eventHtml=item.events.map(e=>{let cls='te-activate'; if(e.type==='REPEAT') cls='te-repeat'; if(e.type==='WIN') cls='te-win'; if(e.type.includes('CAP')) cls='te-cap'; return `<span class="t-event-badge ${cls}">${e.side}${e.num} ${e.type}</span>`;}).join('');
    container.innerHTML+=`<div class="timeline-row"><div class="t-chakra">${item.chakra}</div><div class="t-result">Y${item.yVal===0?'-':item.yVal} K${item.kVal===0?'-':item.kVal}</div><div class="t-events">${eventHtml}</div></div>`;
  }
}
function renderSopana(){
  const tbody=document.getElementById('ladder-body'); if(!tbody) return; tbody.innerHTML='';
  const displayLimit=Math.max(settings.maxSteps,ladder.length);
  for(let i=0;i<displayLimit;i++){if(!ladder[i]) break; tbody.innerHTML+=`<tr><td>S${ladder[i].step}</td><td><input type="number" class="ladder-input" data-idx="${i}" value="${ladder[i].amount}"></td></tr>`;}
  document.querySelectorAll('.ladder-input').forEach(inp=>inp.addEventListener('change',e=>{const idx=parseInt(e.target.getAttribute('data-idx'),10); ladder[idx].amount=parseInt(e.target.value,10)||0; updateAllUI();}));
}
function renderDrishti(){
  document.getElementById('stat-rounds').innerText=Math.max(0,appState.chakra-1);
  document.getElementById('stat-bets').innerText=drishtiStats.totalBets;
  document.getElementById('stat-profit').innerText=formatCurrency(drishtiStats.netProfit);
  document.getElementById('stat-exposure').innerText=formatCurrency(drishtiStats.maxExposure);
}
function addHistoryRow(chakra,y,k,bet,bank){document.getElementById('history-body').insertAdjacentHTML('afterbegin',`<tr><td>${chakra}</td><td>${y===0?'0':y}</td><td>${k===0?'0':k}</td><td>${bet}</td><td>${formatCurrency(bank)}</td></tr>`);}
function exportHistoryCSV(){
  let csv='Chakra,Yaksha,Kinnara,Ahuti,Axyapatra\n';
  document.querySelectorAll('#history-body tr').forEach(tr=>{
    const tds=tr.querySelectorAll('td'); if(tds.length===5){csv += [...tds].map(td=>td.innerText.replace(/,/g,'')).join(',')+'\n';}
  });
  const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='KUBERA_GRANTH_HISTORY.csv'; a.click();
}
function exportMedhaCSV(){
  let csv='Chakra,Y,K,Events\n';
  visualTimeline.forEach(item=>{csv += `${item.chakra},${item.yVal},${item.kVal},"${item.events.map(e=>`${e.side}${e.num} ${e.type}`).join(' | ')}"\n`;});
  const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='KUBERA_MEDHA_V2_TIMELINE.csv'; a.click();
}
function updateAllUI(){
  document.getElementById('live-axyapatra').innerText=formatCurrency(appState.axyapatra);
  document.getElementById('start-axyapatra').innerText=formatCurrency(appState.startAxyapatra);
  document.getElementById('current-chakra').innerText=appState.chakra;
  renderYKTPanel(); renderVyuha(); renderSopana(); renderDrishti(); renderTimeline(); updateRiskMeter();
}
function initEngine(){
  initNumbersState(); initDrishtiData(); bindEvents(); syncSettingsFromUI(); rebuildLadder();
  appState.axyapatra=appState.startAxyapatra||30000; appState.startAxyapatra=appState.axyapatra;
  injectModalStyles(); loadArchive(); updateAllUI();
  if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});}
}
window.addEventListener('load',initEngine);
