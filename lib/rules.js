export const employees = ['richard','anastasia','jean-claude','kevin','svetlana'];
export function sale(input, employee) {
 if (!employees.slice(0,3).includes(employee)) throw new Error('Only salespeople can submit sales.');
 const required = ['reference','customer','description','project'];
 for (const field of required) if (typeof input[field] !== 'string' || !input[field].trim()) throw new Error(`${field} is required.`);
 if (!/^[A-Za-z0-9_-]{1,40}$/.test(input.reference)) throw new Error('Use a reference of up to 40 letters, numbers, dashes or underscores.');
 if (!['A','B'].includes(input.project)) throw new Error('Project must be A or B.');
 const amount = String(input.amount);
 if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount)<=0 || Number(amount)>10000000) throw new Error('Enter a positive euro amount with at most two decimal places (maximum 10000000).');
 if (!Array.isArray(input.shares) || input.shares.length!==3 || input.shares.some(x=>!Number.isInteger(x)||x<0||x>100) || input.shares.reduce((a,b)=>a+b,0)!==100) throw new Error('Three whole-number commission shares must total 100%.');
 return {reference:input.reference,employee,customer:input.customer.trim(),project:input.project,description:input.description.trim(),amount_cents:Math.round(Number(amount)*100),shares:input.shares};
}
