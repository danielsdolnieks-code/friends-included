import {db,submit,sync,confirm} from '../lib/services.js';
import {employees} from '../lib/rules.js';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 try {
 const role=req.headers['x-demo-role'];
 if(!employees.includes(role)) return res.status(403).json({error:'Select a demonstration role.'});
 if(req.method==='GET') {
 const rows=await db(`sales?select=*&order=id.desc${role==='svetlana'?'':`&employee=eq.${role}`}`);
 return res.json({rows});
 }
 if(req.method!=='POST') return res.status(405).end();
 const b=req.body;
 if(b.action==='submit') {
 const links=await db(`telegram_links?employee=eq.${role}&limit=1`);
 await submit(b,role,links[0]?.chat_id); return res.json({ok:true});
 }
 if(role!=='svetlana') return res.status(403).json({error:'Only Svetlana can manage links or retry delivery.'});
 if(b.action==='link') {
 if(!employees.includes(b.employee)||!/^\d+$/.test(b.userId)||!/^\d+$/.test(b.chatId)) throw new Error('Enter a valid employee, Telegram user ID and private chat ID.');
 const old=await db(`telegram_links?telegram_user_id=eq.${b.userId}`);
 await db(old.length?`telegram_links?telegram_user_id=eq.${b.userId}`:'telegram_links',old.length?'PATCH':'POST',{telegram_user_id:b.userId,chat_id:b.chatId,employee:b.employee});
 return res.json({ok:true});
 }
 if(!Number.isSafeInteger(b.id)||b.id<1) throw new Error('Invalid record.');
 const [row]=await db(`sales?id=eq.${b.id}`); if(!row) throw new Error('Record not found.');
 if(b.action==='retrySync') await sync(row);
 else if(b.action==='retryTelegram') await confirm(row);
 else throw new Error('Unknown action.');
 return res.json({ok:true});
 } catch(e) {res.status(400).json({error:e.message});}
}
