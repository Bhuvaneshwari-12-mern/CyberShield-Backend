import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const localDb = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'bhuvi123', 
  database: 'cybershield',
});

const cloudDb = await mysql.createConnection(
  'mysql://root:naPWJertOeVDqntcUkNoFTGOztGATsLv@gondola.proxy.rlwy.net:10966/railway'
);

// Create parents first
const createOrder = ['DimDate', 'DimGeography', 'DimAttackType', 'DimSeverity', 'DimTargetSystem', 'FactIncidents'];
// Drop children first
const dropOrder = ['FactIncidents', 'DimTargetSystem', 'DimSeverity', 'DimAttackType', 'DimGeography', 'DimDate'];

async function migrate() {
  try {
    console.log('🚀 Starting Migration to Railway...');

    // 1. Drop all tables in reverse order
    console.log('🧹 Cleaning up old tables...');
    for (const table of dropOrder) {
      await cloudDb.query(`DROP TABLE IF EXISTS \`${table.toLowerCase()}\``);
    }

    // 2. Create tables in correct order
    console.log('🏗️ Creating new tables...');
    for (const table of createOrder) {
      const [createTableResult] = await localDb.query(`SHOW CREATE TABLE ${table}`);
      let createTableSql = createTableResult[0]['Create Table'];
      
      // Force lowercase
      createTableSql = createTableSql.replace(new RegExp(`CREATE TABLE \`${table}\``, 'i'), `CREATE TABLE \`${table.toLowerCase()}\``);
      createTableSql = createTableSql.replace(/`Dim/g, '`dim').replace(/`Fact/g, '`fact');
      
      await cloudDb.query(createTableSql);
      console.log(`✅ Created table ${table.toLowerCase()}.`);
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

    console.log('🎉 Migration Complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration Failed:', error);
    process.exit(1);
  }
}

migrate();