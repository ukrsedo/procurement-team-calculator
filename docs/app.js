'use strict';
const $=s=>document.querySelector(s),fmt=n=>Math.round(n).toLocaleString('en-GB'),ft=n=>Number(n.toFixed(2)).toLocaleString('en-GB');
let current=null,baseline=null,scenario=null,dirty=false,jobId=0,timer=null,calculating=false;
const scalar=['teams','target','season','managerCost','seniorCost','juniorCost','vacation','handover','sick','extra','extraShare','turnover','hireMonths','rampMonths','rampPercent','holidays','maxSenior','maxJunior','trials','monthlyBudget'];
const arrays=['annualByType','sla','productivity','procurementTime','hours','juniorHours','review','waitMin','waitMax'];
const fteIds=['managerFte','seniorFte','juniorFte'];
scalar.forEach(k=>$('#'+k).value=Model.defaults[k]);['objective','currency','allocation'].forEach(k=>$('#'+k).value=Model.defaults[k]);
function input(k,i,min,max,step=1){return `<input aria-label="${k}: ${['productivity','procurementTime'].includes(k)?['Manager','Senior','Junior'][i]:Model.TYPES[i]}" type="number" min="${min}" max="${max}" step="${step}" data-key="${k}" value="${Model.defaults[k][i]}">`;}
$('#demand').innerHTML=Model.TYPES.map((t,i)=>`<tr><td>${t}</td><td>${input('annualByType',i,0,5000)}</td><td>${input('sla',i,1,730)}</td></tr>`).join('');
$('#roles').innerHTML=['Manager','Senior','Junior'].map((t,i)=>`<tr><td>${t}</td><td>${input('productivity',i,1,50)}</td><td>${input('procurementTime',i,1,100)}</td></tr>`).join('');
$('#params').innerHTML=Model.TYPES.map((t,i)=>`<tr><td>${t}</td>${['hours','juniorHours','review'].map(k=>`<td>${input(k,i,k==='review'?0:.5,1000,.5)}</td>`).join('')}<td>${input('waitMin',i,0,365)}${input('waitMax',i,0,365)}</td></tr>`).join('');
function money(n,c){return fmt(n)+(c.currency==='units'?'':' '+c.currency);}
function sign(n,digits=1){return(n>0?'+':'')+n.toFixed(digits);}
function objectiveHelp(){const sla=$('#objective').value==='sla';$('#budgetField').hidden=!sla;$('#monthlyBudget').disabled=!sla;$('#objectiveHelp').textContent=sla?'Maximise the lowest SLA compliance across procedures, within the monthly salary budget.':'Find the lowest salary cost that meets the SLA target for every procedure.';}
objectiveHelp();
function getConfig(){const c=structuredClone(Model.defaults);for(const k of scalar)c[k]=+$('#'+k).value;for(const k of ['objective','currency','allocation'])c[k]=$('#'+k).value;for(const k of arrays)c[k]=[...document.querySelectorAll(`[data-key=${k}]`)].map(x=>+x.value);if(!c.annualByType.some(x=>x>0))throw Error('Enter demand for at least one procedure.');if(c.annualByType.reduce((a,b)=>a+b,0)>10000)throw Error('This prototype supports up to 10,000 annual requests.');for(let i=0;i<5;i++)if(c.waitMax[i]<c.waitMin[i])throw Error(`${Model.TYPES[i]}: maximum wait must be at least the minimum.`);return c;}
function markDirty(){dirty=true;$('#state').textContent='Assumptions changed — recalculate recommendation';$('#state').classList.add('dirty');$('#simulate').disabled=true;$('#scenarioStatus').textContent='Recalculate the recommendation before testing changed staffing.';}
document.querySelectorAll('input[type=number]:not(.fte-control),select').forEach(x=>x.addEventListener('input',()=>{markDirty();objectiveHelp();}));
function setFtes(values){fteIds.forEach((id,i)=>$('#'+id).value=values[i]);preview();}
function preview(){if(!current)return;const c=current.config,v=fteIds.map(id=>+$('#'+id).value),mix=Model.staffingMix(c,v);$('#ftePreview').textContent=`Your staffing: ${ft(v.reduce((a,b)=>a+b,0))} FTE · Monthly salary budget: ${money(v[0]*c.managerCost+v[1]*c.seniorCost+v[2]*c.juniorCost,c)} · Seniors: ${mix.counts[1]} of ${mix.headcount} people (${mix.seniorPercent.toFixed(1)}%; maximum 50%)`;}
function scenarioChanged(){
  clearTimeout(timer);preview();$('#result').classList.add('stale');$('#state').textContent='Updating staffing and SLA…';$('#metrics').classList.add('stale');$('#scenarioSummary').classList.add('stale');
  if(!current||dirty){$('#scenarioStatus').textContent='Recalculate the recommendation after changing assumptions.';return;}
  const values=fteIds.map(id=>+$('#'+id).value),error=Model.mixError(current.config,values);
  $('#simulate').disabled=!!error;
  if(error){$('#scenarioStatus').textContent=error;$('#state').textContent='Staffing exceeds the senior limit';$('#result').classList.remove('stale');$('#result').innerHTML=`<div class="input-message"><strong>SLA not calculated for this staffing.</strong><p>${error}</p></div>`;return;}
  $('#scenarioStatus').textContent='Staffing changed — SLA will recalculate automatically…';
  timer=setTimeout(()=>$('#simulate').onclick(),350);
}
fteIds.forEach(id=>$('#'+id).addEventListener('input',scenarioChanged));
document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const field=$('#'+fteIds[+b.dataset.role]);field.value=Math.min(100,Math.max(0,+field.value+ +b.dataset.step));scenarioChanged();});
function renderDashboard(){
 const c=current.config,r=scenario;
 $('#result').classList.remove('stale');
 if(!r){$('#result').innerHTML='<div class="hero"><h2>No recommendation within these limits</h2><p class="small">Review the constraints or test your own staffing below.</p></div>';return;}
 const same=baseline&&r.fteByRole.every((n,i)=>n===baseline.fteByRole[i]);
 const costChange=baseline?r.cost-baseline.cost:null,score=Model.slaScore(r),scoreChange=baseline?score-Model.slaScore(baseline):null;
 $('#result').innerHTML=`<div class="hero"><span class="tag">${same?'RECOMMENDED STAFFING':'YOUR EDITED STAFFING'}</span><h2>Current staffing: ${ft(r.fte)} FTE</h2><div class="role-summary">${['Managers','Senior employees','Junior employees'].map((name,i)=>`<div>${name}<strong>${ft(r.fteByRole[i])} FTE</strong></div>`).join('')}</div><div class="numbers"><div class="number"><strong>${money(r.cost,c)}</strong><span>monthly salary budget</span><small>${costChange===null?'':costChange===0?'Same as recommendation':(costChange<0?'Saving: ':'Additional cost: ')+money(Math.abs(costChange),c)+'/month'}</small></div><div class="number"><strong>${score.toFixed(1)}%</strong><span>lowest SLA compliance · target ${c.target}%</span><small>${scoreChange===null?'':sign(scoreChange)+' percentage points vs recommendation'} · ${r.pass?'Pooled target met':'Pooled target missed'}</small></div></div><div class="sla-strip">${r.metrics.map((m,i)=>{const b=baseline?.metrics[i],delta=b&&b.rate!==null&&m.rate!==null?m.rate-b.rate:null;return `<div class="${m.rate===null?'':m.rate>=c.target?'sla-met':'sla-missed'}"><span>${Model.TYPES[i]}</span><strong>${m.rate===null?'No demand':m.rate.toFixed(1)+'%'}</strong><small>${delta===null?'':sign(delta)+' pp vs recommendation'}</small></div>`;}).join('')}</div><p class="annual-cost">${c.allocation==='pooled'?'Shared workload':'Separate team queues'} · Annual salary budget: ${money(r.cost*12,c)} · Seniors: ${r.mix.seniorPercent.toFixed(1)}% of headcount (maximum 50%).</p><p class="annual-cost">All active procedures meet their target in ${r.annualTargetChance.toFixed(0)}% of simulated years. Inputs remain illustrative.</p>${baseline?`<p class="baseline-note">Recommendation retained for comparison: ${ft(baseline.fteByRole[0])} manager, ${ft(baseline.fteByRole[1])} senior and ${ft(baseline.fteByRole[2])} junior FTEs · ${money(baseline.cost,c)}/month · ${Model.slaScore(baseline).toFixed(1)}% lowest SLA compliance.</p>`:''}</div>`;
 $('#state').textContent=same?'Showing recommended staffing':'Showing recalculated staffing';
}
function showRecommendation(){const c=current.config;baseline=Model.recommended(c,current.results);
 if(!dirty)$('#state').classList.remove('dirty');scenario=baseline;setFtes(baseline?baseline.fteByRole:[c.teams,0,0]);$('#simulate').disabled=dirty;$('#scenarioStatus').textContent='Change any FTE value. The main dashboard and comparison recalculate automatically.';renderComparison();}
