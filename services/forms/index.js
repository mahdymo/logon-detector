const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors({
  origin: '*', // Allow all origins for external access
  credentials: false
}));
app.use(express.json());

// Save form endpoint
app.post('/save', async (req, res) => {
  try {
    const { target_url, fields, html_code } = req.body;
    
    if (!target_url || !fields || !html_code) {
      return res.status(400).json({ 
        error: 'Missing required fields: target_url, fields, html_code' 
      });
    }

    console.log(`Saving form for URL: ${target_url}`);

    const result = await pool.query(
      'INSERT INTO generated_forms (target_url, fields, html_code) VALUES ($1, $2, $3) RETURNING id',
      [target_url, JSON.stringify(fields), html_code]
    );

    console.log(`Form saved successfully with ID: ${result.rows[0].id}`);

    res.json({ id: result.rows[0].id });

  } catch (error) {
    console.error('Error saving form:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to save form' 
    });
  }
});

// Load forms endpoint
app.get('/list', async (req, res) => {
  try {
    console.log('Loading saved forms...');

    const result = await pool.query(
      'SELECT * FROM generated_forms ORDER BY created_at DESC'
    );

    console.log(`Loaded ${result.rows.length} saved forms`);

    res.json(result.rows);

  } catch (error) {
    console.error('Error loading forms:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to load forms' 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'forms' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Form service running on port ${port} and accessible from all interfaces`);
});
