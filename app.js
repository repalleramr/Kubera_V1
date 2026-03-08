let appState={axyapatra:30000,startAxyapatra:30000,chakra:1,yNums:{},kNums:{}};
let settings={targetUsd:500,targetPct:1.67,stopLoss:2000,coinSize:100,maxBet:3000,isDouble:true,maxSteps:12,safetyReserve:20000,capRule:true,autoScale:false};
let ladder=[],stateHistory=[],visualTimeline=[],pendingY=null,pendingK=null;
let drishtiStats={roundsPlayed:0,totalBets:0,netProfit:0,maxExposure:0,numData:{}};

const formatCompact=(num)=>num>=1000?((num%1000===0)?(num/1000)+'k':(num/1000).toFixed(1)+'k'):num;
const formatCurrency=(num)=>new Intl.NumberFormat('en-IN').format(num);

function showToast(msg){
  let root=document.getElementById('toast-root');
  if(!root){
    root=document.createElement('div');
    root.id='toast-root';
    root.style.position='fixed';
    root.style.top='14px';
    root.style.left='0';
    root.style.right='0';
    root.style.display='flex';
    root.style.justifyContent='center';
    root.style.pointerEvents='none';
    root.style.zIndex='99999';
    document.body.appendChild(root);
  }
  const el=document.createElement('div');
  el.className='toast';
  el.textContent=msg;
  root.appendChild(el);
  setTimeout(()=>el.remove(),2500);
}
function showModal(title,msg){
  const overlay=document.createElement('div');
  overlay.className='overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:6000;';
  overlay.innerHTML=`<div style="background:#0a1128;border:2px solid #ff4500;border-radius:14px;padding:20px;max-width:340px;width:85%;text-align:center;color:white"><h3 style="margin:0 0 10px;color:#ff4500">${title}</h3><p style="margin:0 0 14px">${msg}</p><button style="padding:10px 20px;border:none;border-radius:10px;background:#ffd700;color:#111;font-weight:bold">OK</button></div>`;
  overlay.querySelector('button').onclick=()=>overlay.remove();
  document.body.appendChild(overlay);
}

function initNumbersState(){
  appState.yNums={}; appState.kNums={};
  for(let i=1;i<=9;i++){appState.yNums[i]={state:'INACTIVE',step:0};appState.kNums[i]={state:'INACTIVE',step:0};}
}
function initDrishtiData(){
  drishtiStats.numData={};
  ['Y','K'].forEach(side=>{for(let i=1;i<=9;i++) drishtiStats.numData[`${side}_${i}`]={activationRound:'-',repeatRound:'-',winStep:'-',netProfit:0,capOccurrence:0};});
}
function getActiveCoinSize(){
  if(!settings.autoScale) return settings.coinSize;
  if(appState.axyapatra<=20000) return 50;
  if(appState.axyapatra<=50000) return 100;
  return 500;
}
function rebuildLadder(){
  ladder=[]; let currentAmt=getActiveCoinSize();
  for(let i=1;i<=Math.max(15,settings.maxSteps);i++){
    ladder.push({step:i,amount:Math.min(currentAmt,settings.maxBet)});
    if(settings.isDouble) currentAmt*=2; else currentAmt+=getActiveCoinSize();
  }
}
function bindKeypads(){
  const padY=document.getElementById('padY'), padK=document.getElementById('padK');
  padY.innerHTML=''; padK.innerHTML='';
  const make=(side,val)=>{const b=document.createElement('button');b.className='num-btn';b.textContent=val;b.onclick=()=>handleInput(side,val);return b;};
  for(let i=1;i<=9;i++) padY.appendChild(make('Y',i));
  const e1=document.createElement('div'); e1.className='empty'; padY.appendChild(e1);
  padY.appendChild(make('Y',0)); const e2=document.createElement('div'); e2.className='empty'; padY.appendChild(e2);
  for(let i=1;i<=9;i++) padK.appendChild(make('K',i));
  const e3=document.createElement('div'); e3.className='empty'; padK.appendChild(e3);
  padK.appendChild(make('K',0)); const e4=document.createElement('div'); e4.className='empty'; padK.appendChild(e4);
}
function handleInput(side,val){
  if(side==='Y') pendingY=val;
  if(side==='K') pendingK=val;
  highlightPending();
  if(pendingY!==null && pendingK!==null){
    processChakra(pendingY,pendingK);
    pendingY=null; pendingK=null;
    highlightPending();
  }
}
function highlightPending(){
  document.querySelectorAll('.num-btn').forEach(btn=>{
    const parent=btn.parentElement.id==='padY'?'Y':'K';
    const val=parseInt(btn.textContent,10);
    if((parent==='Y'&&val===pendingY)||(parent==='K'&&val===pendingK)){btn.style.boxShadow='inset 0 0 10px #ffd700';btn.style.background='#ffd700';btn.style.color='#111';}
    else{btn.style.boxShadow='';btn.style.background='';btn.style.color='';}
  });
}
function getBet(step){
  if(step<1) return 0;
  const s=Math.min(step,settings.maxSteps);
  return ladder[s-1]?ladder[s-1].amount:0;
}
function pushEvent(roundEvents,side,num,type){roundEvents.push({side,num,type});}

