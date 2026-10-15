const assert=require('node:assert/strict'),M=require('./docs/model.js'),c=structuredClone(M.defaults);
assert.equal(M.TYPES.length,5);assert.deepEqual(c.sla,[120,100,60,15,15]);assert.equal(c.extraShare,10);assert.equal(c.turnover,5);
const seed=1729,small=M.evaluate(c,0,0,6),large=M.evaluate(c,15,15,6);
assert(small.backlog>large.backlog);assert.deepEqual(small.metrics.map(m=>m.n),large.metrics.map(m=>m.n));
assert.equal(large.cost,c.teams*c.managerCost+15*c.seniorCost+15*c.juniorCost);
assert.deepEqual(M.simulate(c,2,1,123),M.simulate(c,2,1,123));
const impossible=M.evaluate({...c,waitMin:c.sla.map(x=>x+10),waitMax:c.sla.map(x=>x+20)},15,15,3);assert(impossible.metrics.every(m=>m.rate===0));
const work=M.calendar(c),turn=M.buildStaff({...c,turnover:100},2,1,seed,work);
assert(turn.events.some(x=>x.kind==='turnover'));
for(const event of turn.events.filter(x=>x.kind==='turnover')){
 const p=turn.staff[event.person];assert.equal(event.hire,M.addMonths(event.leave,3));assert.equal(event.full,M.addMonths(event.hire,6));
 assert.equal(p.multiplier[event.leave],0);if(event.hire<work.length)assert.equal(p.multiplier[event.hire],.5);
}
const clear=M.buildStaff({...c,vacation:0,sick:0,extraShare:0,turnover:0},1,1,seed,work);assert(clear.staff.every(p=>p.cap.every(x=>x===1)&&p.multiplier.every(x=>x===1)));
// No downward rounding bias in a 12-person team: one or two additional episodes, averaging 1.2.
let extra=0;for(let k=0;k<1000;k++){let {events}=M.buildStaff(c,6,3,k,work);let count=events.filter(e=>e.kind==='extraSick'&&e.year===1).length;assert(count===1||count===2);extra+=count;}assert(Math.abs(extra/1000-1.2)<.06);
let exits=0;for(let k=0;k<1000;k++)exits+=M.buildStaff(c,6,3,k,work).events.filter(e=>e.kind==='turnover'&&e.leave>=365&&e.leave<730).length;assert(Math.abs(exits/1000-.6)<.1);
const ramp=M.evaluate({...c,turnover:100},2,1,4),noRamp=M.evaluate({...c,turnover:100,hireMonths:0,rampMonths:0},2,1,4);assert(ramp.backlog>noRamp.backlog);
const zeroType=M.evaluate({...c,annualByType:[600,0,0,0,0]},15,15,3);assert(zeroType.metrics.slice(1).every(m=>m.n===0&&m.rate===null));
const fake=(cost,rate,fte)=>({cost,metrics:[{rate}],fte});
assert(M.compare({...c,objective:'cost'},fake(10,90,20),fake(20,99,10))<0);
assert(M.compare({...c,objective:'sla'},fake(10,90,20),fake(20,99,10))>0);
assert.equal(M.recommended({...c,objective:'sla',monthlyBudget:15},[fake(10,90,20),fake(20,99,10)]).cost,10);
const a=M.evaluate({...c,fteByRole:[3,9,0]},0,0,15),b=M.evaluate({...c,fteByRole:[3,8,0]},0,0,15),partial=M.evaluate({...c,fteByRole:[3,8.5,0]},0,0,2);
assert.equal(a.fte-b.fte,1);assert.equal(a.cost-b.cost,c.seniorCost);assert(M.slaScore(a)>M.slaScore(b));assert.equal(partial.fte,11.5);assert.equal(partial.cost,520000);
const f=M.buildStaff({...c,fteByRole:[3,8.5,0]},0,0,seed,work).staff;assert.equal(f.reduce((n,p)=>n+p.fte,0),11.5);assert(f.some(p=>p.fte===.5));
const layout=M.allocateFte(3,[3,8,0]);assert.deepEqual(layout.map(x=>x[1]),[3,3,2]);
console.log('PASS: procedures, SLAs, workload, absences, turnover, cost/SLA objectives, budget limit, one-FTE changes, fractional FTE accounting and FTE reduction impact.');

assert.equal(M.staffingMix(c,[3,9,0]).valid,false);assert.equal(M.staffingMix(c,[3,9,6]).valid,true);assert.equal(M.staffingMix(c,[3,9.5,6]).valid,false);assert.equal(M.staffingMix(c,[3,8.5,6]).valid,true);assert(M.candidatesFor(c).every(p=>M.staffingMix(c,[c.teams,p.s,p.j]).valid));assert.equal(M.recommended(c,[{...a,pass:true}]),null);console.log('PASS: 50% cap uses planned person headcount, supports part-time positions, and filters search and recommendations.');
(async()=>{const cfg={...c,trials:3,fteByRole:[3,9,6]},sync=M.evaluate(cfg,0,0),asyncResult=await M.evaluateAsync(cfg,0,0);assert.deepEqual(sync,asyncResult);let cancel=false;await assert.rejects(M.evaluateAsync(cfg,0,0,{progress:()=>cancel=true,cancelled:()=>cancel}),/cancelled/);const limited={...c,trials:2,maxSenior:3,maxJunior:3,objective:'sla',monthlyBudget:400000};assert.deepEqual(await M.searchAsync(limited),M.search(limited));console.log('PASS: async calculations equal synchronous results, cancellation works, budget search respects cap.');})().catch(e=>{console.error(e);process.exitCode=1;});
