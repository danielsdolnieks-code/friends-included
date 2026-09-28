import {timingSafeEqual} from 'node:crypto';
import {db,env,telegram,submit,sync,confirm} from '../lib/services.js';
import {InputError} from '../lib/rules.js';
const help='Sale: /sale REF | Customer | A or B | Description | Amount | 50,30,20\nExpense: /expense REF | Description | Materials or Travel or Other | Amount | A or B or Company overhead';
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).end();
 try{
 const expected=Buffer.from(env('TELEGRAM_WEBHOOK_SECRET')),actual=Buffer.from(req.headers['x-telegram-bot-api-secret-token']||'');
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return res.status(403).end();
 const m=req.body?.message;
 if(!m?.text||m.chat.type!=='private')return res.json({ok:true});
 if(m.text==='/start'||m.text==='/help'){await telegram(m.chat.id,`Your Telegram user ID: ${m.from.id}\nYour chat ID: ${m.chat.id}\nAsk Svetlana to link these in website setup.\n${help}`);return res.json({ok:true});}
 const kind=m.text.startsWith('/expense ')?'expenses':'sales';
 const existing=await db(`${kind}?telegram_update_id=eq.${req.body.update_id}`);
 if(existing.length){if(existing[0].sync_status!=='Synced')await sync(existing[0],kind);await confirm(existing[0],kind);return res.json({ok:true});}
 const [link]=await db(`telegram_links?telegram_user_id=eq.${m.from.id}`);
 if(!link)throw new InputError('Your Telegram account is not linked. Ask Svetlana to link it in manager setup.');
 let input;
 if(kind==='expenses'){
 const parts=m.text.slice(9).split('|').map(s=>s.trim());if(parts.length!==5)throw new InputError(help);
 const [reference,description,category,amount,proposed_allocation]=parts;input={reference,description,category,amount,proposed_allocation};
 }else{
 if(!m.text.startsWith('/sale '))throw new InputError(help);
 const parts=m.text.slice(6).split('|').map(s=>s.trim());if(parts.length!==6)throw new InputError(help);
 const [reference,customer,project,description,amount,shares]=parts;input={reference,customer,project,description,amount,shares:shares.split(',').map(s=>s.trim()===''?NaN:Number(s))};
 }
 await submit(input,link.employee,String(m.chat.id),req.body.update_id,kind);return res.json({ok:true});
 }catch(e){
 if(e instanceof InputError){try{await telegram(req.body.message.chat.id,e.message);return res.json({ok:true});}catch{}}
 return res.status(503).json({ok:false});
 }
}
