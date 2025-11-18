const dotenv = require('dotenv');
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// Load the appropriate .env file based on NODE_ENV
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
} else {
  // Default to development or a generic .env file
  dotenv.config({ path: '.env.development' });
}
console.log(process.env);
const PORT = process.env.PORT || 3000;

// --- DATABASE CONNECTION ---
// Make sure your .env file has: DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT
const pool = new Pool({
  user: process.env.DB_USER || 'your_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'your_database_name',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

// Middleware
app.use(cors()); // Allow React frontend to connect
app.use(express.json());

// --- HELPER FUNCTIONS ---

// Calculate Grade if missing in DB (Standard 10-point scale)
const calculateGrade = (obtained, max) => {
  if (!max || max === 0) return 'N/A';
  const percentage = (obtained / max) * 100;
  
  if (percentage >= 91) return 'A1';
  if (percentage >= 81) return 'A2';
  if (percentage >= 71) return 'B1';
  if (percentage >= 61) return 'B2';
  if (percentage >= 51) return 'C1';
  if (percentage >= 41) return 'C2';
  if (percentage >= 35) return 'D';
  return 'E'; // Fail
};

// Format Date to YYYY-MM-DD
const formatDate = (dateObj) => {
  if (!dateObj) return '';
  return new Date(dateObj).toISOString().split('T')[0];
};

// --- API ROUTES ---

// GET /api/public/student/:token
// This is the main endpoint called by the Parent Portal
app.get('/api/public/student/:token', async (req, res) => {
  const { token } = req.params;

  // Basic UUID validation regex to prevent SQL injection risks
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(token)) {
    return res.status(400).json({ error: 'Invalid access link format.' });
  }

  const client = await pool.connect();

  try {
    // 1. FETCH STUDENT & SCHOOL DETAILS
    // We join Students -> Classes -> Schools -> Districts
    const studentQuery = `
      SELECT 
        s.id as student_id,
        s.name,
        s.name_telugu,
        s.pen_number,
        s.parent_phone,
        s.date_of_birth,
        
        c.grade_level,
        c.section_name,
        
        sch.name as school_name,
        sch.name_telugu as school_name_telugu,
        sch.udise_code,
        sch.address as school_address,
        sch.address_telugu as school_address_telugu,
        
        d.name as district_name,
        d.name_telugu as district_name_telugu
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      JOIN schools sch ON s.school_id = sch.id
      JOIN districts d ON sch.district_id = d.id
      WHERE s.parent_access_token = $1
    `;

    const studentRes = await client.query(studentQuery, [token]);

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student record not found or link is invalid.' });
    }

    const studentRow = studentRes.rows[0];
    const studentId = studentRow.student_id;

    // Format Class Name (e.g., "Grade 10 - A")
    const className = studentRow.grade_level 
      ? `Grade ${studentRow.grade_level} - ${studentRow.section_name}` 
      : 'Class Not Assigned';

    // 2. FETCH ALL MARKS (Grouped by Exam)
    // We fetch raw rows sorted by Exam Date (Most recent first)
    const marksQuery = `
      SELECT 
        e.id as exam_id,
        e.name as exam_name,
        e.name_telugu as exam_name_telugu,
        e.start_date,
        
        sub.name as subject_name,
        sub.name_telugu as subject_name_telugu,
        
        m.marks_obtained,
        m.max_marks,
        m.grade
      FROM marks m
      JOIN exams e ON m.exam_id = e.id
      JOIN subjects sub ON m.subject_id = sub.id
      WHERE m.student_id = $1
      ORDER BY e.start_date DESC, sub.id ASC
    `;

    const marksRes = await client.query(marksQuery, [studentId]);

    // 3. TRANSFORM DATA (Group rows into nested Exam Objects)
    // The DB returns flat rows. We need to group them:
    // [Row1, Row2] -> [{ exam: "Quarterly", subjects: [...] }]
    
    const examsMap = new Map();

    marksRes.rows.forEach(row => {
      if (!examsMap.has(row.exam_id)) {
        examsMap.set(row.exam_id, {
          exam_name: row.exam_name,
          exam_name_telugu: row.exam_name_telugu,
          exam_date: formatDate(row.start_date),
          subjects: []
        });
      }

      const examEntry = examsMap.get(row.exam_id);
      
      // Use DB grade if exists, otherwise calculate it
      const finalGrade = row.grade || calculateGrade(row.marks_obtained, row.max_marks);

      examEntry.subjects.push({
        name: row.subject_name,
        name_telugu: row.subject_name_telugu,
        marks: Number(row.marks_obtained),
        max: Number(row.max_marks),
        grade: finalGrade
      });
    });

    const resultsArray = Array.from(examsMap.values());

    // 4. CONSTRUCT FINAL RESPONSE
    const responseData = {
      student: {
        id: studentRow.student_id, // Internal ID (safe to send if needed by frontend logic, but hidden from user)
        name: studentRow.name,
        name_telugu: studentRow.name_telugu,
        pen_number: studentRow.pen_number,
        class_name: className,
        parent_phone: studentRow.parent_phone,
        dob: formatDate(studentRow.date_of_birth),
        school: {
          name: studentRow.school_name,
          name_telugu: studentRow.school_name_telugu,
          udise_code: studentRow.udise_code,
          district: studentRow.district_name,
          address: studentRow.school_address,
          address_telugu: studentRow.school_address_telugu
        }
      },
      results: resultsArray
    };

    res.json(responseData);

  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});