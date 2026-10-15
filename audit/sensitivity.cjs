const fs=require('fs'),M=require('../docs/model.js');const vm=require('vm'),quietModule={exports:{}};const src=fs.readFileSync(require.resolve('../docs/model.js'),'utf8');const quietSource=src.replace('if (work[d]) {\n      const rate=annual','if (work[d] && d<730) {\n      const rate=annual');if(quietSource===src)throw Error('Quiet-period diagnostic patch failed');vm.runInNewContext(quietSource,{module:quietModule});const c=M.defaults,trials=60,results=[];
function run(name,changes,fte=[3,6,6],model=M){const config={...c,...changes,fteByRole:fte};const r=model.evaluate(config,0,0,trials);const row={name,fte,cost:r.cost,lowestSLA:M.slaScore(r),RFP:r.metrics[0].rate,yearlyTargetChance:r.annualTargetChance,yearlyInterval:r.annualTargetInterval,annualP10:r.metrics[0].annualP10,annualP90:r.metrics[0].annualP90,backlog:r.backlog};results.push(row);console.log(JSON.stringify(row));}
for(const allocation of ['separate','pooled']){run(`${allocation}: baseline`,{allocation});run(`${allocation}: minus one senior`,{allocation},[3,5,6]);}
run('separate: 20% more demand',{annualByType:c.annualByType.map(n=>n*1.2)});
run('separate: 20% more labour effort',{hours:c.hours.map(n=>n*1.2),juniorHours:c.juniorHours.map(n=>n*1.2),review:c.review.map(n=>n*1.2)});
run('separate: 20% longer external waits',{waitMin:c.waitMin.map(n=>Math.round(n*1.2)),waitMax:c.waitMax.map(n=>Math.round(n*1.2))});
run('separate: turnover doubles to 10%',{turnover:10});
run('separate: incorrectly stopping future arrivals',{},[3,6,6],quietModule.exports);
run('separate: independent seed set',{seedBase:9172917});
fs.writeFileSync('audit/sensitivity-results.json',JSON.stringify({trials,results},null,2));
