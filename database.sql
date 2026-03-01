-- Create Database
CREATE DATABASE clearance_system;

-- Users Table (for all users with role discrimination)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('admin', 'student', 'staff')) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    profile_picture VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students Table (additional student-specific info)
CREATE TABLE students (
    id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    student_id VARCHAR(20) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    level VARCHAR(50),
    graduation_year INTEGER,
    phone_number VARCHAR(20),
    address TEXT
);

-- Staff Table (additional staff-specific info)
CREATE TABLE staff (
    id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    staff_id VARCHAR(20) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    phone_number VARCHAR(20)
);

-- Admin Table (additional admin-specific info)
CREATE TABLE admins (
    id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    admin_id VARCHAR(20) UNIQUE NOT NULL,
    department VARCHAR(100),
    position VARCHAR(100)
);

-- Clearance Departments
CREATE TABLE clearance_departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    head_staff_id INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    sequence_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clearance Requests
CREATE TABLE clearance_requests (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(50) CHECK (request_type IN ('graduation', 'withdrawal', 'transfer')) NOT NULL,
    status VARCHAR(50) CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')) DEFAULT 'pending',
    submitted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completion_date TIMESTAMP,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clearance Request Details (tracking each department's status)
CREATE TABLE clearance_request_details (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES clearance_requests(id) ON DELETE CASCADE,
    department_id INTEGER REFERENCES clearance_departments(id),
    staff_id INTEGER REFERENCES users(id),
    status VARCHAR(50) CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    remarks TEXT,
    action_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_clearance_requests_student ON clearance_requests(student_id);
CREATE INDEX idx_clearance_requests_status ON clearance_requests(status);
CREATE INDEX idx_request_details_request ON clearance_request_details(request_id);
CREATE INDEX idx_request_details_department ON clearance_request_details(department_id);

-- Insert default admin user (password: Admin@123)
INSERT INTO users (username, email, password_hash, role, full_name) 
VALUES ('admin', 'admin@university.edu', '$2a$10$YourHashedPasswordHere', 'admin', 'System Administrator');

-- Insert sample departments
INSERT INTO clearance_departments (name, description, sequence_order) VALUES
('Library', 'Check for outstanding books and fines', 1),
('Finance', 'Verify tuition and fee payments', 2),
('Department', 'Department clearance and equipment return', 3),
('Hostel', 'Hostel accommodation clearance', 4),
('Sports', 'Sports equipment return', 5),
('IT Services', 'IT resources and account clearance', 6),
('Alumni', 'Alumni registration', 7);