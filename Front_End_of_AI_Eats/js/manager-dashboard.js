const API_URL = "http://127.0.0.1:5000";
const managerId = localStorage.getItem("userId");
const userRole = localStorage.getItem("userRole");
const token = localStorage.getItem("token");

if (userRole !== "Manager") {
  alert("Access Denied: This dashboard is for Managers only.");
  window.location.href = "index.html";
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(tabName).classList.add('active');
  
  // Find and activate the clicked button
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    }
  });

  if (tabName === 'registrations') loadRegistrations();
  if (tabName === 'complaints') loadComplaints();
  if (tabName === 'employees') loadEmployees();
  if (tabName === 'delivery-bids') loadDeliveryBids();
  if (tabName === 'ai-responses') loadFlaggedAI();
}

// UC-04 Step 1: Load dashboard alerts
async function loadDashboard() {
  try {
    const response = await fetch(`${API_URL}/api/manager/dashboard`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const dashboard = data.dashboard;

      document.getElementById('statRegistrations').textContent = dashboard.pending_registrations;
      document.getElementById('statComplaints').textContent = dashboard.pending_complaints;
      document.getElementById('statBids').textContent = dashboard.pending_bids;
      document.getElementById('statFlaggedAI').textContent = dashboard.flagged_ai;

      // Show alert if needed (UC-04 A2)
      if (dashboard.alert.alert) {
        const banner = document.getElementById('alertBanner');
        banner.textContent = dashboard.alert.message;
        banner.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

// UC-04 Step 2: Load pending registrations
async function loadRegistrations() {
  try {
    const response = await fetch(`${API_URL}/api/manager/registrations/pending`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const container = document.getElementById('registrationsList');

      if (data.registrations && data.registrations.length > 0) {
        container.innerHTML = data.registrations.map(reg => `
          <div class="item">
            <div class="item-header">${reg.name}</div>
            <div class="item-meta">
              Role: ${reg.role} | Email: ${reg.email} | Phone: ${reg.phone}<br>
              Address: ${reg.address} | Applied: ${new Date(reg.created_at).toLocaleDateString()}
            </div>
            <div class="item-actions">
              <button class="btn-small btn-approve" onclick="approveRegistration('${reg.user_id}')">Approve</button>
              <button class="btn-small btn-reject" onclick="rejectRegistration('${reg.user_id}')">Reject (A1)</button>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p>No pending registrations</p>';
      }
    }
  } catch (error) {
    console.error('Error loading registrations:', error);
    showMessage('Error loading registrations', false);
  }
}

// UC-04 Step 3: Approve registration
async function approveRegistration(userId) {
  if (!confirm('Approve this registration?')) return;

  try {
    const response = await fetch(`${API_URL}/api/manager/registrations/${userId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ decision: "APPROVE" })
    });

    const data = await response.json();
    showMessage(data.message, response.ok);
    if (response.ok) loadRegistrations();
  } catch (error) {
    console.error('Error approving registration:', error);
    showMessage('Error approving registration', false);
  }
}

// UC-04 A1: Reject registration with reason
async function rejectRegistration(userId) {
  const reason = prompt("Provide reason for rejection (A1):");
  if (!reason) return;

  try {
    const response = await fetch(`${API_URL}/api/manager/registrations/${userId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ decision: "REJECT", reason })
    });

    const data = await response.json();
    showMessage(data.message, response.ok);
    if (response.ok) loadRegistrations();
  } catch (error) {
    console.error('Error rejecting registration:', error);
    showMessage('Error rejecting registration', false);
  }
}

// UC-04 Step 4: Load pending complaints
async function loadComplaints() {
  try {
    const response = await fetch(`${API_URL}/api/manager/complaints/pending`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const container = document.getElementById('complaintsList');

      if (data.complaints && data.complaints.length > 0) {
        container.innerHTML = data.complaints.map(complaint => `
          <div class="item">
            <div class="item-header">${complaint.type} from ${complaint.from_user} to ${complaint.to_user}</div>
            <div class="item-meta">
              Rating: ${complaint.rating}/5 | Weight: ${complaint.weight} | Created: ${new Date(complaint.created_at).toLocaleDateString()}
            </div>
            <div style="margin: 8px 0; color: #555; font-size: 13px;">Message: ${complaint.message || 'No message'}</div>
            <div class="item-actions">
              <button class="btn-small btn-valid" onclick="resolveComplaint('${complaint.complaint_id}', 'VALID')">Mark Valid</button>
              <button class="btn-small btn-invalid" onclick="resolveComplaint('${complaint.complaint_id}', 'INVALID')">Mark Invalid</button>
              <button class="btn-small btn-view" onclick="escalateComplaint('${complaint.complaint_id}')">Escalate</button>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p>No pending complaints</p>';
      }
    }
  } catch (error) {
    console.error('Error loading complaints:', error);
    showMessage('Error loading complaints', false);
  }
}

// UC-04 Step 5: Resolve complaint
async function resolveComplaint(complaintId, decision) {
  try {
    const response = await fetch(`${API_URL}/api/manager/complaints/${complaintId}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ decision })
    });

    const data = await response.json();
    showMessage(data.message, response.ok);
    if (response.ok) loadComplaints();
  } catch (error) {
    console.error('Error resolving complaint:', error);
    showMessage('Error resolving complaint', false);
  }
}

// UC-04 Step 5: Escalate complaint
async function escalateComplaint(complaintId) {
  const note = prompt("Escalation notes:");
  if (!note) return;

  try {
    const response = await fetch(`${API_URL}/api/manager/complaints/${complaintId}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ decision: "ESCALATED", escalation_note: note })
    });

    const data = await response.json();
    showMessage(data.message, response.ok);
    if (response.ok) loadComplaints();
  } catch (error) {
    console.error('Error escalating complaint:', error);
    showMessage('Error escalating complaint', false);
  }
}

