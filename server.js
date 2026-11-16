import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Test Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CyberShield API is running!' });
});

// Get All Incidents (For the Dashboard)
app.get('/api/incidents', async (req, res) => {
  try {
    const query = `
      SELECT 
        f.IncidentID, 
        d.FullDate as Date, 
        g.Country, 
        g.Region, 
        a.Category as AttackCategory, 
        a.AttackName, 
        s.SeverityLevel as Severity, 
        t.SystemName as TargetSystem,
        f.Status
      FROM factincidents f
      JOIN dimdate d ON f.DateKey = d.DateKey
      JOIN dimgeography g ON f.GeographyKey = g.GeographyKey
      JOIN dimattacktype a ON f.AttackTypeKey = a.AttackTypeKey
      JOIN dimseverity s ON f.SeverityKey = s.SeverityKey
      JOIN dimtargetsystem t ON f.TargetSystemKey = t.TargetSystemKey
      ORDER BY d.FullDate DESC
      LIMIT 1000;
    `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 CyberShield Backend running on http://localhost:${PORT}`);
});