import {timingSafeEqual} from 'node:crypto';
import {db,env,telegram,submit,sync,confirm} from '../lib/services.js';
export default async function handler(req,res) {
 if(req.method!=='POST') return res.status(405).end();
 const expected=Buffer.from(env('TELEGRAM_WEBHOOK_SECRET')), actual=Buffer.from(req.headers['x-telegram-bot-api-secret-token']||'');
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual)) return res.status(403).end();
 const m=req.body.message;
 if(!m?.text||m.chat.type!=='private') return res.json({ok:true});
 try {
 if(m.text==='/start') {await telegram(m.chat.id,`Your Telegram user ID: ${m.from.id}\nYour chat ID: ${m.chat.id}\nAsk the manager to link these in website setup.\nSubmit a sale:\n/sale PRACTICE01 | Olivia Rose | A | Proud uncle | 1000 | 50,30,20`); return res.json({ok:true});}
 const existing=await db(`sales?telegram_update_id=eq.${req.body.update_id}`);
 if(existing.length) {if(existing[0].sync_status!=='Synced') await sync(existing[0]); if(existing[0].confirmation_status!=='Sent') await confirm(existing[0]); return res.json({ok:true});}
 const [link]=await db(`telegram_links?telegram_user_id=eq.${m.from.id}`);
 if(!link) {await telegram(m.chat.id,'Your Telegram account is not linked. Ask Svetlana to link it in manager setup.');return res.json({ok:true});}
 if(!m.text.startsWith('/sale ')) throw new Error('Use /sale REF | Customer | A or B | Description | Amount | 50,30,20');
 const parts=m.text.slice(6).split('|').map(s=>s.trim());
 if(parts.length!==6) throw new Error('Provide all six sale fields, separated with |.');
 const [reference,customer,project,description,amount,split]=parts;
 await submit({reference,customer,project,description,amount,shares:split.split(',').map(Number)},link.employee,String(m.chat.id),req.body.update_id);
 return res.json({ok:true});
 } catch(e) {try {await telegram(m.chat.id,`Please check the website before resubmitting. ${e.message}`);} catch {} return res.status(500).json({ok:false});}
}
