(function (root) {
'use strict';
const TYPES = ['Open RFP', 'Closed RFP', 'Single-source', 'RFQ', 'Contract extension'];
const defaults = {
  annualByType: [180, 120, 120, 120, 60], season: 20, target: 95, trials: 60,
  teams: 3, allocation: 'separate', objective: 'cost', currency: 'units', maxSenior: 15, maxJunior: 15, monthlyBudget: 600000,
  managerCost: 60000, seniorCost: 40000, juniorCost: 25000,
  productivity: [10, 10, 5], procurementTime: [50, 80, 80],
  vacation: 20, sick: 5, extra: 10, extraShare: 10, handover: 3, holidays: 10,
  turnover: 5, hireMonths: 3, rampMonths: 6, rampPercent: 50,
  sla: [120, 100, 60, 15, 15],
  hours: [24, 20, 10, 4, 3], juniorHours: [40, 32, 14, 5, 4],
  review: [8, 6, 2, 1, 0.5], waitMin: [45, 35, 15, 2, 2], waitMax: [80, 65, 35, 7, 7]
};
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function quant(a, p) { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))]; }
const ORIGIN = Date.UTC(2027, 0, 4), DAY = 86400000;
function addMonths(day, months) {
  const d = new Date(ORIGIN + day * DAY), dom = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dom, end)); return Math.round((d.getTime() - ORIGIN) / DAY);
}
function calendar(c, length = 1095) {
  const work = new Uint8Array(length);
  for (let d = 0; d < length; d++) work[d] = d % 7 < 5 ? 1 : 0;
  for (let y = 0; y < Math.ceil(length / 365); y++) {
    const days = []; for (let d = y * 365; d < Math.min(length, (y + 1) * 365); d++) if (work[d]) days.push(d);
    for (let k = 0; k < Math.min(c.holidays, days.length); k++) work[days[Math.floor((k + .5) * days.length / c.holidays)]] = 0;
  }
  return work;
}
function roundedCount(n, percent, random) {
  const exact = n * percent / 100, base = Math.floor(exact);
  return Math.min(n, base + (random() < exact - base ? 1 : 0));
}
function keyHash(value){let h=2166136261;for(const ch of value)h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;}
function buildStaff(c,s,j,seed,work){
 const staff=[],events=[],totals=c.fteByRole||[c.teams,s,j],layout=allocateFte(c.teams,totals),years=Math.ceil(work.length/365);
 const daysByYear=Array.from({length:years},(_,y)=>Array.from({length:Math.min(365,work.length-y*365)},(_,n)=>y*365+n).filter(d=>work[d]));
 const randomFor=(p,y,kind)=>rng(seed^keyHash(`${p.key}/${y}/${kind}`));
 for(let team=0;team<c.teams;team++)for(let r=0;r<3;r++)for(let n=0;n<Math.ceil(layout[team][r]-1e-9);n++)staff.push({id:staff.length,key:`${team}/${r}/${n}`,team,r,fte:Math.min(1,layout[team][r]-n),active:[],cap:new Float32Array(work.length).fill(1),multiplier:new Float32Array(work.length).fill(1),handoverLoss:new Float32Array(work.length),departures:new Set(),releaseDays:new Set()});
 function place(p,days,len,random,kind,y,low=0,high=days.length){
   if(!len)return null;const starts=[];for(let k=low;k<=Math.min(high-len,days.length-len);k++)if(days.slice(k,k+len).every(d=>p.cap[d]===1))starts.push(k);
   if(!starts.length)throw Error('Absence settings exceed available non-overlapping working days.');
   const idx=starts[Math.floor(random()*starts.length)],block=days.slice(idx,idx+len);for(const d of block)p.cap[d]=0;
   const event={kind,year:y,person:p.id,key:p.key,start:block[0],days:block.length,workDays:block};events.push(event);return event;
 }
 for(let y=0;y<Math.min(3,years);y++){
   const days=daysByYear[y];
   for(const p of staff){
     const vacationRandom=randomFor(p,y,'vacation');
     for(let half=0;half<2;half++){const len=half===0?Math.floor(c.vacation/2):Math.ceil(c.vacation/2);if(!len)continue;
       const lo=half===0?Math.max(c.handover,Math.floor(days.length*.06)):Math.floor(days.length*.56),hi=half===0?Math.floor(days.length*.46):Math.floor(days.length*.96);
       const event=place(p,days,len,vacationRandom,'vacation',y,lo,hi);p.releaseDays.add(event.start);
     }
     place(p,days,c.sick,randomFor(p,y,'sickness'),'sick',y);
   }
   const count=c.extra>0?roundedCount(staff.length,c.extraShare,rng(seed^keyHash(`extra-count/${y}`))):0;
   const selected=staff.slice().sort((a,b)=>rng(seed^keyHash(`extra-order/${y}/${a.key}`))()-rng(seed^keyHash(`extra-order/${y}/${b.key}`))()).slice(0,count);
   for(const p of selected)place(p,days,c.extra,randomFor(p,y,'extra-sickness'),'extraSick',y);
 }
 for(const p of staff){let occupiedFrom=0;for(let y=0;y<3;y++){const random=randomFor(p,y,'turnover');if(random()>=c.turnover/100)continue;
   const leave=y*365+Math.floor(random()*365);if(leave<occupiedFrom||leave>=work.length)continue;
   const hire=addMonths(leave,c.hireMonths),full=addMonths(hire,c.rampMonths);p.departures.add(leave);p.releaseDays.add(leave);occupiedFrom=hire;
   for(let d=leave;d<Math.min(hire,work.length);d++)p.multiplier[d]=0;
   for(let d=hire;d<Math.min(full,work.length);d++)p.multiplier[d]=c.rampPercent/100;
   events.push({kind:'turnover',person:p.id,key:p.key,leave,hire,full});
 }}
 for(const leave of events.filter(e=>e.kind==='vacation')){
   const p=staff[leave.person],before=[];for(let d=leave.start-1;d>=0&&before.length<c.handover;d--)if(work[d]&&p.cap[d]>0&&p.multiplier[d]>0)before.push(d);
   const peers=staff.filter(q=>q!==p&&(c.allocation==='pooled'||q.team===p.team)&&before.every(d=>q.cap[d]>0&&q.multiplier[d]>0&&q.handoverLoss[d]<1));
   peers.sort((a,b)=>before.reduce((sum,d)=>sum+a.handoverLoss[d]-b.handoverLoss[d],0)||a.key.localeCompare(b.key));const receiver=peers[0];
   for(const d of before){p.handoverLoss[d]+=.5;if(receiver)receiver.handoverLoss[d]+=.5;}
   events.push({kind:'handover',person:p.id,key:p.key,start:before.at(-1),workDays:before,receiver:receiver?.id??null,uncovered:!receiver});
 }
 for(const p of staff)for(let d=0;d<work.length;d++)p.cap[d]*=Math.max(0,1-p.handoverLoss[d]);
 return {staff,events};
}
function simulate(c, s, j, seed) {
  const D = 1095, work = calendar(c, D), { staff, events } = buildStaff(c, s, j, seed, work);
  const random = rng(seed), annual = c.annualByType.reduce((a, b) => a + b, 0), byTeam = Array.from({ length: c.teams }, (_, t) => staff.filter(p => p.team === t));
  const weights=new Float64Array(D),weightTotals=[0,0,0,0];
  for(let d=0;d<D;d++)if(work[d]){weights[d]=1+c.season/100*Math.cos(2*Math.PI*(d%365)/365);weightTotals[Math.floor(d/365)]+=weights[d];}
  const deadline = x => x.arrival + c.sla[x.t] - 1;
  let queue = [], open = [], completed = [], backlog = 0, activeSum = 0;
  const arrivalsByYear=Array.from({length:3},()=>TYPES.map(()=>0));let capacityViolations=0;
  function done(job, d) { job.done = d; completed.push(job); }
  for (let d = 0; d < D; d++) {
    if(d===730)backlog=open.length;
    if (work[d]) {
      const rate=annual*weights[d]/weightTotals[Math.floor(d/365)];
      let prod = 1, n = -1; do { prod *= random(); n++; } while (prod > Math.exp(-rate));
      for (let k = 0; k < n; k++) {
        let x = random() * annual, t = 0; for (; t < TYPES.length - 1; t++) { x -= c.annualByType[t]; if (x < 0) break; }
        const job = { t, arrival: d, team: Math.floor(random() * c.teams), stage: 0, remaining: .55, owner: null, done: null, juniorWork: false,
          wait: c.waitMin[t] + Math.floor(random() * (c.waitMax[t] - c.waitMin[t] + 1)), factor: .8 + random() * .4 };
        queue.push(job); open.push(job);arrivalsByYear[Math.floor(d/365)][t]++;
      }
    }
    if (d >= 365 && d < 730) activeSum += open.length;
    // Unexpected departures release ongoing work into the same team's queue, preserving completed effort.
    for (const p of staff) if (p.releaseDays.has(d)) {
      for (const job of p.active) { job.owner = null; if (job.stage !== 3) queue.push(job); }
      p.active = [];
    }
    if (!work[d]) continue;
    for (const job of open) if (job.stage === 1 && d >= job.ready) { job.stage = 2; job.remaining = .45; }
    queue.sort((a, b) => deadline(a) - deadline(b));
    const isFree=p=>p.cap[d]*p.multiplier[d]>0&&p.active.length<Math.floor(c.productivity[p.r]*p.fte+1e-9);
    const freeByTeam=byTeam.map(team=>team.filter(isFree)),freeAll=c.allocation==='pooled'?staff.filter(isFree):null;
    let freeCount=freeAll?freeAll.length:freeByTeam.reduce((sum,team)=>sum+team.length,0);
    for (const job of queue) {
      if(!freeCount)break;
      if (job.owner || job.done !== null || job.stage === 3) continue;
      const eligible=freeAll||freeByTeam[job.team];
      const rank = p => p.r === 2 ? (job.t < 2 ? 3 : 0) : p.r === 1 ? 1 : 2;
      eligible.sort((a, b) => rank(a) - rank(b) || a.active.length - b.active.length || a.id-b.id);
      const p = eligible[0]; if (!p) continue;
      job.owner = p; p.active.push(job);if(!isFree(p)){eligible.shift();freeCount--;}
    }
    const reviews = Array.from({ length: c.teams }, (_, t) => open.filter(x => (c.allocation==='pooled'||x.team === t) && x.stage === 3));
    for (const p of staff) {
      let budget = 8 * p.fte * c.procurementTime[p.r] / 100 * p.cap[d] * p.multiplier[d];
      p.remainingBudget=0;
      if (budget <= 0) continue;
      const tasks = p.active.filter(x => x.stage === 0 || x.stage === 2);
      if (p.r !== 2) tasks.push(...reviews[p.team]);
      tasks.sort((a, b) => deadline(a) - deadline(b));
      for (const job of tasks) {
        if (job.done !== null) continue;
        if (job.stage === 3) {
          const used = Math.min(budget, job.remaining); budget -= used; job.remaining -= used;
          if (job.remaining < 1e-8) done(job, d);
        } else {
          while(budget>1e-8&&job.done===null&&(job.stage===0||job.stage===2)){
            const base=(p.r===2?c.juniorHours[job.t]:c.hours[job.t])*job.factor,used=Math.min(budget,job.remaining*base);budget-=used;
            if(p.r===2&&used>0)job.juniorWork=true;job.remaining-=used/base;
            if(job.remaining>1e-8)break;
            if(job.stage===0){if(job.wait===0){job.stage=2;job.remaining=.45;}else{job.stage=1;job.ready=d+job.wait;}}
            else if(job.juniorWork&&c.review[job.t]>0){job.stage=3;job.remaining=c.review[job.t]*job.factor;}
            else done(job,d);
          }
        }
      }
      p.remainingBudget=budget;if(budget < -1e-7)capacityViolations++;
    }
    // Same-day review can use qualified staff's genuinely unspent procurement hours.
    const pendingReview=open.filter(job=>job.stage===3&&job.done===null).sort((a,b)=>deadline(a)-deadline(b));
    for(const p of staff)if(p.r!==2&&p.remainingBudget>0)for(const job of pendingReview){
      if(job.done!==null||(c.allocation!=='pooled'&&job.team!==p.team))continue;
      const used=Math.min(p.remainingBudget,job.remaining);p.remainingBudget-=used;job.remaining-=used;if(job.remaining<1e-8)done(job,d);
    }
    for (const p of staff) p.active = p.active.filter(x => x.done === null);
    queue = queue.filter(x => x.owner === null && x.done === null && x.stage !== 3);
    open = open.filter(x => x.done === null);
  }
  const measured = completed.concat(open).filter(x => x.arrival >= 365 && x.arrival < 730);
  const metrics = TYPES.map((_, t) => {
    const a = measured.filter(x => x.t === t), dur = a.filter(x => x.done !== null).map(x => x.done - x.arrival + 1);
    return { n: a.length, ok: a.filter(x => x.done !== null && x.done - x.arrival + 1 <= c.sla[t]).length, durations: dur,
      late: dur.filter(x => x > c.sla[t]).map(x => x - c.sla[t]), censored: a.filter(x => x.done === null).length };
  });
  return { diagnostics:{arrivalsByYear,capacityViolations},metrics, backlog, averageActive: activeSum / 365, departures: events.filter(e => e.kind === 'turnover' && e.leave >= 365 && e.leave < 730).length,
    extraEpisodes: events.filter(e => e.kind === 'extraSick' && e.year === 1).length, trace: c.auditTrace ? {events,staff:staff.map(p=>({key:p.key,cap:Array.from(p.cap),multiplier:Array.from(p.multiplier)}))} : undefined };
}
function* evaluation(c, s, j, trials = c.trials) {
  const accum = TYPES.map(() => ({ n: 0, ok: 0, durations: [], late: [], censored: 0, annualRates: [] })); let yearlyTargetsMet=0; let backlog = 0, active = 0, departures = 0, extraEpisodes = 0;
  for (let k = 0; k < trials; k++) {
    const r = simulate(c, s, j, (c.seedBase??1729) + k * 7919); backlog += r.backlog; active += r.averageActive; departures += r.departures; extraEpisodes += r.extraEpisodes;
    if(r.metrics.every(m=>m.n===0||100*m.ok/m.n>=c.target))yearlyTargetsMet++;
    r.metrics.forEach((m, t) => { if(m.n)accum[t].annualRates.push(100*m.ok/m.n); for (const key of ['n', 'ok', 'censored']) accum[t][key] += m[key]; accum[t].durations.push(...m.durations); accum[t].late.push(...m.late); });
    yield {completed:k+1,total:trials};
  }
  const metrics=accum.map(m=>{
    const q=quant(m.durations.concat(Array(m.censored).fill(Infinity)),.9);
    return {rate:m.n?100*m.ok/m.n:null,p90:Number.isFinite(q)?q:null,annualP10:quant(m.annualRates,.1),annualP90:quant(m.annualRates,.9),annualTargetChance:m.annualRates.length?100*m.annualRates.filter(n=>n>=c.target).length/m.annualRates.length:null,
      delay:m.late.length?m.late.reduce((a,b)=>a+b,0)/m.late.length:0,censored:m.censored,n:m.n};
  });
  const fteByRole = c.fteByRole || [c.teams, s, j];
  const mix = staffingMix(c, fteByRole);
  return { mix, s: fteByRole[1], j: fteByRole[2], fteByRole, fte: fteByRole.reduce((a,b)=>a+b,0),
    cost: fteByRole[0] * c.managerCost + fteByRole[1] * c.seniorCost + fteByRole[2] * c.juniorCost, metrics,
    annualTargetChance:100*yearlyTargetsMet/trials,annualTargetInterval:wilson(yearlyTargetsMet,trials),
    averageActive: active / trials, backlog: backlog / trials, departures: departures / trials, extraEpisodes: extraEpisodes / trials, trials, seedBase:c.seedBase??1729,
    pass: mix.valid && metrics.every((m, t) => c.annualByType[t] === 0 || (m.rate !== null && m.rate >= c.target)) };
}
function wilson(successes,n){if(!n)return null;const z=1.96,p=successes/n,denom=1+z*z/n,centre=(p+z*z/(2*n))/denom,margin=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/denom;return [100*Math.max(0,centre-margin),100*Math.min(1,centre+margin)];}
function evaluate(c,s,j,trials=c.trials) {
  const steps=evaluation(c,s,j,trials); let step; do{step=steps.next();}while(!step.done);return step.value;
}
async function evaluateAsync(c,s,j,options={}) {
  const steps=evaluation(c,s,j,options.trials||c.trials), pause=options.pause||(()=>new Promise(resolve=>setTimeout(resolve,0)));
  let step; while(true){if(options.cancelled?.())throw Error('Calculation cancelled');step=steps.next();if(step.done)return step.value;options.progress?.(step.value);await pause();}
}
function staffingMix(c,totals) {
  const counts=[0,0,0];for(const team of allocateFte(c.teams,totals))team.forEach((fte,r)=>counts[r]+=Math.ceil(fte-1e-9));
  const headcount=counts.reduce((a,b)=>a+b,0),seniorPercent=headcount?counts[1]/headcount*100:0;
  return {counts,headcount,seniorPercent,valid:seniorPercent<=50+1e-9};
}
function mixError(c,totals) { const mix=staffingMix(c,totals);return mix.valid?'':`Senior employees are ${mix.seniorPercent.toFixed(1)}% of planned headcount (${mix.counts[1]} of ${mix.headcount} people). Maximum is 50%. Reduce senior FTEs or add other roles.`; }
function allocateFte(teams, totals) {
  const layout = Array.from({length:teams},()=>[0,0,0]);
  totals.forEach((total,r)=>{ const whole=Math.floor(total+1e-9); for(let k=0;k<whole;k++)layout[k%teams][r]++; const fraction=total-whole; if(fraction>1e-9)layout[whole%teams][r]+=fraction; });
  return layout;
}
function slaScore(r) { const rates=r.metrics.filter(m=>m.rate!==null).map(m=>m.rate); return rates.length?Math.min(...rates):0; }
function compare(c, a, b) { return c.objective === 'cost' ? a.cost-b.cost || slaScore(b)-slaScore(a) : slaScore(b)-slaScore(a) || a.cost-b.cost; }
function recommended(c, results) { return results.filter(r=>staffingMix(c,r.fteByRole||[c.teams,r.s||0,r.j||0]).valid&&(c.objective==='cost'?r.pass:r.cost<=c.monthlyBudget)).sort((a,b)=>compare(c,a,b))[0]||null; }
function candidatesFor(c) {
  const candidates=[]; for(let s=0;s<=c.maxSenior;s++)for(let j=0;j<=c.maxJunior;j++){
    const cost=c.teams*c.managerCost+s*c.seniorCost+j*c.juniorCost;
    if(staffingMix(c,[c.teams,s,j]).valid&&(c.objective!=='sla'||cost<=c.monthlyBudget))candidates.push({s,j,cost});
  }
  candidates.sort((a,b)=>a.cost-b.cost||a.s-b.s);
  return candidates;
}
function search(c, progress=()=>{}) {
  const candidates=candidatesFor(c),results=[];let bestCost=Infinity;
  for(const candidate of candidates){
    if(c.objective==='cost'&&candidate.cost>bestCost)break;
    const r=evaluate(c,candidate.s,candidate.j);results.push(r);if(r.pass)bestCost=Math.min(bestCost,r.cost);
    progress({count:results.length,total:candidates.length,progress:results.length/Math.max(1,candidates.length)});
  }
  results.sort((a,b)=>compare(c,a,b)); return {version:6,config:c,results};
}
async function searchAsync(c,options={}) {
  const candidates=candidatesFor(c),results=[];let bestCost=Infinity;
  for(const candidate of candidates){
    if(options.cancelled?.())throw Error('Calculation cancelled');
    if(c.objective==='cost'&&candidate.cost>bestCost)break;
    const r=await evaluateAsync(c,candidate.s,candidate.j,{...options,progress:p=>options.progress?.({count:results.length,total:candidates.length,trial:p.completed,trials:p.total})});
    results.push(r);if(r.pass)bestCost=Math.min(bestCost,r.cost);
  }
  results.sort((a,b)=>compare(c,a,b));return {version:6,config:c,results};
}
const api = { defaults, TYPES, simulate, evaluate, quant, rng, addMonths, calendar, buildStaff, roundedCount, compare, allocateFte, slaScore, recommended, search, evaluateAsync, searchAsync, staffingMix, mixError, candidatesFor, wilson, keyHash };
if (typeof module !== 'undefined') module.exports = api; else root.Model = api;
})(typeof self !== 'undefined' ? self : this);
