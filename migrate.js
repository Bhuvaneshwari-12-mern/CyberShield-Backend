import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// 1. Connect to Local Database
const localDb = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// 2. Connect to Cloud Database (Aiven)
const cloudDb = await mysql.createConnection({
  host: process.env.CLOUD_DB_HOST,
  port: process.env.CLOUD_DB_PORT,
  user: process.env.CLOUD_DB_USER,
  password: process.env.CLOUD_DB_PASSWORD,
  database: process.env.CLOUD_DB_NAME,
  ssl: { rejectUnauthorized: false }
});

// Create in order (Parents first, then child)
const createOrder = ['DimDate', 'DimGeography', 'DimAttackType', 'DimSeverity', 'DimTargetSystem', 'FactIncidents'];
// Drop in reverse order (Child first, then parents)
const dropOrder = ['FactIncidents', 'DimTargetSystem', 'DimSeverity', 'DimAttackType', 'DimGeography', 'DimDate'];

async function migrate() {
  try {
    console.log('🚀 Starting Migration to Aiven Cloud...');

    // 1. Drop tables in reverse order to avoid foreign key errors
    console.log('🧹 Cleaning up old tables...');
    for (const table of dropOrder) {
      await cloudDb.query(`DROP TABLE IF EXISTS \`${table.toLowerCase()}\``);
    }

    // 2. Create tables in correct order
    console.log('🏗️ Creating new tables...');
    for (const table of createOrder) {
      const [createTableResult] = await localDb.query(`SHOW CREATE TABLE ${table}`);
      let createTableSql = createTableResult[0]['Create Table'];
      
      // Aiven forces lowercase table names and column names in foreign keys
      createTableSql = createTableSql.replace(/`Dim/g, '`dim').replace(/`Fact/g, '`fact');
      
      await cloudDb.query(createTableSql);
      console.log(`✅ Created table ${table.toLowerCase()} in cloud.`);
    }

    // 3. Copy data
    console.log('📦 Copying data...');
    for (const table of createOrder) {
      const [rows] = await localDb.query(`SELECT * FROM ${table}`);
      
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const placeholders = rows.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
        const values = rows.flatMap(row => columns.map(col => row[col]));
        
        const insertQuery = `INSERT INTO \`${table.toLowerCase()}\` (${columns.join(',')}) VALUES ${placeholders}`;
        await cloudDb.query(insertQuery, values);
        console.log(`✅ Copied ${rows.length} rows to ${table.toLowerCase()}.`);
      }
    }

    console.log('🎉 Migration Complete! Your data is now in the cloud.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration Failed:', error);
    process.exit(1);
  }
}

migrate();