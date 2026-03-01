// Staff specific functions

// Load pending requests
async function loadPendingRequests() {
    try {
        const response = await fetch(`${API_BASE_URL}/staff/pending-requests`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const requests = await response.json();
        displayRecentPendingRequests(requests.slice(0, 5));
        displayAllPendingRequests(requests);
    } catch (error) {
        console.error('Error loading pending requests:', error);
        showNotification('Error loading pending requests', 'error');
    }
}

// Display recent pending requests in dashboard
function displayRecentPendingRequests(requests) {
    const tbody = document.getElementById('recentPendingRequests');
    if (!tbody) return;

    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No pending requests</td></tr>';
        return;
    }

    tbody.innerHTML = requests.map(request => `
        <tr>
            <td>${request.student_id}</td>
            <td>${request.student_name}</td>
            <td><span class="badge badge-${request.request_type}">${capitalize(request.request_type)}</span></td>
            <td>${formatDate(request.submitted_date)}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openApprovalModal(${request.detail_id}, '${request.student_name}', '${request.request_type}')">
                    <i class="fas fa-check-circle"></i> Process
                </button>
            </td>
        </tr>
    `).join('');
}

// Display all pending requests
function displayAllPendingRequests(requests) {
    const tbody = document.getElementById('pendingRequestsTable');
    if (!tbody) return;

    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No pending requests</td></tr>';
        return;
    }

    tbody.innerHTML = requests.map(request => `
        <tr>
            <td>${request.student_id}</td>
            <td>${request.student_name}</td>
            <td>${request.student_department}</td>
            <td><span class="badge badge-${request.request_type}">${capitalize(request.request_type)}</span></td>
            <td>${formatDate(request.submitted_date)}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="openApprovalModal(${request.detail_id}, '${request.student_name}', '${request.request_type}')">
                    <i class="fas fa-check-circle"></i> Process
                </button>
            </td>
        </tr>
    `).join('');
}

// Open approval modal
function openApprovalModal(detailId, studentName, requestType) {
    document.getElementById('detailId').value = detailId;
    
    const requestInfo = document.getElementById('requestInfo');
    requestInfo.innerHTML = `
        <p><strong>Student:</strong> ${studentName}</p>
        <p><strong>Request Type:</strong> ${capitalize(requestType)}</p>
    `;
    
    document.getElementById('approvalModal').style.display = 'block';
}

// Submit approval decision
async function submitApproval() {
    const detailId = document.getElementById('detailId').value;
    const decision = document.getElementById('decision').value;
    const remarks = document.getElementById('approvalRemarks').value;

    if (!decision) {
        showNotification('Please select a decision', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/clearance-request-detail/${detailId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status: decision, remarks })
        });

        if (!response.ok) {
            throw new Error('Failed to process request');
        }

        showNotification(`Request ${decision} successfully`, 'success');
        
        // Close modal and reload data
        closeModal('approvalModal');
        loadPendingRequests();
        loadDashboardStats();
        
        // Reset form
        document.getElementById('approvalForm').reset();

    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Load staff profile
async function loadStaffProfile() {
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
        document.getElementById('profilePhone').value = profile.phone_number || '';
        document.getElementById('profileDepartment').value = profile.department || '';
        document.getElementById('profilePosition').value = profile.position || '';
        
        document.querySelector('.staff-name').textContent = profile.full_name || '';
        document.querySelector('.staff-id').textContent = `ID: ${profile.staff_id || ''}`;
        document.querySelector('.staff-department').textContent = `Department: ${profile.department || ''}`;

    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

// Update staff profile
async function updateStaffProfile(event) {
    event.preventDefault();

    const formData = {
        full_name: document.getElementById('profileFullName').value,
        phone_number: document.getElementById('profilePhone').value,
        position: document.getElementById('profilePosition').value
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

    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Initialize staff dashboard
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth() || currentUser.role !== 'staff') {
        window.location.href = 'login.html';
        return;
    }

    // Load staff data
    loadPendingRequests();
    loadStaffProfile();

    // Setup form submission
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', updateStaffProfile);
    }
});

// Modal functions
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}