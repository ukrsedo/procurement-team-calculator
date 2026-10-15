// DOM contract/interaction check. This does not replace a rendered browser check.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),Model=require('./docs/model.js');
const controls=[],ids=new Map();
function attrs(text){return Object.fromEntries([...text.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));}
class Element{
 constructor(a={}){Object.assign(this,a);this.dataset=Object.fromEntries(Object.entries(a).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5),v]));this.value=a.value||'';this.disabled=false;this.hidden=false;this.events={};this.classList={add(){},remove(){}};this._html='';}
 set innerHTML(s){this._html=s;parse(s);}get innerHTML(){return this._html;}
 addEventListener(name,fn){this.events[name]=fn;}
 reportValidity(){return Number.isFinite(+this.value)&&(!this.min||+this.value>=+this.min)&&(!this.max||+this.value<=+this.max);}
}
function parse(s){for(const m of s.matchAll(/<([a-z][a-z0-9]*)\b[^>]*>/g)){const a=attrs(m[0]);if(a.id&&ids.has(a.id))continue;const el=new Element({...a,tag:m[1]});if(a.id)ids.set(a.id,el);if(m[1]==='input'||m[1]==='select'||a['data-step'])controls.push(el);}}
parse(fs.readFileSync('docs/index.html','utf8'));
const document={querySelector:s=>ids.get(s.slice(1)),querySelectorAll:s=>{
 if(s.startsWith('[data-key=')){const key=s.match(/data-key=([^\]]+)/)[1];return controls.filter(x=>x['data-key']===key);}
 if(s==='[data-step]')return controls.filter(x=>x['data-step']!==undefined);
 return controls.filter(x=>s.split(',').some(part=>{if(part==='select')return x.tag==='select';if(part==='[data-step]')return x['data-step']!==undefined;if(part.startsWith('input[type=number]'))return x.type==='number'&&(!part.includes(':not')||x.class!=='fte-control');return false;}));
}};
const config={...Model.defaults,trials:3},base=Model.evaluate(config,9,6,3);base.pass=true;
const context={document,Model,structuredClone,fetch:()=>Promise.resolve({json:()=>Promise.resolve({version:6,config,results:[base]})}),console,setTimeout,clearTimeout,URL,Blob};
vm.createContext(context);vm.runInContext(fs.readFileSync('docs/app.js','utf8'),context);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(test){for(let k=0;k<200;k++){if(test())return;await delay(20);}throw Error('Timed out waiting for SLA recalculation');}
(async()=>{
 await waitFor(()=>ids.get('result').innerHTML.includes('Senior employees'));
 const oldMetrics=ids.get('metrics').innerHTML,oldDashboard=ids.get('result').innerHTML;assert.equal(+ids.get('seniorFte').value,9);
 const minus=controls.find(x=>x['data-role']==='1'&&x['data-step']==='-1');minus.onclick();assert.equal(+ids.get('seniorFte').value,8);
 await waitFor(()=>ids.get('scenarioStatus').textContent.includes('SLA recalculated'));
 assert(ids.get('result').innerHTML.includes('650,000'),'Main dashboard must show the edited salary');assert.notEqual(ids.get('result').innerHTML,oldDashboard,'Main dashboard must update');assert(ids.get('result').innerHTML.includes('Open RFP'),'Main dashboard must show SLA by procedure');const edited=Model.evaluate({...config,fteByRole:[3,8,6]},0,0);assert(ids.get('result').innerHTML.includes(Model.slaScore(edited).toFixed(1)+'%'),'Main dashboard must show recalculated SLA');assert(ids.get('scenarioSummary').innerHTML.includes('650,000'));assert.notEqual(ids.get('metrics').innerHTML,oldMetrics);assert(ids.get('metrics').innerHTML.includes(' pp'));
 ids.get('resetFte').onclick();assert.equal(+ids.get('seniorFte').value,9);assert(ids.get('result').innerHTML.includes('690,000'),'Reset must restore dashboard cost');
 ids.get('juniorFte').value=0;ids.get('juniorFte').events.input();assert(ids.get('scenarioStatus').textContent.includes('Maximum is 50%'));assert.equal(ids.get('simulate').disabled,true);
 ids.get('resetFte').onclick();ids.get('managerFte').value=2.5;ids.get('managerFte').events.input();
 await waitFor(()=>ids.get('scenarioStatus').textContent.includes('SLA recalculated'));
 assert(ids.get('scenarioSummary').innerHTML.includes('17.5 FTE'));assert(ids.get('result').innerHTML.includes('17.5 FTE'));assert(ids.get('annualSummary').textContent.includes('simulated years'));assert(ids.get('annualMetrics').innerHTML.includes('Open RFP'));
 const demand=controls.find(x=>x['data-key']==='annualByType');demand.value=360;demand.events.input();
 assert.equal(ids.get('simulate').disabled,false,'Demand edits must allow SLA recalculation');assert.equal(ids.get('resetFte').disabled,true,'Old recommendation must not be restored after input changes');
 ids.get('simulate').onclick();await waitFor(()=>ids.get('scenarioStatus').textContent.includes('SLA recalculated'));
 const changedConfig={...Model.defaults,annualByType:[360,...Model.defaults.annualByType.slice(1)],fteByRole:[2.5,9,6]};
 const changedResult=Model.evaluate(changedConfig,0,0);
 assert(ids.get('result').innerHTML.includes(Model.slaScore(changedResult).toFixed(1)+'%'),'SLA must use edited demand, not the loaded example');
 assert(!ids.get('result').innerHTML.includes('Recommendation retained'),'Old recommendation must not be compared with new demand');
 ids.get('managerFte').value=3;ids.get('managerFte').events.input();await waitFor(()=>ids.get('scenarioStatus').textContent.includes('SLA recalculated'));
 const followingResult=Model.evaluate({...changedConfig,fteByRole:[3,9,6]},0,0);assert(ids.get('result').innerHTML.includes(Model.slaScore(followingResult).toFixed(1)+'%'),'Subsequent FTE edits must retain the new demand');
 ids.get('objective').value='sla';ids.get('objective').events.input();assert.equal(ids.get('budgetField').hidden,false);assert.equal(ids.get('simulate').disabled,false);
 console.log('PASS: automatic FTE recalculation runs real async simulation, changes SLA and salary, supports fractional FTEs, blocks >50% seniors, and resets.');
})().catch(e=>{console.error(e);process.exitCode=1;});
