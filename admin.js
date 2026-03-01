// Admin specific functions

// Load all users
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const users = await response.json();
        displayUsers(users);
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Error loading users', 'error');
    }
}

// Display users in table
function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.identifier || 'N/A'}</td>
            <td>${user.full_name}</td>
            <td>${user.email}</td>
            <td><span class="badge badge-${user.role}">${capitalize(user.role)}</span></td>
            <td>
                <span class="badge ${user.is_active ? 'badge-approved' : 'badge-rejected'}">
                    ${user.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>${formatDate(user.created_at)}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editUser(${user.id})">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="toggleUserStatus(${user.id}, ${!user.is_active})">
                    <i class="fas ${user.is_active ? 'fa-ban' : 'fa-check'}"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Load all clearance requests
async function loadClearanceRequests() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin/clearance-requests`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const requests = await response.json();
        displayClearanceRequests(requests);
    } catch (error) {
        console.error('Error loading requests:', error);
        showNotification('Error loading clearance requests', 'error');
    }
}

// Display clearance requests
function displayClearanceRequests(requests) {
    const tbody = document.getElementById('requestsTableBody');
    if (!tbody) return;

    tbody.innerHTML = requests.map(request => {
        const progress = (request.approved_count / request.total_count) * 100;
        
        return `
        <tr>
            <td>${request.student_id}</td>
            <td>${request.student_name}</td>
            <td><span class="badge badge-${request.request_type}">${capitalize(request.request_type)}</span></td>
            <td>
                <span class="badge ${getStatusBadgeClass(request.status)}">
                    ${capitalize(request.status)}
                </span>
            </td>
            <td>
                <div class="progress-container">
                    <div class="progress">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <small>${request.approved_count}/${request.total_count} approved</small>
                </div>
            </td>
            <td>${formatDate(request.submitted_date)}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewRequestDetails(${request.id})">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `}).join('');
}

// Load departments
async function loadDepartments() {
    try {
        const response = await fetch(`${API_BASE_URL}/departments`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const departments = await response.json();
        displayDepartments(departments);
    } catch (error) {
        console.error('Error loading departments:', error);
        showNotification('Error loading departments', 'error');
    }
}

// Display departments
function displayDepartments(departments) {
    const container = document.getElementById('departmentsContainer');
    if (!container) return;

    container.innerHTML = departments.map(dept => `
        <div class="col-md-4">
            <div class="card">
                <div class="card-header">
                    <h3>${dept.name}</h3>
                </div>
                <div class="card-body">
                    <p>${dept.description || 'No description'}</p>
                    <p><strong>Head:</strong> ${dept.head_name || 'Not Assigned'}</p>
                    <p><strong>Order:</strong> ${dept.sequence_order}</p>
                </div>
                <div class="card-footer">
                    <button class="btn btn-sm btn-primary" onclick="editDepartment(${dept.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDepartment(${dept.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Create new user
async function createUser(event) {
    event.preventDefault();

    const formData = {
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        role: document.getElementById('role').value,
        full_name: document.getElementById('fullName').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create user');
        }

        showNotification('User created successfully', 'success');
        closeModal('createUserModal');
        loadUsers(); // Refresh users list
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Create department
async function createDepartment(event) {
    event.preventDefault();

    const formData = {
        name: document.getElementById('deptName').value,
        description: document.getElementById('deptDescription').value,
        sequence_order: parseInt(document.getElementById('sequenceOrder').value)
    };

    try {
        const response = await fetch(`${API_BASE_URL}/departments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create department');
        }

        showNotification('Department created successfully', 'success');
        closeModal('createDeptModal');
        loadDepartments(); // Refresh departments
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// View request details
async function viewRequestDetails(requestId) {
    try {
        // Fetch detailed request information
        const response = await fetch(`${API_BASE_URL}/clearance-requests/${requestId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const request = await response.json();
        
        // Display in modal
        const modal = document.getElementById('requestDetailsModal');
        const content = document.getElementById('requestDetailsContent');
        
        content.innerHTML = `
            <h4>Request Information</h4>
            <p><strong>Student:</strong> ${request.student_name}</p>
            <p><strong>Type:</strong> ${capitalize(request.request_type)}</p>
            <p><strong>Status:</strong> ${capitalize(request.status)}</p>
            <p><strong>Submitted:</strong> ${formatDate(request.submitted_date)}</p>
            
            <h4 class="mt-4">Department Status</h4>
            <table class="table">
                <thead>
                    <tr>
                        <th>Department</th>
                        <th>Status</th>
                        <th>Remarks</th>
                        <th>Action Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${request.department_status.map(dept => `
                        <tr>
                            <td>${dept.department_name}</td>
                            <td><span class="badge ${getStatusBadgeClass(dept.status)}">${capitalize(dept.status)}</span></td>
                            <td>${dept.remarks || '-'}</td>
                            <td>${dept.action_date ? formatDate(dept.action_date) : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error loading request details:', error);
        showNotification('Error loading request details', 'error');
    }
}

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth() || currentUser.role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    // Load data based on current tab
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('admin.html')) {
        const hash = window.location.hash || '#dashboard';
        
        switch(hash) {
            case '#users':
                loadUsers();
                break;
            case '#requests':
                loadClearanceRequests();
                break;
            case '#departments':
                loadDepartments();
                break;
        }
    }

    // Setup form submissions
    const createUserForm = document.getElementById('createUserForm');
    if (createUserForm) {
        createUserForm.addEventListener('submit', createUser);
    }

    const createDeptForm = document.getElementById('createDeptForm');
    if (createDeptForm) {
        createDeptForm.addEventListener('submit', createDepartment);
    }
});