function renderComparison(){renderDashboard();const c=current.config,r=scenario;$('#metrics').classList.remove('stale');$('#scenarioSummary').classList.remove('stale');
if(!r){$('#annualMetrics').innerHTML='';$('#annualSummary').textContent='';$('#metrics').innerHTML='';$('#durations').innerHTML='';$('#operations').textContent='';$('#scenarioSummary').textContent='Enter FTEs and recalculate SLA.';return;}
const delta=baseline?r.cost-baseline.cost:null;
$('#scenarioSummary').innerHTML=`<div class="scenario-cards"><div>Your staffing<strong>${ft(r.fte)} FTE</strong><span>${baseline?sign(r.fte-baseline.fte,2)+' FTE vs recommendation':''}</span></div><div>Your monthly cost<strong>${money(r.cost,c)}</strong><span>${delta===null?'':(delta<0?'Saving: ':delta>0?'Additional cost: ':'No cost change: ')+money(Math.abs(delta),c)+'/month'}</span></div><div>Your SLA result<strong class="${r.pass?'good':'bad'}">${r.pass?'Target met':'Target missed'}</strong><span>${Model.slaScore(r).toFixed(1)}% lowest compliance · target ${c.target}%${c.objective==='sla'&&r.cost>c.monthlyBudget?' · Over budget':''}</span></div></div>`;
const rate=m=>!m||m.rate===null?'—':m.rate.toFixed(1)+'%';
const p90=m=>!m||!m.n?'—':m.p90===null?'Not estimable':(m.censored?'≤ ':'')+m.p90+' days'+(m.censored?' (bound)':'');
$('#metrics').innerHTML=r.metrics.map((m,i)=>{const b=baseline?.metrics[i],change=b?.rate!==null&&b?.rate!==undefined&&m.rate!==null?m.rate-b.rate:null;return `<tr><td>${Model.TYPES[i]}</td><td>${c.sla[i]} days</td><td>${rate(b)}</td><td class="${m.rate===null?'':m.rate>=c.target?'good':'bad'}">${rate(m)}</td><td class="${change===null||change===0?'':change>0?'good':'bad'}">${change===null?'—':sign(change)+' pp'}</td></tr>`;}).join('');
$('#durations').innerHTML=r.metrics.map((m,i)=>`<tr><td>${Model.TYPES[i]}</td><td>${p90(baseline?.metrics[i])}</td><td>${p90(m)}</td><td>${m.n?m.delay.toFixed(1)+' days':'—'}</td></tr>`).join('');
$('#annualSummary').textContent=`All active procedures meet the target in ${r.annualTargetChance.toFixed(0)}% of simulated years (95% Monte Carlo interval ${r.annualTargetInterval[0].toFixed(0)}–${r.annualTargetInterval[1].toFixed(0)}%).`;
$('#annualMetrics').innerHTML=r.metrics.map((m,i)=>`<tr><td>${Model.TYPES[i]}</td><td>${m.annualP10===null?'—':m.annualP10.toFixed(1)+'–'+m.annualP90.toFixed(1)+'%'}</td><td>${m.annualTargetChance===null?'—':m.annualTargetChance.toFixed(0)+'%'}</td></tr>`).join('');
$('#operations').textContent=`Your staffing: average active and queued requests ${r.averageActive.toFixed(0)}; outstanding requests at year end ${r.backlog.toFixed(0)}.${r.metrics.some(m=>m.censored)?' Some requests remain incomplete after the additional completion year.':''}`;
}
function busy(on){$('#run').disabled=on;$('#simulate').disabled=on||dirty;$('#cancel').hidden=!on;$('#resetFte').disabled=on;document.querySelectorAll('input[type=number],select,[data-step]').forEach(x=>x.disabled=on);if(!on)objectiveHelp();}
async function startCalculation(payload,onResult){
  clearTimeout(timer);const token=++jobId;calculating=true;busy(true);
  const isScenario=payload.mode==='scenario';
  try{
    const options={cancelled:()=>token!==jobId,progress:p=>{
      if(token!==jobId)return;
      const trial=p.completed||p.trial,total=p.total||p.trials;
      if(isScenario){$('#scenarioStatus').textContent=`Recalculating SLA: ${trial} of ${total} scenarios…`;$('#state').textContent=`Updating dashboard: ${trial} of ${total} scenarios`;}
      else $('#status').textContent=`Finding recommendation: ${p.count} staffing options completed; scenario ${p.trial} of ${p.trials}…`;
    }};
    let data;
    if(isScenario){const c={...payload.config,fteByRole:payload.fteByRole};const error=Model.mixError(c,c.fteByRole);if(error)throw Error(error);data={mode:'scenario',result:await Model.evaluateAsync(c,0,0,options)};}
    else data=await Model.searchAsync(payload,options);
    if(token!==jobId)return;calculating=false;busy(false);onResult(data);
  }catch(error){if(token===jobId)finish(error.message);}
}
function finish(message){jobId++;clearTimeout(timer);calculating=false;busy(false);$('#status').textContent=message;$('#scenarioStatus').textContent=message;}
$('#cancel').onclick=()=>finish('Calculation cancelled. Previous results are retained.');
$('#run').onclick=()=>{try{if(![...document.querySelectorAll('input[type=number]:not(.fte-control)')].every(x=>x.disabled||x.reportValidity()))return;const c=getConfig();$('#status').textContent='Finding the recommendation…';startCalculation(c,data=>{current=data;dirty=false;showRecommendation();$('#status').textContent='Recommendation calculated. Adjust FTEs below to explore the trade-off.';$('#simulate').disabled=false;});}catch(e){$('#status').textContent=e.message;}};
$('#simulate').onclick=()=>{if(!current||dirty)return;clearTimeout(timer);const fields=fteIds.map(id=>$('#'+id));if(!fields.every(x=>x.reportValidity()))return;const fteByRole=fields.map(x=>+x.value),error=Model.mixError(current.config,fteByRole);if(error){$('#scenarioStatus').textContent=error;return;}$('#scenarioStatus').textContent='Recalculating SLA for your staffing…';startCalculation({mode:'scenario',config:current.config,fteByRole},data=>{scenario=data.result;renderComparison();$('#scenarioStatus').textContent='SLA recalculated for your FTEs. Compare it with the recommendation below.';$('#status').textContent='Staffing scenario complete.';});};
$('#resetFte').onclick=()=>{clearTimeout(timer);if(!current)return;scenario=baseline;setFtes(baseline?baseline.fteByRole:[current.config.teams,0,0]);renderComparison();$('#simulate').disabled=dirty;$('#scenarioStatus').textContent='Reset to recommended staffing.';};
$('#export').onclick=()=>{if(!current)return;const blob=new Blob([JSON.stringify({...current,scenario,assumptions:'Illustrative inputs; not calibrated on company data.'},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='good-spending-team-sla.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
fetch('example.json?v=6',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(data.version!==6)throw Error('Outdated example');if(!calculating&&!current){current=data;showRecommendation();$('#status').textContent='Calculated example loaded. Change assumptions or test your own FTEs.';}}).catch(()=>{$('#result').innerHTML='<div class="loading">Calculate a recommendation, then adjust FTEs to explore the SLA impact.</div>';});