function processChakra(yVal,kVal){
  stateHistory.push(JSON.parse(JSON.stringify({appState,drishtiStats,visualTimeline,settings})));
  const prevCoin=getActiveCoinSize();
  let roundExposure=0, roundBetsCount=0, roundEvents=[];
  const calcExposure=(dict)=>{for(let i=1;i<=9;i++){if(dict[i].state==='ACTIVE'){roundExposure+=getBet(dict[i].step);roundBetsCount++;}}};
  calcExposure(appState.yNums); calcExposure(appState.kNums);
  appState.axyapatra-=roundExposure;
  drishtiStats.totalBets+=roundBetsCount; drishtiStats.roundsPlayed++;
  if(roundExposure>drishtiStats.maxExposure) drishtiStats.maxExposure=roundExposure;
  let capReturned=false;

  const advanceStep=(obj,statKey,side,num)=>{
    obj.step++;
    if(obj.step>settings.maxSteps){
      if(settings.capRule){obj.state='CAP';obj.step=settings.maxSteps;drishtiStats.numData[statKey].capOccurrence++;pushEvent(roundEvents,side,num,'CAP');}
      else obj.step=settings.maxSteps;
    }
  };

  const processSide=(val,dict,side)=>{
    if(val===0){
      for(let i=1;i<=9;i++) if(dict[i].state==='ACTIVE') advanceStep(dict[i],`${side}_${i}`,side,i);
      return;
    }
    for(let i=1;i<=9;i++){
      const obj=dict[i], stat=drishtiStats.numData[`${side}_${i}`];
      if(i===val){
        if(obj.state==='INACTIVE'){
          obj.state='ACTIVE'; obj.step=1; stat.activationRound=appState.chakra; pushEvent(roundEvents,side,i,'ACTIVATE');
        } else if(obj.state==='ACTIVE'){
          const currentBet=getBet(obj.step), payout=currentBet*9;
          let totalInvested=0; for(let s=1;s<=obj.step;s++) totalInvested+=getBet(s);
          const profitAmount=payout-totalInvested;
          appState.axyapatra+=payout; stat.netProfit+=profitAmount; stat.repeatRound=appState.chakra; stat.winStep=obj.step;
          pushEvent(roundEvents,side,i,'REPEAT'); obj.state='LOCKED'; pushEvent(roundEvents,side,i,'WIN');
          showToast('TREASURY TRIUMPH');
        } else if(obj.state==='CAP'){capReturned=true; pushEvent(roundEvents,side,i,'CAP RETURN');}
      } else if(obj.state==='ACTIVE'){
        advanceStep(obj,`${side}_${i}`,side,i);
      }
    }
  };

  processSide(yVal,appState.yNums,'Y');
  processSide(kVal,appState.kNums,'K');

  visualTimeline.push({chakra:appState.chakra,yVal,kVal,events:roundEvents});
  addHistoryRow(appState.chakra,yVal,kVal,roundExposure,appState.axyapatra);
  appState.chakra++;
  drishtiStats.netProfit=appState.axyapatra-appState.startAxyapatra;

  const newCoin=getActiveCoinSize();
  if(settings.autoScale && newCoin!==prevCoin){rebuildLadder();showToast(`PRAYOGA SCALE SHIFTED · Coin Size ${newCoin}`);}

  checkThresholds();
  updateAllUI();
  if(capReturned) showModal('CAP RETURNED','A capped number has returned.');
}
function checkThresholds(){
  const targetValue=appState.startAxyapatra + settings.targetUsd;
  if(appState.axyapatra>=targetValue) showToast('TREASURY TARGET ACHIEVED');
  if(appState.axyapatra<=(appState.startAxyapatra-settings.stopLoss)) showModal('TREASURY WARNING',`Axyapatra reached Stop Loss (Down by ₹${settings.stopLoss})`);
  else if(appState.axyapatra<=settings.safetyReserve) showModal('TREASURY WARNING',`Axyapatra reached Safety Reserve (₹${settings.safetyReserve})`);
}
function undo(){
  if(stateHistory.length===0){showToast('NO HISTORY TO UNDO');return;}
  const prev=stateHistory.pop();
  appState=prev.appState; drishtiStats=prev.drishtiStats; visualTimeline=prev.visualTimeline; settings=prev.settings;
  const tbody=document.getElementById('history-body'); if(tbody.firstElementChild) tbody.removeChild(tbody.firstElementChild);
  updateAllUI(); showToast('UNDO SUCCESSFUL');
}
function clearKumbha(){appState.chakra=1;initNumbersState();stateHistory=[];visualTimeline=[];pendingY=null;pendingK=null;highlightPending();updateAllUI();showToast('KUMBHA RESET');}
function startNewPrayoga(){appState.chakra=1;initNumbersState();stateHistory=[];visualTimeline=[];pendingY=null;pendingK=null;highlightPending();updateAllUI();showToast('ĀHUTI PRAYOGA READY');}

