import {createSign} from 'node:crypto';
import {sale} from './rules.js';
export function env(name) { if (!process.env[name]) throw new Error(`Setup incomplete: ${name}`); return process.env[name]; }
export async function db(path, method='GET', body) {
 const response=await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`,{method,headers:{apikey:env('SUPABASE_SECRET_KEY'),'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 if(!response.ok) { if(response.status===409) throw new Error('This reference already exists.'); throw new Error('Database request failed. Check Supabase setup.'); }
 return response.status===204?null:response.json();
}
export async function telegram(chat_id,text) {
 const r=await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id,text}),signal:AbortSignal.timeout(10000)});
 if(!r.ok || !(await r.json()).ok) throw new Error('Telegram delivery failed.');
}
async function googleToken() {
 const now=Math.floor(Date.now()/1000);
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const unsigned=`${encode({alg:'RS256',typ:'JWT'})}.${encode({iss:env('GOOGLE_SERVICE_ACCOUNT_EMAIL'),scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})}`;
 const signature=createSign('RSA-SHA256').update(unsigned).sign(env('GOOGLE_PRIVATE_KEY').replace(/\\n/g,'\n'),'base64url');
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${signature}`}),signal:AbortSignal.timeout(10000)});
 if(!r.ok) throw new Error('Google authentication failed.');
 return (await r.json()).access_token;
}
export async function sync(row) {
 try {
 const token=await googleToken();
 // Database identity assigns a stable row: retries overwrite, never append.
 const values=[[row.reference,row.submitted_at,row.employee,row.customer,row.project,row.description,row.amount_cents/100,...row.shares,'','','',0,0,0,row.status]];
 const range=`Sales!A${Number(row.id)+1}:Q${Number(row.id)+1}`;
 const r=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env('GOOGLE_SHEET_ID')}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({values}),signal:AbortSignal.timeout(10000)});
 if(!r.ok) throw new Error('Sheets write failed.');
 await db(`sales?id=eq.${row.id}`,'PATCH',{sync_status:'Synced'});
 return 'Synced';
 } catch {await db(`sales?id=eq.${row.id}`,'PATCH',{sync_status:'Sync failed'}); return 'Sync failed';}
}
export async function confirm(row) {
 if(!row.origin_chat_id) return;
 try {await telegram(row.origin_chat_id,`${row.reference} recorded: €${(row.amount_cents/100).toFixed(2)}, project ${row.project}. Pending approval.`); await db(`sales?id=eq.${row.id}`,'PATCH',{confirmation_status:'Sent'});}
 catch {await db(`sales?id=eq.${row.id}`,'PATCH',{confirmation_status:'Failed'});}
}
export async function submit(input,employee,chat=null,update=null) {
 const clean=sale(input,employee);
 const [row]=await db('sales','POST',{...clean,origin_chat_id:chat,telegram_update_id:update,confirmation_status:chat?'Not sent':'No Telegram recipient linked'});
 await sync(row); await confirm(row); return row;
}
