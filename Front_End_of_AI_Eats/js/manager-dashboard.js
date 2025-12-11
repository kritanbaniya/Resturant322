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
        container.innerHTML = data.employees.map(emp => {
          return `
          <div class="item">
            <div class="item-header">${emp.name} - ${emp.role}</div>
            <div class="item-meta">
              Email: ${emp.email} | Status: ${emp.status}<br>
              Complaints: ${emp.net_complaints} | Demotions: ${emp.demotions} | Warnings: ${emp.warnings}
            </div>
            <div class="item-actions">
              ${emp.status === 'Active' && emp.role.includes('Demoted') ? `
                <button class="btn-small btn-approve" data-action="promote" data-user-id="${emp.user_id}">Restore Role</button>
              ` : ''}
              ${emp.status === 'Active' ? `
                <button class="btn-small btn-valid" data-action="bonus" data-user-id="${emp.user_id}" data-user-name="${emp.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}">Pay Bonus</button>
              ` : ''}
              ${emp.status === 'Active' ? `
                <button class="btn-small btn-reject" data-action="fire" data-user-id="${emp.user_id}" data-user-name="${emp.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;')}">Fire</button>
              ` : ''}
            </div>
          </div>
        `;
        }).join('');
        
        // verify buttons were created
        const allButtons = container.querySelectorAll('[data-action]');
        console.log('Total action buttons created:', allButtons.length);
        allButtons.forEach(btn => {
          console.log('Button:', btn.textContent.trim(), 'Action:', btn.getAttribute('data-action'), 'User ID:', btn.getAttribute('data-user-id'));
        });
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
  console.log('showBonusModal called with userId:', userId, 'empName:', empName);
  const amount = prompt(`Pay performance bonus to ${empName}. Enter amount ($):`);
  console.log('Bonus amount entered:', amount);
  if (!amount || isNaN(amount) || amount <= 0) {
    console.log('Invalid bonus amount');
    showMessage('Invalid bonus amount', false);
    return;
  }
  payBonus(userId, parseFloat(amount));
}

// make functions globally accessible
window.promoteEmployee = promoteEmployee;
window.showBonusModal = showBonusModal;

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
  console.log('fireEmployee function called');
  console.log('Employee ID:', userId);
  console.log('Employee Name:', empName);
  
  const reason = prompt(`Fire ${empName}. Provide reason:`);
  console.log('Reason entered:', reason);
  
  if (reason === null) {
    console.log('User cancelled the prompt');
    return; // user cancelled
  }
  if (!reason || !reason.trim()) {
    console.log('Empty reason provided');
    showMessage('Reason is required to fire an employee', false);
    return;
  }

  console.log('Sending fire request to API...');
  try {
    const response = await fetch(`${API_URL}/api/manager/employees/${userId}/fire`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ reason: reason.trim() })
    });

    console.log('API Response status:', response.status);
    const data = await response.json();
    console.log('API Response data:', data);
    
    showMessage(data.message || data.error || 'Employee fired successfully', response.ok);
    if (response.ok) {
      console.log('Fire successful, reloading employees list...');
      loadEmployees();
    }
  } catch (error) {
    console.error('Error firing employee:', error);
    showMessage('Error firing employee: ' + error.message, false);
  }
}

// make function globally accessible
window.fireEmployee = fireEmployee;

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
              <button class="btn-small btn-assign" data-bid-id="${bid.bid_id}" data-bid-amount="${bid.bid_amount}" type="button">Assign</button>
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

// store current bid info for modal
let currentBidId = null;
let currentBidAmount = null;

// UC-04 Step 7-8: Show assignment modal with justification
function showAssignModal(bidId, bidAmount) {
  console.log('showAssignModal called with bidId:', bidId, 'bidAmount:', bidAmount);
  
  if (!bidId) {
    alert('Error: Invalid bid ID');
    console.error('showAssignModal: bidId is missing');
    return;
  }
  
  // store for use in confirm function
  currentBidId = bidId;
  currentBidAmount = bidAmount;
  
  // show modal
  const modal = document.getElementById('assignModal');
  const bidAmountSpan = document.getElementById('modalBidAmount');
  const justificationInput = document.getElementById('justificationInput');
  
  if (modal && bidAmountSpan) {
    bidAmountSpan.textContent = bidAmount.toFixed(2);
    justificationInput.value = ''; // clear previous input
    modal.style.display = 'block';
  } else {
    console.error('Modal elements not found');
    alert('Error: Modal not found. Please refresh the page.');
  }
}

// close assign modal
function closeAssignModal() {
  const modal = document.getElementById('assignModal');
  if (modal) {
    modal.style.display = 'none';
    currentBidId = null;
    currentBidAmount = null;
  }
}

// confirm assign delivery from modal
function confirmAssignDelivery() {
  if (!currentBidId) {
    alert('Error: No bid selected');
    console.error('confirmAssignDelivery: currentBidId is null or undefined');
    return;
  }
  
  console.log('confirmAssignDelivery: currentBidId type:', typeof currentBidId, 'value:', currentBidId);
  
  const justificationInput = document.getElementById('justificationInput');
  const justification = justificationInput ? justificationInput.value.trim() : '';
  const justificationValue = justification === '' ? null : justification;
  
  // save bidId before closing modal (since closeAssignModal clears it)
  const bidIdToAssign = String(currentBidId).trim();
  
  console.log('Calling assignDeliveryBid with bidId:', bidIdToAssign, 'type:', typeof bidIdToAssign, 'justification:', justificationValue);
  
  // close modal
  closeAssignModal();
  
  // assign delivery - use saved bidId
  assignDeliveryBid(bidIdToAssign, justificationValue);
}

