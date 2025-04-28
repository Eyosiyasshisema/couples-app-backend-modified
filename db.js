import {pool} from"pg";
import dotenv from "dotenv";
dotenv.config();
 
const pool = new pool({
    connectionString:process.env.DATABASEURL
})
 export const query= (text,params) => pool.query(text,params)