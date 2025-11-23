const dotenv = require('dotenv');
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Load environment variables
if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production' });
} else {
  dotenv.config({ path: '.env.development' });
}

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this';

// Database Connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'school_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

app.use(cors());
app.use(express.json());

// --- HIERARCHY CONSTANTS ---
const ROLE_HIERARCHY = {
  'admin': 1,
  'deo': 2,
  'meo': 3,
  'school_admin': 4
};

// --- HELPER FUNCTIONS ---

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

const formatDate = (dateObj) => {
  if (!dateObj) return '';
  return new Date(dateObj).toISOString().split('T')[0];
};

// --- MIDDLEWARE: VERIFY TOKEN ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- MIDDLEWARE: ROLE CHECK ---
// Ensures user is authorized for specific scopes
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied. Insufficient permissions." });
    }
    next();
  };
};

// --- MIDDLEWARE: SCOPE GUARD ---
// Verifies if the logged-in user has jurisdiction over the target data
const verifyJurisdiction = (req, res, next) => {
  const user = req.user;
  const target = req.body; // The data being created/edited

  if (user.role === 'admin') return next(); // Admin has global access

  // 1. Check District Scope
  if (user.district_id && target.district_id && user.district_id !== target.district_id) {
    return res.status(403).json({ error: "Outside District Jurisdiction" });
  }
  
  // 2. Check Mandal Scope
  if (user.mandal_id && target.mandal_id && user.mandal_id !== target.mandal_id) {
    return res.status(403).json({ error: "Outside Mandal Jurisdiction" });
  }

  // 3. Check School Scope
  if (user.school_id && target.school_id && user.school_id !== target.school_id) {
    return res.status(403).json({ error: "Outside School Jurisdiction" });
  }

  next();
};

// --- ROUTES ---