function updateRiskMeter(){
  let recentCaps=0;
  const startIdx=Math.max(0,visualTimeline.length-10);
  for(let i=startIdx;i<visualTimeline.length;i++) recentCaps+=visualTimeline[i].events.filter(e=>e.type==='CAP').length;
  let riskScore=Math.min(100,(recentCaps*14)+(drishtiStats.maxExposure/1000)+(Object.values(appState.yNums).filter(n=>n.state==='ACTIVE').length*3)+(Object.values(appState.kNums).filter(n=>n.state==='ACTIVE').length*3));
  let riskLvl='LOW'; const fillPct=Math.min(100,riskScore);
  if(riskScore>75) riskLvl='EXTREME'; else if(riskScore>50) riskLvl='HIGH'; else if(riskScore>25) riskLvl='MEDIUM';
  const fill=document.getElementById('risk-meter-fill'), text=document.getElementById('risk-meter-text');
  fill.style.width=fillPct+'%'; fill.className='risk-meter-fill '+riskLvl.toLowerCase(); text.textContent=riskLvl;
  const banner=document.getElementById('cap-storm-banner');
  if(recentCaps>=3){let intensity='LOW'; if(recentCaps>=7) intensity='HIGH'; else if(recentCaps>=5) intensity='MEDIUM'; banner.style.display='block'; document.getElementById('storm-intensity').textContent=intensity;}
  else banner.style.display='none';
}
function getStatFor(side,num){
  const entry=drishtiStats.numData[`${side}_${num}`];
  const obj=(side==='Y'?appState.yNums:appState.kNums)[num];
  const capProb=entry.capOccurrence>0?Math.min(100,entry.capOccurrence*25):0;
  const stabilityScore=obj.state==='LOCKED'?30:(obj.state==='ACTIVE'?15-(obj.step*2):0);
  const futureRiskProbability=Math.min(100,(obj.state==='CAP'?90:0)+(obj.state==='ACTIVE'?obj.step*10:0)+capProb);
  return {capProbability:capProb,stabilityScore,futureRiskProbability};
}
function renderYKTPanel(){
  let yArr=[],kArr=[],nextExposure=0;
  const map=(dict,arr)=>{for(let i=1;i<=9;i++){if(dict[i].state==='ACTIVE'){const amt=getBet(dict[i].step);arr.push(`${formatCompact(amt)} on ${i} (S${dict[i].step})`); nextExposure+=amt;}}};
  map(appState.yNums,yArr); map(appState.kNums,kArr);
  document.getElementById('y-plan').innerHTML=yArr.length?yArr.join(' | '):'--';
  document.getElementById('k-plan').innerHTML=kArr.length?kArr.join(' | '):'--';
  document.getElementById('t-plan').innerText=formatCompact(nextExposure);
}
function renderVyuha(){
  const yGrid=document.getElementById('vyuha-y'), kGrid=document.getElementById('vyuha-k');
  yGrid.innerHTML=''; kGrid.innerHTML='';
  const build=(num,obj,side)=>{
    let css='heatmap-normal'; const stat=getStatFor(side,num);
    if(obj.state==='CAP') css='heatmap-cap';
    else if(obj.state==='LOCKED') css='heatmap-locked';
    else if(obj.state==='INACTIVE') css='heatmap-inactive';
    else if(stat.futureRiskProbability>70) css='heatmap-danger';
    else if(stat.capProbability>40) css='heatmap-risk';
    else if(stat.stabilityScore>20) css='heatmap-safe';
    const pct=(obj.state==='INACTIVE'||obj.state==='LOCKED')?0:Math.min(100,(obj.step/settings.maxSteps)*100);
    return `<div class="vyuha-tile ${css}"><div class="vyuha-progress" style="height:${pct}%"></div><div style="position:relative;z-index:2;text-align:center"><span style="font-size:1.2rem">${num}</span><br><span style="font-size:.7rem">S${obj.step}</span></div></div>`;
  };
  for(let i=1;i<=9;i++){yGrid.innerHTML+=build(i,appState.yNums[i],'Y');kGrid.innerHTML+=build(i,appState.kNums[i],'K');}
}
function renderTimeline(){
  const container=document.getElementById('timeline-body'); container.innerHTML='';
  for(let i=visualTimeline.length-1;i>=0;i--){
    const item=visualTimeline[i];
    const eventHtml=item.events.map(e=>{let cls='te-activate'; if(e.type==='REPEAT') cls='te-repeat'; if(e.type==='WIN') cls='te-win'; if(e.type.includes('CAP')) cls='te-cap'; return `<span class="t-event-badge ${cls}">${e.side}${e.num} ${e.type}</span>`;}).join('');
    container.innerHTML+=`<div class="timeline-row"><div class="t-chakra">${item.chakra}</div><div class="t-result">Y${item.yVal===0?'-':item.yVal} K${item.kVal===0?'-':item.kVal}</div><div class="t-events">${eventHtml}</div></div>`;
  }
}
function renderDrishti(){
  document.getElementById('stat-rounds').innerText=Math.max(0,appState.chakra-1);
  document.getElementById('stat-bets').innerText=drishtiStats.totalBets;
  document.getElementById('stat-profit').innerText=formatCurrency(drishtiStats.netProfit);
  document.getElementById('stat-exposure').innerText=formatCurrency(drishtiStats.maxExposure);
}
function renderSopana(){
  const tbody=document.getElementById('ladder-body'); tbody.innerHTML='';
  for(let i=0;i<settings.maxSteps;i++){tbody.innerHTML+=`<tr><td>S${ladder[i].step}</td><td>${formatCurrency(ladder[i].amount)}</td></tr>`;}
}
function addHistoryRow(chakra,y,k,bet,bank){
  document.getElementById('history-body').insertAdjacentHTML('afterbegin',`<tr><td>${chakra}</td><td>${y}</td><td>${k}</td><td>${bet}</td><td>${formatCurrency(bank)}</td></tr>`);
}
function updateAllUI(){
  document.getElementById('live-axyapatra').innerText=formatCurrency(appState.axyapatra);
  document.getElementById('start-axyapatra').innerText=formatCurrency(appState.startAxyapatra);
  document.getElementById('current-chakra').innerText=appState.chakra;
  renderYKTPanel(); renderVyuha(); renderTimeline(); renderDrishti(); renderSopana(); updateRiskMeter();
}
function bindSettings(){
  document.getElementById('btn-undo').onclick=undo;
  document.getElementById('btn-clear').onclick=clearKumbha;
  document.getElementById('btn-new').onclick=startNewPrayoga;

  const elAxyapatra=document.getElementById('set-axyapatra');
  const elTargetUsd=document.getElementById('set-target-usd');
  const elTargetPct=document.getElementById('set-target-pct');

  if(elAxyapatra && elTargetUsd && elTargetPct){
    elTargetUsd.addEventListener('input',e=>{
      const axy=parseFloat(elAxyapatra.value)||0;
      const usd=parseFloat(e.target.value)||0;
      if(axy>0) elTargetPct.value=((usd/axy)*100).toFixed(2);
    });

    elTargetPct.addEventListener('input',e=>{
      const axy=parseFloat(elAxyapatra.value)||0;
      const pct=parseFloat(e.target.value)||0;
      if(axy>0) elTargetUsd.value=((pct/100)*axy).toFixed(2);
    });

    elAxyapatra.addEventListener('input',()=>{
      const axy=parseFloat(elAxyapatra.value)||0;
      const usd=parseFloat(elTargetUsd.value)||0;
      if(axy>0 && usd>=0) elTargetPct.value=((usd/axy)*100).toFixed(2);
    });
  }

  document.getElementById('btn-apply-yantra').onclick=()=>{
    appState.startAxyapatra=parseInt(document.getElementById('set-axyapatra').value)||30000;
    settings.targetUsd=parseInt(document.getElementById('set-target-usd').value)||500;
    settings.targetPct=parseFloat(document.getElementById('set-target-pct').value)||1.67;
    settings.stopLoss=parseInt(document.getElementById('set-stop-loss').value)||2000;
    settings.coinSize=parseInt(document.getElementById('set-coin-size').value)||100;
    settings.maxBet=parseInt(document.getElementById('set-max-bet').value)||3000;
    settings.isDouble=document.getElementById('set-double-ladder').checked;
    settings.maxSteps=parseInt(document.getElementById('set-max-steps').value)||12;
    settings.safetyReserve=parseInt(document.getElementById('set-safety').value)||20000;
    settings.capRule=document.getElementById('set-cap-rule').checked;
    settings.autoScale=document.getElementById('set-auto-scale').checked;
    rebuildLadder(); updateAllUI(); showToast('YANTRA APPLIED');
  };
  document.querySelectorAll('.nav-btn').forEach(btn=>btn.onclick=(e)=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    const target=e.currentTarget.getAttribute('data-target');
    e.currentTarget.classList.add('active');
    document.getElementById(target).classList.add('active');
  });
}
function init(){
  initNumbersState(); initDrishtiData(); rebuildLadder(); bindKeypads(); bindSettings(); updateAllUI();
}
window.addEventListener('load',init);
