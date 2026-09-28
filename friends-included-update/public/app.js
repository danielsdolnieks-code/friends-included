const $=s=>document.querySelector(s),role=$('#role'),message=$('#message');
const euro=c=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(c/100);
const names={richard:'Richard',anastasia:'Anastasia','jean-claude':'Jean-Claude',kevin:'Kevin'};
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
async function api(body,selected=role.value){const r=await fetch('/api/app',{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-demo-role':selected},body:body?JSON.stringify(body):undefined});let data;try{data=await r.json();}catch{throw Error('The server could not respond. Please retry.');}if(!r.ok)throw Error(data.error||'Request failed.');return data;}
let busy=false;
async function run(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();await refresh();message.textContent='Saved. Review the delivery status on the record.';}catch(e){message.textContent=e.message;}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function table(headers,rows){const wrap=el('div',undefined,'scroll'),t=el('table'),head=el('thead'),tr=el('tr');headers.forEach(x=>tr.append(el('th',x)));head.append(tr);t.append(head);const body=el('tbody');rows.forEach(values=>{const r=el('tr');values.forEach(v=>r.append(el('td',v)));body.append(r);});t.append(body);wrap.append(t);return wrap;}
function dashboard(t){const box=$('#totals');box.replaceChildren(table(['Measure','Project A','Project B','Company'],[['Approved income',euro(t.A.income),euro(t.B.income),euro(t.company.income)],['Commission expense',euro(t.A.commissions),euro(t.B.commissions),euro(t.company.commissions)],['Recorded expenses',euro(t.A.expenses),euro(t.B.expenses),euro(t.company.expenses)],['Result',euro(t.A.result),euro(t.B.result),euro(t.company.result)]]));box.append(el('p',`Company overhead: ${euro(t.overhead)} · Awaiting allocation: ${euro(t.awaiting)} · Pending sales: ${euro(t.pendingSales)}`));box.append(el('h3','Commission earned'));box.append(table(['Richard','Anastasia','Jean-Claude'],[t.earned.map(euro)]));}
function field(label,value,type='number'){const l=el('label',label),i=el('input');i.type=type;i.value=value;i.required=true;if(type==='number'){i.min=0;i.max=100;i.step='.01';}l.append(i);return {label:l,input:i};}
function renderRecord(row,kind,manager){
 const a=el('article'),heading=el('div',undefined,'record-heading');heading.append(el('h3',`${row.reference} · ${euro(row.amount_cents)}`),el('span',row.status,'status'));a.append(heading,el('p',row.description));
 const facts=el('div',undefined,'facts');facts.append(el('span',`Submitted by ${names[row.employee]||row.employee}`),el('span',new Date(row.submitted_at).toLocaleString()));
 if(kind==='sales')facts.append(el('span',`Customer: ${row.customer}`),el('span',`Project ${row.project}`));else facts.append(el('span',`Category: ${row.category}`));a.append(facts);
 if(kind==='sales')a.append(table(['Commission share','Richard','Anastasia','Jean-Claude'],[['Original proposal',...row.shares.map(v=>`${v}%`)],['Final decision',...(row.approved_shares?row.approved_shares.map(v=>`${v}%`):['Pending','Pending','Pending'])]]));
 else a.append(el('p',`Proposed allocation: ${row.proposed_allocation} · Final allocation: ${row.final_allocation||'Awaiting decision'}`));
 a.append(el('p',`Sheets: ${row.sync_status} · Submission message: ${row.confirmation_status} · Decision message: ${row.decision_status}`,'delivery'));
 if(row.sync_error)a.append(el('p',row.sync_error,'error'));
 if(manager){
  if(['Pending approval','Awaiting allocation'].includes(row.status)){
   const f=el('form',undefined,'approval');let getValues;
   if(kind==='sales'){const fields=['Richard %','Anastasia %','Jean-Claude %'].map((name,i)=>field(name,row.shares[i]));fields.forEach(x=>f.append(x.label));getValues=()=>({shares:fields.map(x=>Number(x.input.value))});}
   else{const l=el('label','Final allocation'),s=el('select');['A','B','Company overhead'].forEach(v=>{const o=el('option',v);o.value=v;s.append(o);});s.value=row.proposed_allocation;l.append(s);f.append(l);getValues=()=>({final_allocation:s.value});}
   f.append(el('button',kind==='sales'?'Approve sale and split':'Confirm allocation'));f.onsubmit=e=>{e.preventDefault();run(()=>api({action:'approve',kind,id:row.id,...getValues()}));};a.append(f);
  }
  const actions=el('div',undefined,'actions');
  const choices=[];if(row.sync_status!=='Synced')choices.push(['retrySync','Retry Sheets']);if(row.origin_chat_id&&row.confirmation_status!=='Sent')choices.push(['retryTelegram','Retry submission message']);if(row.decided_at&&row.decision_status!=='Sent')choices.push(['retryDecision','Retry decision message']);
  for(const [action,label] of choices){const b=el('button',label,'secondary');b.type='button';b.onclick=()=>run(()=>api({action,kind,id:row.id}));actions.append(b);}a.append(actions);
 }
 return a;
}
let generation=0;
async function refresh(){const version=++generation,selected=role.value,manager=selected==='svetlana';$('#manager').hidden=!manager;$('#dashboard').hidden=!manager;$('#salesForm').hidden=['kevin','svetlana'].includes(selected);$('#expenseForm').hidden=selected!=='kevin';$('#rows').replaceChildren();$('#totals').replaceChildren();$('#recordHelp').textContent=manager?'Review original proposals below. Adjust the final split or allocation before approval. Leave undecided records pending.':'Your own submissions and their current status appear below.';
 const data=await api(null,selected);if(version!==generation)return;if(data.totals)dashboard(data.totals);const rows=[...data.rows.map(row=>({row,kind:'sales'})),...data.expenses.map(row=>({row,kind:'expenses'}))].sort((a,b)=>b.row.submitted_at.localeCompare(a.row.submitted_at));for(const x of rows)$('#rows').append(renderRecord(x.row,x.kind,manager));if(!rows.length)$('#rows').append(el('p','No transactions yet.'));
}
$('#sale').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));run(()=>api({...d,action:'submit',shares:[+d.r,+d.a,+d.j]}));};
$('#expense').onsubmit=e=>{e.preventDefault();run(()=>api({...Object.fromEntries(new FormData(e.target)),action:'submitExpense'}));};
$('#link').onsubmit=e=>{e.preventDefault();run(()=>api({...Object.fromEntries(new FormData(e.target)),action:'link'}));};
const reload=()=>refresh().catch(e=>message.textContent=e.message);role.onchange=()=>{message.textContent='';reload();};$('#refresh').onclick=reload;reload();
