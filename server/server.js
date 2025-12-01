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
  if (user && user.district_id && target.district_id && user.district_id !== target.district_id) {
    return res.status(403).json({ error: "Outside District Jurisdiction" });
  }

  // 2. Check Mandal Scope
  if (user && user.mandal_id && target.mandal_id && user.mandal_id !== target.mandal_id) {
    return res.status(403).json({ error: "Outside Mandal Jurisdiction" });
  }

  // 3. Check School Scope
  if (user && user.school_id && target.school_id && user.school_id !== target.school_id) {
    return res.status(403).json({ error: "Outside School Jurisdiction" });
  }

  next();
};

// --- ROUTES ---

// 1. LOGIN ROUTE
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(`
      SELECT u.*, d.name as district_name, m.name as mandal_name, s.name as school_name
      FROM users u
      LEFT JOIN districts d ON u.district_id = d.id
      LEFT JOIN mandals m ON u.mandal_id = m.id
      LEFT JOIN schools s ON u.school_id = s.id
      WHERE u.username = $1
    `, [username]);

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
      name: user.full_name,
      district_name: user.district_name,
      mandal_name: user.mandal_name,
      school_name: user.school_name
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

// 2a. GET USERS (Scoped)
app.get('/api/admin/users', authenticateToken, verifyJurisdiction, async (req, res) => {
  const { role, district_id, mandal_id, school_id } = req.user;

  let query = `
    SELECT u.id, u.username, u.role, u.full_name, u.district_id, u.mandal_id, u.school_id,
           d.name as district_name, m.name as mandal_name, s.name as school_name
    FROM users u
    LEFT JOIN districts d ON u.district_id = d.id
    LEFT JOIN mandals m ON u.mandal_id = m.id
    LEFT JOIN schools s ON u.school_id = s.id
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (role !== 'admin') {
    if (district_id) { query += ` AND u.district_id = $${idx++}`; params.push(district_id); }
    if (mandal_id) { query += ` AND u.mandal_id = $${idx++}`; params.push(mandal_id); }
    if (school_id) { query += ` AND u.school_id = $${idx++}`; params.push(school_id); }
  }

  query += ` ORDER BY u.created_at DESC`;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// 2b. UPDATE USER
app.put('/api/admin/users/:id', authenticateToken, verifyJurisdiction, async (req, res) => {
  const { id } = req.params;
  const { username, password, role, full_name, district_id, mandal_id, school_id } = req.body;

  // Hierarchy Check
  const targetUserRes = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
  if (targetUserRes.rows.length === 0) return res.status(404).json({ error: "User not found" });

  const targetRoleLevel = ROLE_HIERARCHY[targetUserRes.rows[0].role];
  const creatorRoleLevel = ROLE_HIERARCHY[req.user.role];

  // Cannot edit someone with higher or equal rank (unless it's yourself, but UI should prevent self-role-change)
  if (targetRoleLevel <= creatorRoleLevel && req.user.id !== parseInt(id)) {
    return res.status(403).json({ error: "Insufficient permissions to edit this user." });
  }

  try {
    // Check if username is being changed and if it's already taken by another user
    const usernameCheck = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, id]);
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: "Username is already taken by another user." });
    }

    // Convert empty strings to null for UUID fields
    const district_id_val = district_id && district_id !== '' ? district_id : null;
    const mandal_id_val = mandal_id && mandal_id !== '' ? mandal_id : null;
    const school_id_val = school_id && school_id !== '' ? school_id : null;

    let query, params;
    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      query = `
        UPDATE users 
        SET username=$1, password_hash=$2, role=$3, full_name=$4, district_id=$5, mandal_id=$6, school_id=$7
        WHERE id=$8 RETURNING id, username, role, full_name
      `;
      params = [username, hashedPassword, role, full_name, district_id_val, mandal_id_val, school_id_val, id];
    } else {
      query = `
        UPDATE users 
        SET username=$1, role=$2, full_name=$3, district_id=$4, mandal_id=$5, school_id=$6
        WHERE id=$7 RETURNING id, username, role, full_name
      `;
      params = [username, role, full_name, district_id_val, mandal_id_val, school_id_val, id];
    }

    const result = await pool.query(query, params);
    res.json({ message: "User updated successfully", user: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed. Please try again." });
  }
});

// 2c. DELETE USER
app.delete('/api/admin/users/:id', authenticateToken, verifyJurisdiction, async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: "Cannot delete yourself." });
  }

  // Hierarchy Check
  const targetUserRes = await pool.query('SELECT role FROM users WHERE id = $1', [id]);
  if (targetUserRes.rows.length === 0) return res.status(404).json({ error: "User not found" });

  const targetRoleLevel = ROLE_HIERARCHY[targetUserRes.rows[0].role];
  const creatorRoleLevel = ROLE_HIERARCHY[req.user.role];

  if (targetRoleLevel <= creatorRoleLevel) {
    return res.status(403).json({ error: "Insufficient permissions to delete this user." });
  }

  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// --- SCHOOL ROUTES (UPDATED) ---
app.post('/api/schools/create', authenticateToken, verifyJurisdiction, async (req, res) => {
  // CHANGED: Added name_telugu and address_telugu
  const { name, name_telugu, udise_code, address, address_telugu, district_id, mandal_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // CHANGED: Updated SQL to insert Telugu fields
    const schoolQuery = `
      INSERT INTO schools (name, name_telugu, udise_code, address, address_telugu, district_id, mandal_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING id
    `;
    const schoolRes = await client.query(schoolQuery, [name, name_telugu, udise_code, address, address_telugu, district_id, mandal_id]);
    const schoolId = schoolRes.rows[0].id;

    await client.query('COMMIT');
    res.json({ message: "School created successfully", school_id: schoolId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
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

// 3a. GENERIC ENTITY UPDATE
app.put('/api/entities/:type/:id', authenticateToken, verifyJurisdiction, async (req, res) => {
  const { type, id } = req.params;
  const data = req.body;

  const validTables = ['districts', 'mandals', 'schools', 'students', 'exams'];
  if (!validTables.includes(type)) return res.status(400).json({ error: "Invalid Entity" });

  try {
    // Filter out id from data if present to avoid updating it
    const { id: _, ...updateData } = data;

    const updates = Object.keys(updateData).map((key, i) => `${key} = $${i + 1}`).join(', ');
    const values = Object.values(updateData);

    const query = `UPDATE ${type} SET ${updates} WHERE id = $${values.length + 1} RETURNING *`;
    const result = await pool.query(query, [...values, id]);

    if (result.rows.length === 0) return res.status(404).json({ error: "Entity not found" });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 3b. GENERIC ENTITY DELETE
app.delete('/api/entities/:type/:id', authenticateToken, verifyJurisdiction, async (req, res) => {
  const { type, id } = req.params;

  const validTables = ['districts', 'mandals', 'schools', 'students', 'exams'];
  if (!validTables.includes(type)) return res.status(400).json({ error: "Invalid Entity" });

  try {
    // For students, we might want to cascade delete marks or handle it in DB. 
    // Assuming DB has ON DELETE CASCADE or we just delete the student.
    const query = `DELETE FROM ${type} WHERE id = $1 RETURNING id`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) return res.status(404).json({ error: "Entity not found" });

    res.json({ message: "Deleted successfully", id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 4. GET ENTITIES (Scoped List with Dynamic Filtering)
app.get('/api/entities/:type', authenticateToken, async (req, res) => {
  const { type } = req.params;
  const { role, district_id, mandal_id, school_id } = req.user;
  const { district_id: q_d, mandal_id: q_m, school_id: q_s } = req.query;

  // HIGHLIGHT: Auto-seed Global Classes if empty
  if (type === 'classes') {
    const check = await pool.query('SELECT count(*) FROM classes');
    if (parseInt(check.rows[0].count) === 0) {
      console.log("Seeding Global Classes...");
      for (let i = 6; i <= 10; i++) {
        await pool.query('INSERT INTO classes (grade_level) VALUES ($1)', [i]);
      }
    }
  }

  let query = `SELECT * FROM ${type} WHERE 1=1`;
  let params = [];
  let idx = 1;

  // HIGHLIGHT: Exclude 'classes' from Role-Based Filtering
  if (['exams', 'classes'].includes(type)) {
    // Global entities: Everyone sees all Grades and all Exams
  } else if (role !== 'admin') {
    if (['mandals', 'schools'].includes(type) && district_id) { query += ` AND district_id = $${idx++}`; params.push(district_id); }
    if (['schools', 'students'].includes(type) && mandal_id) { query += ` AND mandal_id = $${idx++}`; params.push(mandal_id); }
    if (['students'].includes(type) && school_id) { query += ` AND school_id = $${idx++}`; params.push(school_id); }
  }

  // HIGHLIGHT: Exclude 'classes' from Dropdown Filtering
  if (q_d && ['mandals', 'schools'].includes(type)) { query += ` AND district_id = $${idx++}`; params.push(q_d); }
  if (q_m && ['schools'].includes(type)) { query += ` AND mandal_id = $${idx++}`; params.push(q_m); }
  if (q_s && ['students'].includes(type)) { query += ` AND school_id = $${idx++}`; params.push(q_s); }

  // Note: We intentionally removed the check that filtered classes by school_id

  // Optional: Order classes numerically
  if (type === 'classes') query += ` ORDER BY grade_level ASC`;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/public/student/:token
app.get('/api/public/student/:token', async (req, res) => {
  const { token } = req.params;

  // Basic UUID format check
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(token)) {
    return res.status(400).json({ error: 'Invalid access link format.' });
  }

  const client = await pool.connect();

  try {
    // 1. FETCH STUDENT & SCHOOL DETAILS
    // Updated to include Mandals and handle Global Classes (no section)
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
        
        mandal.name as mandal_name,
        mandal.name_telugu as mandal_name_telugu,

        d.name as district_name,
        d.name_telugu as district_name_telugu -- Assuming district has telugu name column now, or ignore if not
      FROM students s
      LEFT JOIN classes c ON s.class_id = c.id
      JOIN schools sch ON s.school_id = sch.id
      LEFT JOIN mandals mandal ON sch.mandal_id = mandal.id
      JOIN districts d ON sch.district_id = d.id
      WHERE s.parent_access_token = $1
    `;

    const studentRes = await client.query(studentQuery, [token]);

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student record not found or link is invalid.' });
    }

    const studentRow = studentRes.rows[0];
    const studentId = studentRow.student_id;

    // Format Class Name (Just Grade now)
    const className = studentRow.grade_level ? `Grade ${studentRow.grade_level}` : 'Class Not Assigned';

    // 2. FETCH ALL MARKS (Grouped by Exam)
    // Updated to join Statistics using SCHOOL_ID + CLASS_ID + EXAM_ID
    const marksQuery = `
      SELECT 
        e.id as exam_id,
        e.name as exam_name,
        e.exam_code,
        e.start_date,
        
        sub.name as subject_name,
        sub.name_telugu as subject_name_telugu,
        
        m.marks_obtained,
        m.max_marks,
        m.grade,

        -- Statistics (Scoped to this student's school and class)
        stats.average_marks as class_average,
        stats.highest_marks as class_highest,
        stats.lowest_marks as class_lowest

      FROM marks m
      JOIN exams e ON m.exam_id = e.id
      JOIN subjects sub ON m.subject_id = sub.id
      JOIN students s ON m.student_id = s.id
      
      -- Join stats: Match Exam, Subject, Global Class, AND Specific School
      LEFT JOIN exam_class_statistics stats 
        ON m.exam_id = stats.exam_id 
        AND m.subject_id = stats.subject_id
        AND s.class_id = stats.class_id
        AND s.school_id = stats.school_id 
        
      WHERE m.student_id = $1
      ORDER BY e.start_date DESC, sub.id ASC
    `;

    const marksRes = await client.query(marksQuery, [studentId]);

    // 3. TRANSFORM DATA (Group rows into nested Exam Objects)
    const examsMap = new Map();

    const formatDate = (dateObj) => {
      if (!dateObj) return '';
      return new Date(dateObj).toISOString().split('T')[0];
    };

    marksRes.rows.forEach(row => {
      if (!examsMap.has(row.exam_id)) {
        examsMap.set(row.exam_id, {
          exam_name: row.exam_name,
          // Assuming exams table might have name_telugu, if not, frontend handles fallback
          exam_name_telugu: row.name_telugu || row.exam_name,
          exam_date: formatDate(row.start_date),
          subjects: []
        });
      }

      const examEntry = examsMap.get(row.exam_id);

      examEntry.subjects.push({
        name: row.subject_name,
        name_telugu: row.subject_name_telugu,
        marks: Number(row.marks_obtained),
        max: Number(row.max_marks),
        grade: row.grade, // Use the grade from DB

        // Stats
        class_avg: row.class_average ? Number(row.class_average) : null,
        class_max: row.class_highest ? Number(row.class_highest) : null,
        class_min: row.class_lowest ? Number(row.class_lowest) : null
      });
    });

    const resultsArray = Array.from(examsMap.values());

    // 4. CONSTRUCT FINAL RESPONSE
    const responseData = {
      student: {
        // Sensitive ID removed for public view
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
          mandal: studentRow.mandal_name, // Added Mandal
          address: studentRow.school_address,
          address_telugu: studentRow.school_address_telugu
        }
      },
      results: resultsArray
    };

    res.json(responseData);

  } catch (err) {
    console.error('API Public Fetch Error:', err);
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
// UPDATED: Fetch Marks (subject_id is now optional)
app.get('/api/marks/fetch', authenticateToken, async (req, res) => {
  const { exam_id, subject_id, class_id } = req.query;

  if (!exam_id || !class_id) return res.status(400).json({ error: "Missing exam_id or class_id" });

  try {
    let query = `
      SELECT m.student_id, m.subject_id, m.marks_obtained, m.max_marks 
      FROM marks m 
      JOIN students s ON m.student_id = s.id 
      WHERE m.exam_id = $1 AND s.class_id = $2
    `;
    const params = [exam_id, class_id];

    // Only filter by subject if provided and not 'all'
    if (subject_id && subject_id !== 'all') {
      query += ` AND m.subject_id = $3`;
      params.push(subject_id);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch failed" });
  }
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

// --- ANALYTICS ROUTES ---

// 0. DASHBOARD STATS (Schools, Students, Exams)
app.get('/api/analytics/stats', authenticateToken, async (req, res) => {
  const { exam_id, district_id, mandal_id, school_id } = req.query;
  const { role, district_id: user_d, mandal_id: user_m, school_id: user_s } = req.user;

  // Scope Resolution
  const d_id = (role !== 'admin' && user_d) ? user_d : district_id;
  const m_id = (role !== 'admin' && user_m) ? user_m : mandal_id;
  const s_id = (role !== 'admin' && user_s) ? user_s : school_id;

  try {
    const params = [];
    let whereClause = 'WHERE 1=1';

    if (d_id) { whereClause += ` AND sch.district_id = $${params.length + 1}`; params.push(d_id); }
    if (m_id) { whereClause += ` AND sch.mandal_id = $${params.length + 1}`; params.push(m_id); }
    if (s_id) { whereClause += ` AND s.school_id = $${params.length + 1}`; params.push(s_id); }

    // We need to join tables to apply filters correctly
    // Count Schools
    const schoolsQuery = `
        SELECT COUNT(DISTINCT sch.id) as count
        FROM schools sch
        JOIN students s ON s.school_id = sch.id -- Ensure school has students? Optional.
        ${whereClause}
    `;

    // Count Students
    const studentsQuery = `
        SELECT COUNT(DISTINCT s.id) as count
        FROM students s
        JOIN schools sch ON s.school_id = sch.id
        ${whereClause}
    `;

    // Count Exams (Tests Conducted) - based on marks table to ensure they actually happened
    const examsQuery = `
        SELECT COUNT(DISTINCT m.exam_id) as count
        FROM marks m
        JOIN students s ON m.student_id = s.id
        JOIN schools sch ON s.school_id = sch.id
        ${whereClause}
        ${exam_id ? `AND m.exam_id = $${params.length + 1}` : ''} 
    `;
    // Note: if exam_id is passed, it will count 1 (if exists). If not, it counts all distinct exams in scope.

    // Re-doing query construction for clarity and correctness


    // 1. Schools Count
    let s_where = 'WHERE 1=1';
    let s_params = [];
    if (d_id) { s_where += ` AND district_id = $${s_params.length + 1}`; s_params.push(d_id); }
    if (m_id) { s_where += ` AND mandal_id = $${s_params.length + 1}`; s_params.push(m_id); }
    if (s_id) { s_where += ` AND id = $${s_params.length + 1}`; s_params.push(s_id); }
    const resSchools = await pool.query(`SELECT COUNT(*) as count FROM schools ${s_where}`, s_params);

    // 2. Students Count
    let st_where = 'WHERE 1=1';
    let st_params = [];
    if (d_id) { st_where += ` AND sch.district_id = $${st_params.length + 1}`; st_params.push(d_id); }
    if (m_id) { st_where += ` AND sch.mandal_id = $${st_params.length + 1}`; st_params.push(m_id); }
    if (s_id) { st_where += ` AND s.school_id = $${st_params.length + 1}`; st_params.push(s_id); }
    const resStudents = await pool.query(`
        SELECT COUNT(DISTINCT s.id) as count 
        FROM students s 
        JOIN schools sch ON s.school_id = sch.id 
        ${st_where}`, st_params);

    // 3. Exams Count
    let e_where = 'WHERE 1=1';
    let e_params = [];
    if (d_id) { e_where += ` AND sch.district_id = $${e_params.length + 1}`; e_params.push(d_id); }
    if (m_id) { e_where += ` AND sch.mandal_id = $${e_params.length + 1}`; e_params.push(m_id); }
    if (s_id) { e_where += ` AND s.school_id = $${e_params.length + 1}`; e_params.push(s_id); }
    if (exam_id) { e_where += ` AND m.exam_id = $${e_params.length + 1}`; e_params.push(exam_id); }

    const resExams = await pool.query(`
        SELECT COUNT(DISTINCT m.exam_id) as count 
        FROM marks m 
        JOIN students s ON m.student_id = s.id 
        JOIN schools sch ON s.school_id = sch.id 
        ${e_where}`, e_params);

    // 4. Grade A Students Count (Avg >= 80%)
    let ga_where = 'WHERE 1=1';
    let ga_params = [];
    if (d_id) { ga_where += ` AND sch.district_id = $${ga_params.length + 1}`; ga_params.push(d_id); }
    if (m_id) { ga_where += ` AND sch.mandal_id = $${ga_params.length + 1}`; ga_params.push(m_id); }
    if (s_id) { ga_where += ` AND s.school_id = $${ga_params.length + 1}`; ga_params.push(s_id); }
    if (exam_id) { ga_where += ` AND m.exam_id = $${ga_params.length + 1}`; ga_params.push(exam_id); }

    const resGrades = await pool.query(`
        SELECT 
            COUNT(CASE WHEN avg_pct >= 80 THEN 1 END) as grade_a,
            COUNT(CASE WHEN avg_pct >= 60 AND avg_pct < 80 THEN 1 END) as grade_b,
            COUNT(CASE WHEN avg_pct >= 35 AND avg_pct < 60 THEN 1 END) as grade_c,
            COUNT(CASE WHEN avg_pct < 35 THEN 1 END) as grade_d
        FROM (
            SELECT m.student_id, AVG((m.marks_obtained::decimal / m.max_marks) * 100) as avg_pct
            FROM marks m
            JOIN students s ON m.student_id = s.id
            JOIN schools sch ON s.school_id = sch.id
            ${ga_where}
            GROUP BY m.student_id
        ) as student_avgs
    `, ga_params);

    res.json({
      total_schools: parseInt(resSchools.rows[0].count),
      total_students: parseInt(resStudents.rows[0].count),
      total_exams: parseInt(resExams.rows[0].count),
      grade_a_students: parseInt(resGrades.rows[0].grade_a),
      grade_b_students: parseInt(resGrades.rows[0].grade_b),
      grade_c_students: parseInt(resGrades.rows[0].grade_c),
      grade_d_students: parseInt(resGrades.rows[0].grade_d)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
app.get('/api/analytics/performance-distribution', authenticateToken, async (req, res) => {
  const { exam_id, district_id, mandal_id, school_id } = req.query;
  const { role, district_id: user_d, mandal_id: user_m, school_id: user_s } = req.user;

  // Scope Resolution
  const d_id = (role !== 'admin' && user_d) ? user_d : district_id;
  const m_id = (role !== 'admin' && user_m) ? user_m : mandal_id;
  const s_id = (role !== 'admin' && user_s) ? user_s : school_id;

  try {
    const query = `
      SELECT 
        sub.name as subject,
        COUNT(CASE WHEN (m.marks_obtained::decimal / m.max_marks) * 100 >= 80 THEN 1 END) as grade_a,
        COUNT(CASE WHEN (m.marks_obtained::decimal / m.max_marks) * 100 >= 60 AND (m.marks_obtained::decimal / m.max_marks) * 100 < 80 THEN 1 END) as grade_b,
        COUNT(CASE WHEN (m.marks_obtained::decimal / m.max_marks) * 100 >= 35 AND (m.marks_obtained::decimal / m.max_marks) * 100 < 60 THEN 1 END) as grade_c,
        COUNT(CASE WHEN (m.marks_obtained::decimal / m.max_marks) * 100 < 35 THEN 1 END) as grade_d,
        COUNT(*) as total
      FROM marks m
      JOIN students s ON m.student_id = s.id
      JOIN schools sch ON s.school_id = sch.id
      JOIN subjects sub ON m.subject_id = sub.id
      WHERE 1=1
        ${exam_id ? `AND m.exam_id = $1` : ''}
        ${d_id ? `AND sch.district_id = $${exam_id ? 2 : 1}` : ''}
        ${m_id ? `AND sch.mandal_id = $${(exam_id ? 2 : 1) + (d_id ? 1 : 0)}` : ''}
        ${s_id ? `AND s.school_id = $${(exam_id ? 2 : 1) + (d_id ? 1 : 0) + (m_id ? 1 : 0)}` : ''}
      GROUP BY sub.name
      ORDER BY sub.name
    `;

    const params = [];
    if (exam_id) params.push(exam_id);
    if (d_id) params.push(d_id);
    if (m_id) params.push(m_id);
    if (s_id) params.push(s_id);

    const result = await pool.query(query, params);

    // Calculate percentages
    const formatted = result.rows.map(row => {
      const total = Number(row.total);
      return {
        subject: row.subject,
        grade_a: Number(row.grade_a),
        grade_b: Number(row.grade_b),
        grade_c: Number(row.grade_c),
        grade_d: Number(row.grade_d),
        total: total,
        grade_a_pct: total ? Number(((Number(row.grade_a) / total) * 100).toFixed(2)) : 0,
        grade_b_pct: total ? Number(((Number(row.grade_b) / total) * 100).toFixed(2)) : 0,
        grade_c_pct: total ? Number(((Number(row.grade_c) / total) * 100).toFixed(2)) : 0,
        grade_d_pct: total ? Number(((Number(row.grade_d) / total) * 100).toFixed(2)) : 0,
      };
    });

    res.json(formatted);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch performance distribution" });
  }
});


// 4. SUBJECT-WISE BREAKDOWN (New)
app.get('/api/analytics/subject-breakdown', authenticateToken, async (req, res) => {
  const { level, exam_id, district_id, mandal_id, school_id } = req.query;
  const { role, district_id: user_d, mandal_id: user_m, school_id: user_s } = req.user;

  // Scope Resolution
  const d_id = (role !== 'admin' && user_d) ? user_d : district_id;
  const m_id = (role !== 'admin' && user_m) ? user_m : mandal_id;
  const s_id = (role !== 'admin' && user_s) ? user_s : school_id;

  try {
    const params = [];
    let whereClause = 'WHERE 1=1';

    if (exam_id) { whereClause += ` AND m.exam_id = $${params.length + 1}`; params.push(exam_id); }
    if (d_id) { whereClause += ` AND sch.district_id = $${params.length + 1}`; params.push(d_id); }
    if (m_id) { whereClause += ` AND sch.mandal_id = $${params.length + 1}`; params.push(m_id); }
    if (s_id) { whereClause += ` AND s.school_id = $${params.length + 1}`; params.push(s_id); }

    let groupByCol = '';
    let groupByLabel = '';

    // Determine grouping based on level
    // If viewing Root -> Group by District
    // If viewing District -> Group by Mandal
    // If viewing Mandal -> Group by School
    if (level === 'root' || !level) {
      groupByCol = 'd.name';
      groupByLabel = 'd.name';
    } else if (level === 'district') {
      groupByCol = 'mdl.name';
      groupByLabel = 'mdl.name';
    } else if (level === 'mandal') {
      groupByCol = 'sch.name';
      groupByLabel = 'sch.name';
    } else {
      // School level or invalid - return empty
      return res.json({});
    }

    const query = `
            SELECT 
                sub.name as subject,
                ${groupByCol} as entity_name,
                COUNT(CASE WHEN m.grade = 'A' THEN 1 END) as grade_a,
                COUNT(CASE WHEN m.grade = 'B' THEN 1 END) as grade_b,
                COUNT(CASE WHEN m.grade = 'C' THEN 1 END) as grade_c,
                COUNT(CASE WHEN m.grade = 'D' THEN 1 END) as grade_d,
                COUNT(*) as total
            FROM marks m
            JOIN students s ON m.student_id = s.id
            JOIN schools sch ON s.school_id = sch.id
            JOIN mandals mdl ON sch.mandal_id = mdl.id
            JOIN districts d ON sch.district_id = d.id
            JOIN subjects sub ON m.subject_id = sub.id
            ${whereClause}
            GROUP BY sub.name, ${groupByCol}
            ORDER BY sub.name, ${groupByCol}
        `;

    const { rows } = await pool.query(query, params);

    // Transform data into nested structure: { "Subject Name": [ { name: "Entity", ...data }, ... ] }
    const result = {};
    rows.forEach(row => {
      if (!result[row.subject]) {
        result[row.subject] = [];
      }
      const total = parseInt(row.total);
      result[row.subject].push({
        name: row.entity_name,
        grade_a: parseInt(row.grade_a),
        grade_b: parseInt(row.grade_b),
        grade_c: parseInt(row.grade_c),
        grade_d: parseInt(row.grade_d),
        total: total,
        grade_a_pct: total > 0 ? parseFloat(((parseInt(row.grade_a) / total) * 100).toFixed(2)) : 0,
        grade_b_pct: total > 0 ? parseFloat(((parseInt(row.grade_b) / total) * 100).toFixed(2)) : 0,
        grade_c_pct: total > 0 ? parseFloat(((parseInt(row.grade_c) / total) * 100).toFixed(2)) : 0,
        grade_d_pct: total > 0 ? parseFloat(((parseInt(row.grade_d) / total) * 100).toFixed(2)) : 0,
      });
    });

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 5. ENTITY PERFORMANCE (New)
// Aggregates grade distribution by child entity (District/Mandal/School)
app.get('/api/analytics/entity-performance', authenticateToken, async (req, res) => {
  const { level, district_id, mandal_id, school_id } = req.query;
  const { role, district_id: user_d, mandal_id: user_m, school_id: user_s } = req.user;

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    // Role-based scoping
    if (role === 'deo' || (role !== 'admin' && user_d)) {
      whereClause += ` AND d.id = $${paramIdx++}`;
      params.push(user_d || district_id);
    } else if (district_id) {
      whereClause += ` AND d.id = $${paramIdx++}`;
      params.push(district_id);
    }

    if (role === 'meo' || (role !== 'admin' && user_m)) {
      whereClause += ` AND mdl.id = $${paramIdx++}`;
      params.push(user_m || mandal_id);
    } else if (mandal_id) {
      whereClause += ` AND mdl.id = $${paramIdx++}`;
      params.push(mandal_id);
    }

    if (role === 'school_admin' || (role !== 'admin' && user_s)) {
      whereClause += ` AND sch.id = $${paramIdx++}`;
      params.push(user_s || school_id);
    } else if (school_id) {
      whereClause += ` AND sch.id = $${paramIdx++}`;
      params.push(school_id);
    }

    let groupByCol = '';
    let idCol = '';
    if (level === 'root') {
      groupByCol = 'd.name';
      idCol = 'd.id';
    } else if (level === 'district') {
      groupByCol = 'mdl.name';
      idCol = 'mdl.id';
    } else if (level === 'mandal') {
      groupByCol = 'sch.name';
      idCol = 'sch.id';
    } else if (level === 'school') {
      groupByCol = 's.name';
      idCol = 's.id';
    } else {
      return res.json([]);
    }

    const query = `
            SELECT 
                ${idCol} as id,
                ${groupByCol} as name,
                COUNT(CASE WHEN m.grade = 'A' THEN 1 END) as grade_a,
                COUNT(CASE WHEN m.grade = 'B' THEN 1 END) as grade_b,
                COUNT(CASE WHEN m.grade = 'C' THEN 1 END) as grade_c,
                COUNT(CASE WHEN m.grade = 'D' THEN 1 END) as grade_d,
                COUNT(*) as total
            FROM marks m
            JOIN students s ON m.student_id = s.id
            JOIN schools sch ON s.school_id = sch.id
            JOIN mandals mdl ON sch.mandal_id = mdl.id
            JOIN districts d ON sch.district_id = d.id
            ${whereClause}
            GROUP BY ${idCol}, ${groupByCol}
            ORDER BY ${groupByCol}
        `;

    const { rows } = await pool.query(query, params);

    const result = rows.map(row => {
      const total = parseInt(row.total);
      return {
        id: row.id,
        name: row.name,
        grade_a: parseInt(row.grade_a),
        grade_b: parseInt(row.grade_b),
        grade_c: parseInt(row.grade_c),
        grade_d: parseInt(row.grade_d),
        total: total,
        grade_a_pct: total > 0 ? parseFloat(((parseInt(row.grade_a) / total) * 100).toFixed(2)) : 0,
        grade_b_pct: total > 0 ? parseFloat(((parseInt(row.grade_b) / total) * 100).toFixed(2)) : 0,
        grade_c_pct: total > 0 ? parseFloat(((parseInt(row.grade_c) / total) * 100).toFixed(2)) : 0,
        grade_d_pct: total > 0 ? parseFloat(((parseInt(row.grade_d) / total) * 100).toFixed(2)) : 0,
      };
    });

    res.json(result);

  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 6. STUDENT MARKS (New)
app.get('/api/analytics/student-marks', authenticateToken, async (req, res) => {
  const { school_id } = req.query;
  const { role, school_id: user_s } = req.user;

  const s_id = (role !== 'admin' && user_s) ? user_s : school_id;

  if (!s_id) return res.status(400).json({ error: "School ID is required" });

  try {
    const query = `
      SELECT 
        s.name as student_name,
        sub.name as subject,
        m.marks_obtained,
        m.max_marks,
        m.grade
      FROM marks m
      JOIN students s ON m.student_id = s.id
      JOIN subjects sub ON m.subject_id = sub.id
      WHERE s.school_id = $1
      ORDER BY s.name, sub.name
    `;

    const { rows } = await pool.query(query, [s_id]);
    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 7. EXAMS LIST (New)
app.get('/api/exams', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, end_date FROM exams ORDER BY end_date DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 5. DRILL DOWN LIST (Existing) (Hierarchical Data)
app.get('/api/analytics/drill-down', authenticateToken, async (req, res) => {
  const { level, parent_id, exam_id } = req.query;
  // level: 'district' | 'mandal' | 'school'
  // parent_id: id of the parent entity (e.g., district_id when level is 'mandal')

  const { role, district_id: user_d, mandal_id: user_m, school_id: user_s } = req.user;

  try {
    // CTE to aggregate Student Stats first (Pass = All subjects >= 35%)
    // We handle exam_id filtering inside the CTE
    let paramIndex = 1;
    const queryParams = [];
    if (exam_id) queryParams.push(exam_id);

    const studentAggCTE = `
        WITH StudentAgg AS (
            SELECT 
                s.id as student_id,
                m.exam_id,
                s.school_id,
                sch.mandal_id,
                sch.district_id,
                BOOL_AND((m.marks_obtained::decimal / m.max_marks) * 100 >= 35) as is_passed,
                AVG((m.marks_obtained::decimal / m.max_marks) * 100) as avg_score,
                COUNT(CASE WHEN (m.marks_obtained::decimal / m.max_marks) * 100 >= 80 THEN 1 END) as a_grade_subjects
            FROM students s
            JOIN marks m ON s.id = m.student_id
            JOIN schools sch ON s.school_id = sch.id
            WHERE 1=1 ${exam_id ? `AND m.exam_id = $1` : ''}
            GROUP BY s.id, m.exam_id, s.school_id, sch.mandal_id, sch.district_id
        )
    `;

    // Construct Main Query
    let mainQuery = '';
    let groupBy = '';
    let selectName = '';
    let joinCondition = '';
    let whereClause = 'WHERE 1=1';

    // Adjust param index for subsequent params (if exam_id was used)
    let currentParamIdx = queryParams.length + 1;

    if (level === 'root') {
      selectName = 'd.name';
      groupBy = 'd.id, d.name';
      joinCondition = 'sa.district_id = d.id';

      mainQuery = `
            SELECT 
                d.id,
                d.name,
                COALESCE(ROUND(AVG(sa.avg_score), 2), 0) as avg_score,
                COALESCE(ROUND((COUNT(CASE WHEN sa.is_passed THEN 1 END)::decimal / NULLIF(COUNT(sa.student_id), 0)) * 100, 2), 0) as pass_percentage,
                COALESCE(SUM(sa.a_grade_subjects), 0) as grade_a_count
            FROM districts d
            LEFT JOIN StudentAgg sa ON d.id = sa.district_id
        `;

      if (role !== 'admin' && user_d) {
        whereClause += ` AND d.id = $${currentParamIdx}`;
        queryParams.push(user_d);
        currentParamIdx++;
      }

    } else if (level === 'district') {
      selectName = 'mdl.name';
      groupBy = 'mdl.id, mdl.name';

      mainQuery = `
            SELECT 
                mdl.id,
                mdl.name,
                COALESCE(ROUND(AVG(sa.avg_score), 2), 0) as avg_score,
                COALESCE(ROUND((COUNT(CASE WHEN sa.is_passed THEN 1 END)::decimal / NULLIF(COUNT(sa.student_id), 0)) * 100, 2), 0) as pass_percentage,
                COALESCE(SUM(sa.a_grade_subjects), 0) as grade_a_count
            FROM mandals mdl
            LEFT JOIN StudentAgg sa ON mdl.id = sa.mandal_id
        `;

      // Filter by parent District
      whereClause += ` AND mdl.district_id = $${currentParamIdx}`;
      queryParams.push(parent_id);
      currentParamIdx++;

    } else if (level === 'mandal') {
      selectName = 'sch.name';
      groupBy = 'sch.id, sch.name';

      mainQuery = `
            SELECT 
                sch.id,
                sch.name,
                COALESCE(ROUND(AVG(sa.avg_score), 2), 0) as avg_score,
                COALESCE(ROUND((COUNT(CASE WHEN sa.is_passed THEN 1 END)::decimal / NULLIF(COUNT(sa.student_id), 0)) * 100, 2), 0) as pass_percentage,
                COALESCE(SUM(sa.a_grade_subjects), 0) as grade_a_count
            FROM schools sch
            LEFT JOIN StudentAgg sa ON sch.id = sa.school_id
        `;

      // Filter by parent Mandal
      whereClause += ` AND sch.mandal_id = $${currentParamIdx}`;
      queryParams.push(parent_id);
      currentParamIdx++;
    } else if (level === 'school') {
      return res.json([]);
    }

    const finalQuery = `
        ${studentAggCTE}
        ${mainQuery}
        ${whereClause}
        GROUP BY ${groupBy}
        ORDER BY pass_percentage ASC
    `;

    const result = await pool.query(finalQuery, queryParams);
    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch drill-down data" });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;