// 1. LOGIN ROUTE
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    
    if (result.rows.length === 0) return res.status(400).json({ error: "User not found" });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) return res.status(400).json({ error: "Invalid password" });

    // Create Payload
    const payload = {
      id: user.id,
      role: user.role,
      district_id: user.district_id,
      mandal_id: user.mandal_id,
      school_id: user.school_id,
      name: user.full_name
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    res.json({ token, user: payload });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// 2. CREATE USER
app.post('/api/admin/create-user', authenticateToken, verifyJurisdiction, async (req, res) => {
  const { username, password, role, full_name, district_id, mandal_id, school_id } = req.body;
  const creatorRoleLevel = ROLE_HIERARCHY[req.user.role];
  const newUserRoleLevel = ROLE_HIERARCHY[role];

  if (newUserRoleLevel <= creatorRoleLevel) {
    return res.status(403).json({ error: "Cannot create a user with equal or higher authority." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const query = `
      INSERT INTO users (username, password_hash, role, full_name, district_id, mandal_id, school_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, username, role
    `;
    
    const result = await pool.query(query, [
      username, hashedPassword, role, full_name, 
      district_id || req.user.district_id, 
      mandal_id || req.user.mandal_id, 
      school_id || req.user.school_id
    ]);

    res.json({ message: "User created successfully", user: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error. Username might be duplicate." });
  }
});

// Custom School Create Route with Classes
app.post('/api/schools/create', authenticateToken, verifyJurisdiction, async (req, res) => {
  const { name, udise_code, address, district_id, mandal_id, grades } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Insert School
    const schoolQuery = `
      INSERT INTO schools (name, udise_code, address, district_id, mandal_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const schoolRes = await client.query(schoolQuery, [name, udise_code, address, district_id, mandal_id]);
    const schoolId = schoolRes.rows[0].id;

    // 2. Insert Classes
    if (grades && Array.isArray(grades) && grades.length > 0) {
      for (const grade of grades) {
        await client.query(
          `INSERT INTO classes (school_id, grade_level) VALUES ($1, $2)`,
          [schoolId, parseInt(grade)]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: "School and classes created successfully", school_id: schoolId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 3. GENERIC ENTITY ADD
app.post('/api/entities/:type/add', authenticateToken, verifyJurisdiction, async (req, res) => {
  const { type } = req.params;
  const data = req.body;

  const validTables = ['districts', 'mandals', 'schools', 'students', 'exams'];
  if (!validTables.includes(type)) return res.status(400).json({ error: "Invalid Entity" });

  try {
    const columns = Object.keys(data).join(', ');
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `INSERT INTO ${type} (${columns}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(query, values);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 4. GET ENTITIES (Scoped List with Dynamic Filtering)
app.get('/api/entities/:type', authenticateToken, async (req, res) => {
  const { type } = req.params;
  const { role, district_id, mandal_id, school_id } = req.user;
  
  // Extract query params for dropdown filtering
  const { district_id: q_district_id, mandal_id: q_mandal_id, school_id: q_school_id } = req.query;
  
  let query = `SELECT * FROM ${type} WHERE 1=1`;
  let params = [];
  let idx = 1;

  // --- SECURITY SCOPE (Enforced by Token) ---
  if (role !== 'admin') {
      if (['mandals', 'schools'].includes(type) && district_id) {
          query += ` AND district_id = $${idx++}`;
          params.push(district_id);
      }
      if (['schools'].includes(type) && mandal_id) {
         query += ` AND mandal_id = $${idx++}`;
         params.push(mandal_id);
      }
      if (type === 'students') {
          if (school_id) {
              query += ` AND school_id = $${idx++}`;
              params.push(school_id);
          } else if (mandal_id) {
              query = `SELECT s.* FROM students s 
                       JOIN schools sch ON s.school_id = sch.id 
                       WHERE sch.mandal_id = $${idx++}`;
              params.push(mandal_id);
          }
      }
  }

  // --- DROPDOWN FILTERING (User Selection) ---
  // Only apply if the parameter is provided in URL (e.g., ?district_id=XYZ)
  // This allows an Admin to select a district and see only its mandals
  
  // 1. Filter Mandals/Schools by District ID
  if (q_district_id) {
    // Only if table has this column
    if (['mandals', 'schools'].includes(type)) {
       query += ` AND district_id = $${idx++}`;
       params.push(q_district_id);
    }
  }

  // 2. Filter Schools by Mandal ID
  if (q_mandal_id) {
    if (['schools'].includes(type)) {
       query += ` AND mandal_id = $${idx++}`;
       params.push(q_mandal_id);
    }
  }

  if (q_school_id) {
    if (['classes', 'students'].includes(type)) {
      query += `AND school_id = $${idx++}`;
      params.push(q_school_id);
    }
  }

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/public/student/:token
app.get('/api/public/student/:token', async (req, res) => {
  const { token } = req.params;

  // Basic UUID validation regex
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(token)) {
    return res.status(400).json({ error: 'Invalid access link format.' });
  }

  const client = await pool.connect();

  try {
    // 1. FETCH STUDENT & SCHOOL DETAILS
    const studentQuery = `
      SELECT 
        s.id as student_id,
        s.name,
        s.name_telugu,
        s.pen_number,
        s.parent_phone,
        s.date_of_birth,
        
        c.grade_level,
        
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

    const className = studentRow.grade_level 
      ? `Grade ${studentRow.grade_level}` 
      : 'Class Not Assigned';

    // 2. FETCH ALL MARKS (Modified to include Averages)
    // --- CHANGED: Added joins to 'students' (for class_id) and 'exam_class_statistics' ---
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
        m.grade,

        -- New Statistics Columns
        stats.average_marks as class_average,
        stats.highest_marks as class_highest,
        stats.lowest_marks as class_lowest

      FROM marks m
      JOIN exams e ON m.exam_id = e.id
      JOIN subjects sub ON m.subject_id = sub.id
      JOIN students s ON m.student_id = s.id -- Joined to get s.class_id
      
      -- Join the stats table on Exam + Subject + Class
      LEFT JOIN exam_class_statistics stats 
        ON m.exam_id = stats.exam_id 
        AND m.subject_id = stats.subject_id
        AND s.class_id = stats.class_id
        
      WHERE m.student_id = $1
      ORDER BY e.start_date DESC, sub.id ASC
    `;

    const marksRes = await client.query(marksQuery, [studentId]);

    // 3. TRANSFORM DATA
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
      
      const finalGrade = row.grade || calculateGrade(row.marks_obtained, row.max_marks);

      // --- CHANGED: Push statistics into the subject object ---
      examEntry.subjects.push({
        name: row.subject_name,
        name_telugu: row.subject_name_telugu,
        marks: Number(row.marks_obtained),
        max: Number(row.max_marks),
        grade: finalGrade,
        
        // Convert to Number to handle PostgreSQL numeric type (which returns as string)
        class_avg: row.class_average ? Number(row.class_average) : null, 
        class_max: row.class_highest ? Number(row.class_highest) : null,
        class_min: row.class_lowest ? Number(row.class_lowest) : null
      });
    });

    const resultsArray = Array.from(examsMap.values());

    // 4. CONSTRUCT FINAL RESPONSE
    const responseData = {
      student: {
        id: studentRow.student_id,
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

// 3. PROTECTED: DASHBOARD STATS (Example of Role Based Access)
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  const { role, district_id, mandal_id, school_id } = req.user;

  try {
    let query = '';
    let params = [];

    // DYNAMIC QUERY BASED ON ROLE
    if (role === 'admin') {
      // Admin sees everything
      query = `SELECT 
                (SELECT COUNT(*) FROM schools) as school_count,
                (SELECT COUNT(*) FROM students) as student_count`;
    } else if (role === 'deo') {
      // DEO sees only their district
      query = `SELECT 
                (SELECT COUNT(*) FROM schools WHERE district_id = $1) as school_count,
                (SELECT COUNT(*) FROM students s JOIN schools sch ON s.school_id = sch.id WHERE sch.district_id = $1) as student_count`;
      params = [district_id];
    } else if (role === 'meo') {
      // MEO sees only their mandal
      query = `SELECT 
                (SELECT COUNT(*) FROM schools WHERE mandal_id = $1) as school_count,
                (SELECT COUNT(*) FROM students s JOIN schools sch ON s.school_id = sch.id WHERE sch.mandal_id = $1) as student_count`;
      params = [mandal_id];
    } else if (role === 'school_admin') {
      // Teacher sees only their school
      query = `SELECT 
                1 as school_count,
                (SELECT COUNT(*) FROM students WHERE school_id = $1) as student_count`;
      params = [school_id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// --- MARKS ROUTES ---

// 1. FETCH EXISTING MARKS (For Pre-filling)
// This joins marks with students to ensure we only get marks for the specific class context
app.get('/api/marks/fetch', authenticateToken, async (req, res) => {
  const { exam_id, subject_id, class_id } = req.query;
  if (!exam_id || !subject_id || !class_id) return res.status(400).json({ error: "Missing params" });

  try {
    const query = `
      SELECT m.student_id, m.marks_obtained, m.max_marks 
      FROM marks m 
      JOIN students s ON m.student_id = s.id 
      WHERE m.exam_id = $1 AND m.subject_id = $2 AND s.class_id = $3
    `;
    const result = await pool.query(query, [exam_id, subject_id, class_id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

// UPDATED: BULK UPDATE MARKS + RECALCULATE STATISTICS
app.post('/api/marks/bulk-update', authenticateToken, async (req, res) => {
  const { exam_id, subject_id, marks_data } = req.body; 
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Insert/Update Marks
    for (const entry of marks_data) {
      const query = `
        INSERT INTO marks (student_id, exam_id, subject_id, marks_obtained, max_marks, grade)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (student_id, exam_id, subject_id) 
        DO UPDATE SET 
          marks_obtained = EXCLUDED.marks_obtained, 
          max_marks = EXCLUDED.max_marks,
          grade = EXCLUDED.grade,
          updated_at = CURRENT_TIMESTAMP
      `;
      await client.query(query, [entry.student_id, exam_id, subject_id, entry.marks, entry.max_marks || 100, entry.grade]);
    }

    // 2. Recalculate Exam Statistics (Avg, Min, Max) for affected classes
    // This aggregates data from the marks table for this specific Exam and Subject
    const statsQuery = `
      INSERT INTO exam_class_statistics (exam_id, subject_id, class_id, average_marks, highest_marks, lowest_marks)
      SELECT 
          m.exam_id, 
          m.subject_id, 
          s.class_id, 
          ROUND(AVG(m.marks_obtained), 2), 
          MAX(m.marks_obtained), 
          MIN(m.marks_obtained)
      FROM marks m
      JOIN students s ON m.student_id = s.id
      WHERE m.exam_id = $1 AND m.subject_id = $2
      GROUP BY m.exam_id, m.subject_id, s.class_id
      ON CONFLICT (exam_id, class_id, subject_id) 
      DO UPDATE SET 
          average_marks = EXCLUDED.average_marks,
          highest_marks = EXCLUDED.highest_marks,
          lowest_marks = EXCLUDED.lowest_marks
    `;
    await client.query(statsQuery, [exam_id, subject_id]);

    await client.query('COMMIT');
    res.json({ message: "Marks updated and statistics recalculated" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  } finally {
    client.release();
  }
});

// --- QR CODE DATA ENDPOINT (Updated with Class Filter) ---
app.get('/api/schools/:schoolId/qr-data', authenticateToken, async (req, res) => {
  const { schoolId } = req.params;
  const { class_id } = req.query; // Read optional query param
  const { role, district_id, mandal_id, school_id } = req.user;

  // Security Check
  if (role !== 'admin') {
    if (role === 'school_admin' && school_id !== schoolId) return res.status(403).json({ error: "Unauthorized" });
    // Note: In prod, add checks for DEO/MEO to ensure schoolId belongs to their jurisdiction
  }

  try {
    let query = `
      SELECT 
        s.name as student_name,
        s.parent_access_token,
        s.pen_number,
        c.grade_level,
        sch.name as school_name
      FROM students s
      JOIN schools sch ON s.school_id = sch.id
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE s.school_id = $1
    `;
    
    const params = [schoolId];

    // Dynamic Filter: If class_id is provided and not 'all', filter by it
    if (class_id && class_id !== 'all') {
      query += ` AND s.class_id = $${params.length + 1}`;
      params.push(class_id);
    }

    query += ` ORDER BY c.grade_level ASC, s.name ASC`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error fetching QR data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});