// UC-04 Step 6: Load employees
async function loadEmployees() {
  try {
    const response = await fetch(`${API_URL}/api/manager/employees`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const container = document.getElementById('employeesList');

      if (data.employees && data.employees.length > 0) {
        container.innerHTML = data.employees.map(emp => `
          <div class="item">
            <div class="item-header">${emp.name} - ${emp.role}</div>
            <div class="item-meta">
              Email: ${emp.email} | Status: ${emp.status}<br>
              Complaints: ${emp.net_complaints} | Demotions: ${emp.demotions} | Warnings: ${emp.warnings}
            </div>
            <div class="item-actions">
              ${emp.status === 'Active' && emp.role.includes('Demoted') ? `
                <button class="btn-small btn-approve" onclick="promoteEmployee('${emp.user_id}')">Restore Role</button>
              ` : ''}
              ${emp.status === 'Active' ? `
                <button class="btn-small btn-valid" onclick="showBonusModal('${emp.user_id}', '${emp.name}')">Pay Bonus</button>
              ` : ''}
              ${emp.status === 'Active' ? `
                <button class="btn-small btn-reject" onclick="fireEmployee('${emp.user_id}', '${emp.name}')">Fire</button>
              ` : ''}
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p>No employees</p>';
      }
    }
  } catch (error) {
    console.error('Error loading employees:', error);
    showMessage('Error loading employees', false);
  }
}

// UC-04 Step 6: Promote employee
async function promoteEmployee(userId) {
  if (!confirm('Promote this employee back to full role?')) return;

  try {
    const response = await fetch(`${API_URL}/api/manager/employees/${userId}/promote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await response.json();
    showMessage(data.message, response.ok);
    if (response.ok) loadEmployees();
  } catch (error) {
    console.error('Error promoting employee:', error);
    showMessage('Error promoting employee', false);
  }
}

// UC-04 Step 6: Show bonus payment modal
function showBonusModal(userId, empName) {
  const amount = prompt(`Pay performance bonus to ${empName}. Enter amount ($):`);
  if (!amount || isNaN(amount) || amount <= 0) {
    showMessage('Invalid bonus amount', false);
    return;
  }
  payBonus(userId, parseFloat(amount));
}

// UC-04 Step 6: Pay bonus
async function payBonus(userId, amount) {
  try {
    const response = await fetch(`${API_URL}/api/manager/employees/${userId}/bonus`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ amount })
    });

    const data = await response.json();
    showMessage(data.message, response.ok);
    if (response.ok) loadEmployees();
  } catch (error) {
    console.error('Error paying bonus:', error);
    showMessage('Error paying bonus', false);
  }
}

