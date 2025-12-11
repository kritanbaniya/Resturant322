const API_BASE = "http://127.0.0.1:5000/api";
let currentUser = null;

// Check if user is logged in
function checkAuth() {
  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("user_id");
  const role = localStorage.getItem("role");

  if (!token || !userId) {
    alert("Please log in first.");
    window.location.href = "login.html";
    return null;
  }

  if (role !== "Manager") {
    alert("Unauthorized. Only managers can access this page.");
    window.location.href = "index.html";
    return null;
  }

  return { token, userId, role };
}

// Load pending complaints
async function loadPendingComplaints() {
  try {
    const response = await fetch(`${API_BASE}/complaints/pending`, {
      headers: {
        "Authorization": `Bearer ${currentUser.token}`
      }
    });

    if (!response.ok) {
      throw new Error("Failed to fetch complaints");
    }

    const complaints = await response.json();
    displayComplaints(complaints);
  } catch (error) {
    console.error("Error loading complaints:", error);
    document.getElementById("complaints-list").innerHTML = 
      `<p class="error">Error loading complaints: ${error.message}</p>`;
  }
}

// Display complaints
function displayComplaints(complaints) {
  const container = document.getElementById("complaints-list");

  if (complaints.length === 0) {
    container.innerHTML = "<p>No pending complaints to review.</p>";
    return;
  }

  container.innerHTML = complaints.map(c => `
    <div class="complaint-card" id="complaint-${c.id}">
      <div class="complaint-header">
        <span class="complaint-type ${c.is_complaint ? 'complaint-type-complaint' : 'complaint-type-compliment'}">
          ${c.is_complaint ? '[WARNING] Complaint' : '[LIKE] Compliment'}
        </span>
        <span class="complaint-status status-${c.status.toLowerCase()}">${c.status}</span>
      </div>
      
      <div class="complaint-details">
        <p><strong>From:</strong> ${c.from_name} (ID: ${c.from})</p>
        <p><strong>To:</strong> ${c.to_name || 'N/A'} (ID: ${c.target_id})</p>
        <p><strong>Entity:</strong> ${c.entity_type}</p>
        <p><strong>Rating:</strong> ${'★'.repeat(c.rating)}${'[o]'.repeat(5 - c.rating)} (${c.rating}/5)</p>
        <p><strong>Weight:</strong> ${c.weight} ${c.weight === 2 ? '(VIP)' : ''}</p>
        <p><strong>Message:</strong> ${c.text}</p>
        <p><strong>Submitted:</strong> ${new Date(c.created_at).toLocaleString()}</p>
      </div>

      <div class="complaint-actions">
        <button class="btn-valid" onclick="resolveComplaint('${c.id}', 'Valid')">
          [OK] Mark as Valid
        </button>
        <button class="btn-invalid" onclick="resolveComplaint('${c.id}', 'Invalid')">
          [ERROR] Mark as Invalid
        </button>
      </div>
    </div>
  `).join('');
}

// Resolve complaint
async function resolveComplaint(complaintId, outcome) {
  const reason = outcome === "Invalid" 
    ? prompt("Enter reason for marking as invalid (optional):") || ""
    : "";

  if (outcome === "Invalid" && !confirm("This will apply a warning to the complainer. Continue?")) {
    return;
  }

  if (outcome === "Valid" && !confirm("This will apply punishment to the employee if applicable. Continue?")) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/complaints/resolve/${complaintId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentUser.token}`
      },
      body: JSON.stringify({
        outcome: outcome,
        manager_id: currentUser.userId,
        reason: reason
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to resolve complaint");
    }

    alert(result.message);
    
    // Remove the complaint card from view
    const card = document.getElementById(`complaint-${complaintId}`);
    if (card) {
      card.remove();
    }

    // Reload if no complaints left
    const remaining = document.querySelectorAll('.complaint-card');
    if (remaining.length === 0) {
      loadPendingComplaints();
    }

  } catch (error) {
    console.error("Error resolving complaint:", error);
    alert(`Error: ${error.message}`);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Logout
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.clear();
      window.location.href = "login.html";
    });
  }

  // Initialize page
  currentUser = checkAuth();
  if (currentUser) {
    loadPendingComplaints();
  }
});
