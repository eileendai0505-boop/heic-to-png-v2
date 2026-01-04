
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config({ path: ".env.development" });

async function main() {
  console.log("Testing DB connection...");
  try {
    const result = await db().execute(sql`SELECT NOW()`);
    console.log("Connection successful:", result);
    
    const allUsers = await db().select().from(users).limit(5);
    console.log("Users:", allUsers);
  } catch (e) {
    console.error("DB Connection Failed:", e);
  }
  process.exit(0);
}

main();
