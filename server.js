const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const { body, validationResult } = require('express-validator');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test database connection
pool.connect((err, client, done) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to PostgreSQL database');
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

// ============= AUTHENTICATION ROUTES =============

// Login
app.post('/api/auth/login', [
  body('username').notEmpty(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, password } = req.body;
    
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND is_active = true',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log the login action
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [user.id, 'LOGIN', 'User logged in', req.ip]
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============= REGISTRATION ROUTE =============
app.post('/api/auth/register', [
  body('username').notEmpty().withMessage('Username is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['student', 'staff']).withMessage('Role must be student or staff'),
  body('full_name').notEmpty().withMessage('Full name is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { username, email, password, role, full_name, phone_number } = req.body;
    
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert into users table
    const userResult = await client.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, is_active) 
       VALUES ($1, $2, $3, $4, $5, true) 
       RETURNING id, username, email, role, full_name`,
      [username, email, password_hash, role, full_name]
    );

    const userId = userResult.rows[0].id;

    // Insert into role-specific table
    if (role === 'student') {
      const { student_id, department, level } = req.body;
      
      if (!student_id || !department) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Student ID and department are required' });
      }

      // Check if student ID already exists
      const existingStudent = await client.query(
        'SELECT * FROM students WHERE student_id = $1',
        [student_id]
      );

      if (existingStudent.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Student ID already exists' });
      }

      await client.query(
        `INSERT INTO students (id, student_id, department, level, phone_number) 
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, student_id, department, level || null, phone_number || null]
      );
      
    } else if (role === 'staff') {
      const { staff_id, department, position } = req.body;
      
      if (!staff_id || !department) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Staff ID and department are required' });
      }

      // Check if staff ID already exists
      const existingStaff = await client.query(
        'SELECT * FROM staff WHERE staff_id = $1',
        [staff_id]
      );

      if (existingStaff.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Staff ID already exists' });
      }

      await client.query(
        `INSERT INTO staff (id, staff_id, department, position, phone_number) 
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, staff_id, department, position || null, phone_number || null]
      );
    }

    // Log the registration
    await client.query(
      `INSERT INTO audit_logs (user_id, action, details) 
       VALUES ($1, $2, $3)`,
      [userId, 'REGISTER', `New ${role} registered: ${username}`]
    );

    await client.query('COMMIT');

    res.status(201).json({ 
      message: 'Registration successful',
      user: {
        id: userId,
        username,
        email,
        role,
        full_name
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  } finally {
    client.release();
  }
});

// ============= USER ROUTES =============

// Get all users (admin only)
app.get('/api/users', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.email, u.role, u.full_name, u.is_active, u.created_at,
             COALESCE(s.student_id, st.staff_id, a.admin_id) as identifier
      FROM users u
      LEFT JOIN students s ON u.id = s.id
      LEFT JOIN staff st ON u.id = st.id
      LEFT JOIN admins a ON u.id = a.id
      ORDER BY u.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user profile
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT u.id, u.username, u.email, u.role, u.full_name, u.profile_picture,
             u.created_at
    `;
    
    if (req.user.role === 'student') {
      query += `, s.student_id, s.department, s.level, s.graduation_year, s.phone_number, s.address
                FROM users u
                LEFT JOIN students s ON u.id = s.id
                WHERE u.id = $1`;
    } else if (req.user.role === 'staff') {
      query += `, st.staff_id, st.department, st.position, st.phone_number
                FROM users u
                LEFT JOIN staff st ON u.id = st.id
                WHERE u.id = $1`;
    } else if (req.user.role === 'admin') {
      query += `, a.admin_id, a.department, a.position
                FROM users u
                LEFT JOIN admins a ON u.id = a.id
                WHERE u.id = $1`;
    }

    const result = await pool.query(query, [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, phone_number, address, department, level } = req.body;
    
    // Update users table
    await pool.query(
      'UPDATE users SET full_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [full_name, req.user.id]
    );

    // Update role-specific table
    if (req.user.role === 'student') {
      await pool.query(
        `UPDATE students 
         SET phone_number = COALESCE($1, phone_number),
             address = COALESCE($2, address),
             department = COALESCE($3, department),
             level = COALESCE($4, level)
         WHERE id = $5`,
        [phone_number, address, department, level, req.user.id]
      );
    } else if (req.user.role === 'staff') {
      await pool.query(
        `UPDATE staff 
         SET phone_number = COALESCE($1, phone_number),
             department = COALESCE($2, department)
         WHERE id = $3`,
        [phone_number, department, req.user.id]
      );
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new user (admin only)
app.post('/api/users', authenticateToken, authorize('admin'), [
  body('username').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['admin', 'student', 'staff']),
  body('full_name').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { username, email, password, role, full_name } = req.body;
    
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, role, full_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role, full_name',
      [username, email, password_hash, role, full_name]
    );

    // Create role-specific record
    const userId = result.rows[0].id;
    
    if (role === 'student') {
      await pool.query(
        'INSERT INTO students (id, student_id, department) VALUES ($1, $2, $3)',
        [userId, `STU${userId}`, 'Not Assigned']
      );
    } else if (role === 'staff') {
      await pool.query(
        'INSERT INTO staff (id, staff_id, department) VALUES ($1, $2, $3)',
        [userId, `STF${userId}`, 'Not Assigned']
      );
    } else if (role === 'admin') {
      await pool.query(
        'INSERT INTO admins (id, admin_id, department) VALUES ($1, $2, $3)',
        [userId, `ADM${userId}`, 'Administration']
      );
    }

    // Log action
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CREATE_USER', `Created user: ${username}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============= CLEARANCE DEPARTMENT ROUTES =============

// Get all clearance departments
app.get('/api/departments', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, u.full_name as head_name
      FROM clearance_departments d
      LEFT JOIN users u ON d.head_staff_id = u.id
      WHERE d.is_active = true
      ORDER BY d.sequence_order
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create department (admin only)
app.post('/api/departments', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { name, description, sequence_order } = req.body;
    
    const result = await pool.query(
      'INSERT INTO clearance_departments (name, description, sequence_order) VALUES ($1, $2, $3) RETURNING *',
      [name, description, sequence_order]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update department (admin only)
app.put('/api/departments/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sequence_order, head_staff_id } = req.body;
    
    const result = await pool.query(
      `UPDATE clearance_departments 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           sequence_order = COALESCE($3, sequence_order),
           head_staff_id = COALESCE($4, head_staff_id)
       WHERE id = $5
       RETURNING *`,
      [name, description, sequence_order, head_staff_id, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete department (admin only)
app.delete('/api/departments/:id', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      'UPDATE clearance_departments SET is_active = false WHERE id = $1',
      [id]
    );

    res.json({ message: 'Department deactivated successfully' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============= CLEARANCE REQUEST ROUTES =============

// Create clearance request (student only)
app.post('/api/clearance-requests', authenticateToken, authorize('student'), [
  body('request_type').isIn(['graduation', 'withdrawal', 'transfer'])
], async (req, res) => {
  try {
    const { request_type, remarks } = req.body;
    
    // Check if student already has pending request
    const existingRequest = await pool.query(
      'SELECT * FROM clearance_requests WHERE student_id = $1 AND status IN ($2, $3)',
      [req.user.id, 'pending', 'in_progress']
    );

    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ error: 'You already have a pending clearance request' });
    }

    // Create clearance request
    const requestResult = await pool.query(
      'INSERT INTO clearance_requests (student_id, request_type, remarks) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, request_type, remarks]
    );

    const requestId = requestResult.rows[0].id;

    // Get all active departments
    const departments = await pool.query(
      'SELECT id FROM clearance_departments WHERE is_active = true ORDER BY sequence_order'
    );

    // Create request details for each department
    for (const dept of departments.rows) {
      await pool.query(
        'INSERT INTO clearance_request_details (request_id, department_id, status) VALUES ($1, $2, $3)',
        [requestId, dept.id, 'pending']
      );
    }

    // Log action
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CREATE_REQUEST', `Created clearance request: ${requestId}`]
    );

    res.status(201).json(requestResult.rows[0]);
  } catch (error) {
    console.error('Create clearance request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get student's clearance requests
app.get('/api/student/clearance-requests', authenticateToken, authorize('student'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cr.*, 
             json_agg(
               json_build_object(
                 'department_id', crd.department_id,
                 'department_name', cd.name,
                 'status', crd.status,
                 'remarks', crd.remarks,
                 'action_date', crd.action_date
               )
             ) as department_status
      FROM clearance_requests cr
      LEFT JOIN clearance_request_details crd ON cr.id = crd.request_id
      LEFT JOIN clearance_departments cd ON crd.department_id = cd.id
      WHERE cr.student_id = $1
      GROUP BY cr.id
      ORDER BY cr.created_at DESC
    `, [req.user.id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get student requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get pending clearance requests for staff (staff only)
app.get('/api/staff/pending-requests', authenticateToken, authorize('staff'), async (req, res) => {
  try {
    // Get staff's department
    const staff = await pool.query(
      'SELECT department FROM staff WHERE id = $1',
      [req.user.id]
    );

    const result = await pool.query(`
      SELECT cr.id, cr.request_type, cr.status, cr.submitted_date,
             u.full_name as student_name, s.student_id, s.department as student_department,
             crd.id as detail_id, crd.status as department_status, crd.remarks
      FROM clearance_requests cr
      JOIN users u ON cr.student_id = u.id
      JOIN students s ON cr.student_id = s.id
      JOIN clearance_request_details crd ON cr.id = crd.request_id
      JOIN clearance_departments cd ON crd.department_id = cd.id
      WHERE cd.name = $1 AND crd.status = 'pending'
      ORDER BY cr.submitted_date ASC
    `, [staff.rows[0].department]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update clearance request detail (staff only)
app.put('/api/clearance-request-detail/:id', authenticateToken, authorize('staff'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    // Update the request detail
    const result = await pool.query(
      `UPDATE clearance_request_details 
       SET status = $1, 
           remarks = $2, 
           staff_id = $3,
           action_date = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [status, remarks, req.user.id, id]
    );

    // Get the request_id to check overall status
    const detail = result.rows[0];
    
    // Check if all departments are approved
    const allDetails = await pool.query(
      'SELECT status FROM clearance_request_details WHERE request_id = $1',
      [detail.request_id]
    );

    const allApproved = allDetails.rows.every(d => d.status === 'approved');
    
    if (allApproved) {
      // Update main request status to completed
      await pool.query(
        `UPDATE clearance_requests 
         SET status = 'completed', 
             completion_date = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [detail.request_id]
      );
    } else {
      // Update main request status to in_progress if not already
      await pool.query(
        `UPDATE clearance_requests 
         SET status = 'in_progress' 
         WHERE id = $1 AND status = 'pending'`,
        [detail.request_id]
      );
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update request detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all clearance requests (admin only)
app.get('/api/admin/clearance-requests', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT cr.*, u.full_name as student_name, s.student_id,
             (SELECT COUNT(*) FROM clearance_request_details WHERE request_id = cr.id AND status = 'approved') as approved_count,
             (SELECT COUNT(*) FROM clearance_request_details WHERE request_id = cr.id) as total_count
      FROM clearance_requests cr
      JOIN users u ON cr.student_id = u.id
      JOIN students s ON cr.student_id = s.id
      ORDER BY cr.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get all requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get dashboard statistics
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    let stats = {};

    if (req.user.role === 'admin') {
      // Admin stats
      const totalStudents = await pool.query('SELECT COUNT(*) FROM students');
      const totalStaff = await pool.query('SELECT COUNT(*) FROM staff');
      const pendingRequests = await pool.query("SELECT COUNT(*) FROM clearance_requests WHERE status = 'pending'");
      const completedRequests = await pool.query("SELECT COUNT(*) FROM clearance_requests WHERE status = 'completed'");
      
      stats = {
        totalStudents: totalStudents.rows[0].count,
        totalStaff: totalStaff.rows[0].count,
        pendingRequests: pendingRequests.rows[0].count,
        completedRequests: completedRequests.rows[0].count
      };
    } else if (req.user.role === 'student') {
      // Student stats
      const myRequests = await pool.query('SELECT COUNT(*) FROM clearance_requests WHERE student_id = $1', [req.user.id]);
      const completedRequests = await pool.query("SELECT COUNT(*) FROM clearance_requests WHERE student_id = $1 AND status = 'completed'", [req.user.id]);
      
      stats = {
        totalRequests: parseInt(myRequests.rows[0].count),
        completedRequests: parseInt(completedRequests.rows[0].count),
        pendingRequests: parseInt(myRequests.rows[0].count) - parseInt(completedRequests.rows[0].count)
      };
    } else if (req.user.role === 'staff') {
      // Staff stats
      const staffDept = await pool.query('SELECT department FROM staff WHERE id = $1', [req.user.id]);
      const pendingInDept = await pool.query(`
        SELECT COUNT(*) 
        FROM clearance_request_details crd
        JOIN clearance_departments cd ON crd.department_id = cd.id
        WHERE cd.name = $1 AND crd.status = 'pending'
      `, [staffDept.rows[0].department]);
      
      const approvedToday = await pool.query(`
        SELECT COUNT(*)
        FROM clearance_request_details crd
        WHERE crd.staff_id = $1 
        AND DATE(crd.action_date) = CURRENT_DATE
        AND crd.status = 'approved'
      `, [req.user.id]);
      
      const totalProcessed = await pool.query(`
        SELECT COUNT(*)
        FROM clearance_request_details crd
        WHERE crd.staff_id = $1
      `, [req.user.id]);
      
      stats = {
        pendingRequests: parseInt(pendingInDept.rows[0].count),
        approvedToday: parseInt(approvedToday.rows[0].count),
        totalProcessed: parseInt(totalProcessed.rows[0].count)
      };
    }

    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});