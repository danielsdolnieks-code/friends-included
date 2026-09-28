import {createSign} from 'node:crypto';
import {sale,expense,split,allocation,commissions,requireManager,InputError} from './rules.js';
export function env(name){if(!process.env[name])throw Error(`Setup incomplete: ${name}`);return process.env[name];}
export async function db(path,method='GET',body){
 const r=await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`,{method,headers:{apikey:env('SUPABASE_SECRET_KEY'),'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 if(!r.ok){if(r.status===409)throw new InputError('This reference already exists.');throw Error('Database request failed. Check Supabase setup and run the new migration.');}
 return r.status===204?null:r.json();
}
export async function listAll(kind,filter=''){const rows=[];for(let offset=0;;){const page=await db(`${kind}?select=*&order=id.asc&limit=500&offset=${offset}${filter}`);rows.push(...page);if(page.length<500)return rows;offset+=page.length;}}
export async function telegram(chat_id,text){const r=await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id,text}),signal:AbortSignal.timeout(10000)});if(!r.ok||!(await r.json()).ok)throw Error('Telegram delivery failed.');}
async function googleToken(){
 const now=Math.floor(Date.now()/1000),encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const unsigned=`${encode({alg:'RS256',typ:'JWT'})}.${encode({iss:env('GOOGLE_SERVICE_ACCOUNT_EMAIL'),scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
 let signature;try{signature=createSign('RSA-SHA256').update(unsigned).sign(env('GOOGLE_PRIVATE_KEY').replace(/\\n/g,'\n'),'base64url');}catch{throw Error('Google private key format is invalid. Check GOOGLE_PRIVATE_KEY.');}
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${signature}`}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Google authentication failed. Check the service account email and private key.');return (await r.json()).access_token;
}
const saleHeaders=['Reference','Submission time','Salesperson','Customer','Project','Description','Amount','Proposed Richard %','Proposed Anastasia %','Proposed Jean-Claude %','Approved Richard %','Approved Anastasia %','Approved Jean-Claude %','Richard earned','Anastasia earned','Jean-Claude earned','Status'];
const expenseHeaders=['Reference','Submission time','Reporter','Description','Category','Amount','Proposed allocation','Final allocation','Status'];
export function sheetValues(row,kind){
 if(kind==='expenses')return [row.reference,row.submitted_at,row.employee,row.description,row.category,row.amount_cents/100,row.proposed_allocation,row.final_allocation||'',row.status];
 const c=row.status==='Approved'?commissions(row.amount_cents,row.approved_shares).earned:[0,0,0];
 return [row.reference,row.submitted_at,row.employee,row.customer,row.project,row.description,row.amount_cents/100,...row.shares,...(row.approved_shares||['','','']),...c.map(x=>x/100),row.status];
}
export async function sync(row,kind='sales'){
 try{
 const token=await googleToken();
 // Re-read so a delayed retry uses the current approved version.
 [row]=await db(`${kind}?id=eq.${row.id}`);
 const tab=kind==='sales'?'Sales':'Expenses',end=kind==='sales'?'Q':'I';
 const data=[{range:`${tab}!A1:${end}1`,values:[kind==='sales'?saleHeaders:expenseHeaders]},{range:`${tab}!A${Number(row.id)+1}:${end}${Number(row.id)+1}`,values:[sheetValues(row,kind)]}];
 const r=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env('GOOGLE_SHEET_ID')}/values:batchUpdate`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({valueInputOption:'RAW',data}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error(r.status===403?'Sheets permission denied. Enable the Sheets API and share the spreadsheet with the service account as Editor.':r.status===404?'Spreadsheet not found. Check GOOGLE_SHEET_ID.':r.status===400?'Check Sales and Expenses tab names and available sheet rows.':`Google Sheets request failed (HTTP ${r.status}).`);
 await db(`${kind}?id=eq.${row.id}`,'PATCH',{sync_status:'Synced',sync_error:null});return 'Synced';
 }catch(e){await db(`${kind}?id=eq.${row.id}`,'PATCH',{sync_status:'Sync failed',sync_error:e.message});return 'Sync failed';}
}
const euro=c=>`€${(c/100).toFixed(2)}`;
export async function confirm(row,kind='sales'){
 if(!row.origin_chat_id||row.confirmation_status==='Sent')return;
 try{await telegram(row.origin_chat_id,`${row.reference} recorded: ${euro(row.amount_cents)}, ${kind==='sales'?`project ${row.project}. Pending approval`:`proposed allocation ${row.proposed_allocation}. ${row.proposed_allocation==='Company overhead'?'Allocated':'Awaiting allocation'}`}.`);await db(`${kind}?id=eq.${row.id}`,'PATCH',{confirmation_status:'Sent'});}
 catch{await db(`${kind}?id=eq.${row.id}`,'PATCH',{confirmation_status:'Failed'});}
}
export function decisionText(row,kind){
 if(kind==='expenses')return `${row.reference} — allocation ${row.proposed_allocation===row.final_allocation?'confirmed':'changed'}. ${euro(row.amount_cents)}: ${row.description}. Proposed: ${row.proposed_allocation}. Approved: ${row.final_allocation}.`;
 const c=commissions(row.amount_cents,row.approved_shares),changed=row.shares.some((v,i)=>v!==row.approved_shares[i]);
 return `${row.reference} approved — commission split ${changed?'changed':'unchanged'}. Sale ${euro(row.amount_cents)}; total commission ${euro(c.pool)}.\n`+['Richard','Anastasia','Jean-Claude'].map((name,i)=>`${name}: ${row.shares[i]}% → ${row.approved_shares[i]}% (${euro(c.earned[i])}).`).join('\n');
}
export async function notifyDecision(row,kind){
 if(!row.decided_at||row.decision_status==='Sent')return;
 let chat=row.origin_chat_id;
 if(!chat&&row.source==='website'){const [link]=await db(`telegram_links?employee=eq.${row.employee}&order=telegram_user_id&limit=1`);chat=link?.chat_id;if(chat)await db(`${kind}?id=eq.${row.id}`,'PATCH',{origin_chat_id:chat});}
 if(!chat){await db(`${kind}?id=eq.${row.id}`,'PATCH',{decision_status:'No Telegram recipient linked'});return;}
 try{await telegram(chat,decisionText(row,kind));await db(`${kind}?id=eq.${row.id}`,'PATCH',{decision_status:'Sent'});}
 catch{await db(`${kind}?id=eq.${row.id}`,'PATCH',{decision_status:'Failed'});}
}
export async function submit(input,employee,chat=null,update=null,kind='sales'){
 const clean=kind==='sales'?sale(input,employee):expense(input,employee);
 const [row]=await db(kind,'POST',{...clean,origin_chat_id:chat,telegram_update_id:update,source:update===null?'website':'telegram',confirmation_status:chat?'Not sent':'No Telegram recipient linked'});
 await sync(row,kind);await confirm(row,kind);return row;
}
export async function approve(row,kind,input,role){
 requireManager(role);
 const pending=kind==='sales'?'Pending approval':'Awaiting allocation';
 if(row.status!==pending)return;
 const patch=kind==='sales'?{approved_shares:split(input.shares),status:'Approved'}:{final_allocation:allocation(input.final_allocation),status:'Allocated'};
 // Conditional update makes repeat/concurrent approvals no-ops.
 const changed=await db(`${kind}?id=eq.${row.id}&status=eq.${encodeURIComponent(pending)}`,'PATCH',{...patch,decided_at:new Date().toISOString(),sync_status:'Sync pending',sync_error:null,decision_status:'Pending'});
 if(!changed.length)return;
 await sync(changed[0],kind);await notifyDecision(changed[0],kind);
}
