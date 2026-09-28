import {db,submit,sync,confirm,approve,notifyDecision,listAll} from '../lib/services.js';
import {employees,results,InputError} from '../lib/rules.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try {
 const role=req.headers['x-demo-role'];
 if(!employees.includes(role))return res.status(403).json({error:'Select a demonstration role.'});
 if(req.method==='GET'){
 const filter=role==='svetlana'?'':`&employee=eq.${role}`;
 const [rows,expenses]=await Promise.all([listAll('sales',filter),listAll('expenses',filter)]);
 return res.json({rows,expenses,totals:role==='svetlana'?results(rows,expenses):null});
 }
 if(req.method!=='POST')return res.status(405).end();
 const b=req.body||{};
 if(['submit','submitExpense'].includes(b.action)){
 const links=await db(`telegram_links?employee=eq.${role}&order=telegram_user_id&limit=1`);
 await submit(b,role,links[0]?.chat_id,null,b.action==='submit'?'sales':'expenses');return res.json({ok:true});
 }
 if(role!=='svetlana')return res.status(403).json({error:'Only Svetlana can approve, manage links or retry delivery.'});
 if(b.action==='link'){
 if(!employees.includes(b.employee)||!/^\d+$/.test(b.userId)||!/^\d+$/.test(b.chatId))throw new InputError('Enter a valid employee, user ID and private chat ID.');
 const old=await db(`telegram_links?telegram_user_id=eq.${b.userId}`);
 await db(old.length?`telegram_links?telegram_user_id=eq.${b.userId}`:'telegram_links',old.length?'PATCH':'POST',{telegram_user_id:b.userId,chat_id:b.chatId,employee:b.employee});return res.json({ok:true});
 }
 if(!Number.isSafeInteger(b.id)||b.id<1||!['sales','expenses'].includes(b.kind))throw new InputError('Invalid record.');
 const [row]=await db(`${b.kind}?id=eq.${b.id}`);if(!row)throw new InputError('Record not found.');
 if(b.action==='approve')await approve(row,b.kind,b,role);
 else if(b.action==='retrySync')await sync(row,b.kind);
 else if(b.action==='retryTelegram')await confirm(row,b.kind);
 else if(b.action==='retryDecision')await notifyDecision(row,b.kind);
 else throw new InputError('Unknown action.');
 return res.json({ok:true});
 }catch(e){res.status(e instanceof InputError?400:503).json({error:e.message});}
}
