// API Base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Store token
let authToken = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');

// Check authentication status
function checkAuth() {
    if (!authToken) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Redirect based on role
function redirectBasedOnRole(role) {
    switch(role) {
        case 'admin':
            window.location.href = 'admin.html';
            break;
        case 'student':
            window.location.href = 'student-dashboard.html';
            break;
        case 'staff':
            window.location.href = 'staff-dashboard.html';
            break;
        default:
            window.location.href = 'login.html';
    }
}

// Login function
async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // Store token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        authToken = data.token;
        currentUser = data.user;

        // Show success message
        showNotification('Login successful!', 'success');

        // Redirect based on role
        setTimeout(() => {
            redirectBasedOnRole(data.user.role);
        }, 1000);

    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    authToken = null;
    currentUser = {};
    window.location.href = 'login.html';
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.className = `notification notification-${type}`;
        notification.style.display = 'block';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    } else {
        alert(message);
    }
}

// Format date
function formatDate(dateString) {
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Get status badge class
function getStatusBadgeClass(status) {
    switch(status) {
        case 'approved':
            return 'badge-approved';
        case 'rejected':
            return 'badge-rejected';
        case 'pending':
            return 'badge-pending';
        case 'in_progress':
            return 'badge-in-progress';
        default:
            return 'badge-pending';
    }
}

// Capitalize first letter
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Load user profile in sidebar
async function loadUserProfile() {
    if (!checkAuth()) return;

    try {
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const profile = await response.json();

        // Update profile info in sidebar
        document.querySelectorAll('.user-name').forEach(el => {
            el.textContent = profile.full_name;
        });
        
        document.querySelectorAll('.user-role').forEach(el => {
            el.textContent = capitalize(profile.role);
        });

        // Update user avatar
        document.querySelectorAll('.user-avatar').forEach(el => {
            const initials = profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
            el.textContent = initials;
        });

    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Load dashboard stats
async function loadDashboardStats() {
    if (!checkAuth()) return;

    try {
        const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const stats = await response.json();
        updateStatsCards(stats);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Update stats cards
function updateStatsCards(stats) {
    for (const [key, value] of Object.entries(stats)) {
        const element = document.getElementById(`stat-${key}`);
        if (element) {
            element.textContent = value;
        }
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // Check if on login page
    if (window.location.pathname.includes('login.html')) {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                login(username, password);
            });
        }
        return;
    }

    // Check authentication for protected pages
    if (!checkAuth()) return;

    // Load user profile
    loadUserProfile();

    // Load stats if on dashboard
    if (document.getElementById('stats-container')) {
        loadDashboardStats();
    }

    // Setup logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // Setup mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
});

// Export for use in other files
window.API_BASE_URL = API_BASE_URL;
window.authToken = authToken;
window.currentUser = currentUser;
window.showNotification = showNotification;
window.formatDate = formatDate;
window.getStatusBadgeClass = getStatusBadgeClass;
window.capitalize = capitalize;