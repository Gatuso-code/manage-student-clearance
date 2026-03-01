// Student specific functions

// Load student's clearance requests
async function loadStudentRequests() {
    try {
        const response = await fetch(`${API_BASE_URL}/student/clearance-requests`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const requests = await response.json();
        displayRecentRequests(requests.slice(0, 5));
        displayAllRequests(requests);
    } catch (error) {
        console.error('Error loading requests:', error);
        showNotification('Error loading requests', 'error');
    }
}

// Display recent requests in dashboard
function displayRecentRequests(requests) {
    const tbody = document.getElementById('recentRequests');
    if (!tbody) return;

    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No requests found</td></tr>';
        return;
    }

    tbody.innerHTML = requests.map(request => {
        const progress = calculateProgress(request.department_status);
        
        return `
        <tr>
            <td>#${request.id}</td>
            <td><span class="badge badge-${request.request_type}">${capitalize(request.request_type)}</span></td>
            <td><span class="badge ${getStatusBadgeClass(request.status)}">${capitalize(request.status)}</span></td>
            <td>
                <div class="progress-container">
                    <div class="progress">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <small>${progress}%</small>
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

// Display all requests
function displayAllRequests(requests) {
    const tbody = document.getElementById('allRequests');
    if (!tbody) return;

    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">No requests found</td></tr>';
        return;
    }

    tbody.innerHTML = requests.map(request => {
        const progress = calculateProgress(request.department_status);
        
        return `
        <tr>
            <td>#${request.id}</td>
            <td><span class="badge badge-${request.request_type}">${capitalize(request.request_type)}</span></td>
            <td><span class="badge ${getStatusBadgeClass(request.status)}">${capitalize(request.status)}</span></td>
            <td>
                <div class="progress-container">
                    <div class="progress">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                    <small>${progress}%</small>
                </div>
            </td>
            <td>${formatDate(request.submitted_date)}</td>
            <td>${request.completion_date ? formatDate(request.completion_date) : '-'}</td>
            <td>
                <button class="btn btn-sm btn-info" onclick="viewRequestDetails(${request.id})">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        </tr>
    `}).join('');
}

// Calculate progress percentage
function calculateProgress(departmentStatus) {
    if (!departmentStatus || !Array.isArray(departmentStatus)) return 0;
    
    const total = departmentStatus.length;
    const approved = departmentStatus.filter(d => d.status === 'approved').length;
    
    return total > 0 ? Math.round((approved / total) * 100) : 0;
}

// View request details
async function viewRequestDetails(requestId) {
    try {
        const response = await fetch(`${API_BASE_URL}/student/clearance-requests`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const requests = await response.json();
        const request = requests.find(r => r.id === requestId);

        const modal = document.getElementById('requestDetailsModal');
        const content = document.getElementById('requestDetailsContent');
        
        content.innerHTML = `
            <h4>Request #${request.id}</h4>
            <p><strong>Type:</strong> ${capitalize(request.request_type)}</p>
            <p><strong>Status:</strong> <span class="badge ${getStatusBadgeClass(request.status)}">${capitalize(request.status)}</span></p>
            <p><strong>Submitted:</strong> ${formatDate(request.submitted_date)}</p>
            <p><strong>Remarks:</strong> ${request.remarks || 'None'}</p>
            
            <h4 class="mt-4">Department Clearance Status</h4>
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

// Submit clearance request
async function submitClearanceRequest(event) {
    event.preventDefault();

    const formData = {
        request_type: document.getElementById('requestType').value,
        remarks: document.getElementById('remarks').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/clearance-requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to submit request');
        }

        showNotification('Clearance request submitted successfully', 'success');
        
        // Reset form and switch to requests tab
        document.getElementById('clearanceRequestForm').reset();
        
        // Switch to my requests tab
        document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
        
        document.querySelector('[href="#my-requests"]').classList.add('active');
        document.getElementById('my-requests').style.display = 'block';
        
        // Reload requests
        loadStudentRequests();
        
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Load student profile
async function loadStudentProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const profile = await response.json();

        // Update profile form
        document.getElementById('profileFullName').value = profile.full_name || '';
        document.getElementById('profileEmail').value = profile.email || '';
        document.getElementById('profileDepartment').value = profile.department || '';
        document.getElementById('profileLevel').value = profile.level || '';
        document.getElementById('profilePhone').value = profile.phone_number || '';
        document.getElementById('profileAddress').value = profile.address || '';
        
        document.querySelector('.user-fullname').textContent = profile.full_name || '';
        document.querySelector('.student-id').textContent = `ID: ${profile.student_id || ''}`;

    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Update student profile
async function updateStudentProfile(event) {
    event.preventDefault();

    const formData = {
        full_name: document.getElementById('profileFullName').value,
        department: document.getElementById('profileDepartment').value,
        level: document.getElementById('profileLevel').value,
        phone_number: document.getElementById('profilePhone').value,
        address: document.getElementById('profileAddress').value
    };

    try {
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error('Failed to update profile');
        }

        showNotification('Profile updated successfully', 'success');
        loadUserProfile(); // Reload sidebar info
        loadStudentProfile(); // Reload profile info

    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Initialize student dashboard
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth() || currentUser.role !== 'student') {
        window.location.href = 'login.html';
        return;
    }

    // Load student data
    loadStudentRequests();
    loadStudentProfile();

    // Setup form submission
    const requestForm = document.getElementById('clearanceRequestForm');
    if (requestForm) {
        requestForm.addEventListener('submit', submitClearanceRequest);
    }

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', updateStudentProfile);
    }
});

// Modal functions
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}