// UC-04 Step 6: Fire employee
async function fireEmployee(userId, empName) {
  const reason = prompt(`Fire ${empName}. Provide reason:`);
  if (!reason) return;

  try {
    const response = await fetch(`${API_URL}/api/manager/employees/${userId}/fire`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ reason })
    });

    const data = await response.json();
    showMessage(data.message, response.ok);
    if (response.ok) loadEmployees();
  } catch (error) {
    console.error('Error firing employee:', error);
    showMessage('Error firing employee', false);
  }
}

// UC-04 Step 7: Load delivery bids
async function loadDeliveryBids() {
  try {
    const response = await fetch(`${API_URL}/api/manager/delivery-bids/pending`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const container = document.getElementById('bidsList');

      if (data.bids && data.bids.length > 0) {
        container.innerHTML = data.bids.map(bid => `
          <div class="item">
            <div class="item-header">Order #${bid.order_id.slice(-6)} from ${bid.customer}</div>
            <div class="item-meta">
              Delivery Person: ${bid.delivery_person} | Bid: $${bid.bid_amount.toFixed(2)}<br>
              Items: ${bid.items_count} | Status: ${bid.order_status}
            </div>
            <div class="item-actions">
              <button class="btn-small btn-assign" onclick="showAssignModal('${bid.bid_id}', ${bid.bid_amount})">Assign</button>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p>No pending delivery bids</p>';
      }
    }
  } catch (error) {
    console.error('Error loading bids:', error);
    showMessage('Error loading delivery bids', false);
  }
}

// UC-04 Step 7-8: Show assignment modal with justification
function showAssignModal(bidId, bidAmount) {
  const justification = prompt(`UC-04 Step 7-8: Assign delivery bid. If this is not the lowest bid, provide justification (or leave blank for lowest bid):`);
  if (justification === null) return;
  assignDeliveryBid(bidId, justification || null);
}

// UC-04 Step 7-8: Assign delivery bid
async function assignDeliveryBid(bidId, justification) {
  try {
    const response = await fetch(`${API_URL}/api/manager/delivery-bids/${bidId}/assign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ justification })
    });

    const data = await response.json();
    showMessage(data.message || data.error, response.ok);
    if (response.ok) loadDeliveryBids();
  } catch (error) {
    console.error('Error assigning bid:', error);
    showMessage('Error assigning delivery bid', false);
  }
}

// UC-04 Step 9: Load flagged AI responses
async function loadFlaggedAI() {
  try {
    const response = await fetch(`${API_URL}/api/manager/ai/flagged`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const container = document.getElementById('flaggedList');

      if (data.flagged_responses && data.flagged_responses.length > 0) {
        container.innerHTML = data.flagged_responses.map(response => `
          <div class="item">
            <div class="item-header">Question: ${response.question}</div>
            <div class="item-meta">
              Source: ${response.source} | Flagged: ${new Date(response.created_at).toLocaleDateString()}
            </div>
            <div style="margin: 8px 0; color: #555; font-size: 13px;">
              <strong>Current Answer:</strong> ${response.answer}
            </div>
            <div class="item-actions">
              <button class="btn-small btn-correct" onclick="showCorrectionModal('${response.chat_id}')">Correct & Update KB</button>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p>No flagged AI responses</p>';
      }
    }
  } catch (error) {
    console.error('Error loading flagged responses:', error);
    showMessage('Error loading flagged responses', false);
  }
}

// UC-04 Step 9: Show correction modal
function showCorrectionModal(chatId) {
  const correctedAnswer = prompt("UC-04 Step 9: Provide corrected answer (will be added to Knowledge Base):");
  if (!correctedAnswer) return;
  correctAIResponse(chatId, correctedAnswer);
}

// UC-04 Step 9: Correct AI response and update KB
async function correctAIResponse(chatId, correctedAnswer) {
  try {
    const response = await fetch(`${API_URL}/api/manager/ai/flagged/${chatId}/correct`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ corrected_answer: correctedAnswer })
    });

    const data = await response.json();
    showMessage(data.message, response.ok);
    if (response.ok) loadFlaggedAI();
  } catch (error) {
    console.error('Error correcting response:', error);
    showMessage('Error correcting response', false);
  }
}

function showMessage(message, isSuccess) {
  const el = document.getElementById('message');
  el.textContent = message;
  el.className = `message ${isSuccess ? 'success' : 'error'}`;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', function() {
  // Setup tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      if (tabName) switchTab(tabName);
    });
  });

  // Load dashboard on page load
  loadDashboard();
});
