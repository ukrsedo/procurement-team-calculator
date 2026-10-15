const assert=require('node:assert/strict'),M=require('../docs/model.js'),fs=require('fs');
const c=structuredClone(M.defaults);
// Request conservation and no overspending of daily labour capacity.
for(const seed of [1,27,1729,9687])for(const allocation of ['separate','pooled']){
 const r=M.simulate({...c,allocation},6,6,seed);assert.deepEqual(r.metrics.map(m=>m.n),r.diagnostics.arrivalsByYear[1]);assert(r.diagnostics.arrivalsByYear[2].reduce((a,b)=>a+b,0)>0);assert.equal(r.diagnostics.capacityViolations,0);assert(r.metrics.every(m=>m.ok<=m.n&&m.censored<=m.n));
}
// All 20 leave + 5 ordinary sick + 10 extra sick days are distinct working days.
const noHand={...c,handover:0,turnover:0,extraShare:100},work=M.calendar(c),{staff,events}=M.buildStaff(noHand,6,6,1234,work);
for(const p of staff){const own=events.filter(e=>e.key===p.key&&e.year===1&&['vacation','sick','extraSick'].includes(e.kind)),days=own.flatMap(e=>e.workDays);assert.equal(days.length,35);assert.equal(new Set(days).size,35);assert.equal(p.cap.slice(365,730).filter(x=>x===0).length,35);}
// Existing employees keep the same own absence and turnover events when one FTE is added.
const one=M.buildStaff(c,6,6,1983,work),two=M.buildStaff(c,7,6,1983,work);
for(const person of one.staff){const other=two.staff.find(p=>p.key===person.key);assert(other);assert.deepEqual(Array.from(person.multiplier),Array.from(other.multiplier));for(const kind of ['vacation','sick'])assert.deepEqual(one.events.filter(e=>e.key===person.key&&e.kind===kind).map(e=>e.workDays),two.events.filter(e=>e.key===person.key&&e.kind===kind).map(e=>e.workDays));}
// Simple cases with zero waits and tiny effort complete the day they arrive.
const clear={...c,annualByType:[30,20,20,20,10],allocation:'pooled',vacation:0,handover:0,sick:0,extraShare:0,turnover:0,hours:[.5,.5,.5,.5,.5],juniorHours:[.5,.5,.5,.5,.5],review:[0,0,0,0,0],waitMin:[0,0,0,0,0],waitMax:[0,0,0,0,0],sla:[1,1,1,1,1]};
const fast=M.evaluate(clear,10,10,8);assert(fast.metrics.every(m=>m.rate===100&&m.p90===1));
const waited=M.evaluate({...clear,waitMin:[10,10,10,10,10],waitMax:[10,10,10,10,10]},10,10,5);assert(waited.metrics.every(m=>m.rate===0&&m.p90>=11));
// Wilson interval remains non-degenerate at 0% and 100%, unlike naive standard error.
assert(M.wilson(0,60)[1]>0);assert(M.wilson(60,60)[0]<100);
// With a sustained overloaded stream, incomplete cases do not make P90 look short.
const overloaded=M.evaluate({...c,fteByRole:[0,0,0]},0,0,3);assert(overloaded.metrics.every(m=>m.p90===null&&m.censored===m.n));
console.log('PASS: audit invariants — continued arrivals, request conservation, capacity accounting, non-overlapping absence entitlement, stable incumbent schedules, same-day zero-wait completion, causal external waits, Monte Carlo intervals and censored P90.');
