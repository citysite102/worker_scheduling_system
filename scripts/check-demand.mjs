import { drizzle } from 'drizzle-orm/mysql2';
import { demands } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);
const confirmedDemands = await db.select().from(demands).where(eq(demands.status, 'confirmed'));
console.log('第一筆需求單:', confirmedDemands[0]);
console.log('workDate 類型:', typeof confirmedDemands[0].workDate);
console.log('workDate 值:', confirmedDemands[0].workDate);
