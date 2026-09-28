import test from 'node:test';
import assert from 'node:assert/strict';
import {sale} from '../lib/rules.js';
const valid={reference:'S01',customer:'Olivia Rose',project:'A',description:'Uncle',amount:'1000.01',shares:[50,30,20]};
test('money stored as integer cents and salesperson identified by server',()=>{const s=sale({...valid,employee:'svetlana'},'richard');assert.equal(s.amount_cents,100001);assert.equal(s.employee,'richard');});
test('reporter and manager cannot submit sales',()=>{for(const role of ['kevin','svetlana',undefined])assert.throws(()=>sale(valid,role));});
test('reject invalid shares and amounts',()=>{for(const shares of [[60,30,20],[-1,51,50],[100],['50',30,20]])assert.throws(()=>sale({...valid,shares},'richard'));for(const amount of ['',0,-1,'1.001','NaN'])assert.throws(()=>sale({...valid,amount},'richard'));});
test('required information and project are validated',()=>{for(const field of ['reference','customer','description','project'])assert.throws(()=>sale({...valid,[field]:''},'richard'));assert.throws(()=>sale({...valid,project:'C'},'richard'));});