// make functions globally accessible
window.showAssignModal = showAssignModal;
window.closeAssignModal = closeAssignModal;
window.confirmAssignDelivery = confirmAssignDelivery;

// UC-04 Step 7-8: Assign delivery bid
async function assignDeliveryBid(bidId, justification) {
  console.log('assignDeliveryBid called with bidId:', bidId, 'type:', typeof bidId, 'justification:', justification);
  
  if (!bidId) {
    alert('Error: Invalid bid ID');
    console.error('assignDeliveryBid: bidId is missing');
    return;
  }
  
  // ensure bidId is a string and trim whitespace
  const cleanBidId = String(bidId).trim();
  
  if (!cleanBidId || cleanBidId.length !== 24) {
    alert('Error: Invalid bid ID format. Bid ID must be 24 characters.');
    console.error('assignDeliveryBid: Invalid bidId format:', cleanBidId, 'length:', cleanBidId.length);
    return;
  }
  
  if (!token) {
    alert('Error: Not authenticated. Please log in again.');
    console.error('assignDeliveryBid: token is missing');
    return;
  }
  
  try {
    const url = `${API_URL}/api/manager/delivery-bids/${cleanBidId}/assign`;
    console.log('Sending request to:', url);
    console.log('Request body:', JSON.stringify({ justification: justification || null }));
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ justification: justification || null })
    });

    console.log('Response status:', response.status);
    
    let data;
    try {
      data = await response.json();
      console.log('Response data:', data);
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      const text = await response.text();
      console.error('Response text:', text);
      showMessage('Error: Invalid response from server', false);
      return;
    }
    
    if (response.ok) {
      showMessage(data.message || 'Delivery assigned successfully!', true);
      setTimeout(() => {
        loadDeliveryBids(); // reload the list to show updated status
      }, 500);
    } else {
      let errorMsg = 'Failed to assign delivery';
      if (data.error) {
        errorMsg = data.error;
      } else if (data.details) {
        errorMsg = data.details;
      } else if (data.message) {
        errorMsg = data.message;
      }
      
      // check for specific error messages
      if (errorMsg.includes('Invalid bid ID') || errorMsg.includes('Bid not found')) {
        errorMsg = 'Invalid bid ID. The bid may have already been assigned or no longer exists.';
      }
      
      showMessage(errorMsg, false);
      console.error('Assign delivery error - Full response:', data);
      console.error('BidId that was sent:', cleanBidId);
    }
  } catch (error) {
    console.error('Error assigning bid:', error);
    showMessage('Error assigning delivery bid: ' + error.message, false);
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

  // setup event delegation for employee action buttons
  const employeesContainer = document.getElementById('employeesList');
  if (employeesContainer) {
    employeesContainer.addEventListener('click', function(e) {
      const button = e.target.closest('[data-action]');
      if (!button) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const action = button.getAttribute('data-action');
      const userId = button.getAttribute('data-user-id');
      const userName = button.getAttribute('data-user-name');
      
      console.log('Button clicked - Action:', action, 'User ID:', userId, 'User Name:', userName);
      
      if (action === 'promote') {
        console.log('Calling promoteEmployee');
        promoteEmployee(userId);
      } else if (action === 'bonus') {
        console.log('Calling showBonusModal');
        showBonusModal(userId, userName);
      } else if (action === 'fire') {
        console.log('Calling fireEmployee');
        fireEmployee(userId, userName);
      }
    });
    console.log('Event delegation set up for employee buttons');
  }

  // setup event delegation for delivery bid assign buttons
  const bidsContainer = document.getElementById('bidsList');
  if (bidsContainer) {
    bidsContainer.addEventListener('click', function(e) {
      const button = e.target.closest('.btn-assign');
      if (!button) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const bidId = button.getAttribute('data-bid-id');
      const bidAmount = parseFloat(button.getAttribute('data-bid-amount'));
      
      console.log('Assign button clicked - Bid ID:', bidId, 'type:', typeof bidId, 'Bid Amount:', bidAmount);
      console.log('Button attributes:', {
        'data-bid-id': button.getAttribute('data-bid-id'),
        'data-bid-amount': button.getAttribute('data-bid-amount')
      });
      
      if (bidId && bidId.trim() !== '') {
        showAssignModal(bidId.trim(), bidAmount);
      } else {
        console.error('Bid ID is missing or empty from button');
        alert('Error: Invalid bid ID');
      }
    });
    console.log('Event delegation set up for delivery bid assign buttons');
  }

  // close modal when clicking outside
  const assignModal = document.getElementById('assignModal');
  if (assignModal) {
    assignModal.addEventListener('click', function(e) {
      if (e.target === assignModal) {
        closeAssignModal();
      }
    });
  }

  // Load dashboard on page load
  loadDashboard();
});
