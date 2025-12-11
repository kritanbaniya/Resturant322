const API_BASE = "http://127.0.0.1:5000/api";
let currentUser = null;

// Check if user is logged in as Chef
function checkAuth() {
  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("user_id");
  const role = localStorage.getItem("role");

  if (!token || !userId) {
    alert("Please log in first.");
    window.location.href = "login.html";
    return null;
  }

  if (role !== "Chef") {
    alert("Unauthorized. Only chefs can access this page.");
    window.location.href = "index.html";
    return null;
  }

  return { token, userId, role };
}

// Load chef performance data
async function loadPerformanceData() {
  try {
    // Get complaints and compliments about this chef
    const complaintResponse = await fetch(`${API_BASE}/complaints/received/${currentUser.userId}`, {
      headers: {
        "Authorization": `Bearer ${currentUser.token}`
      }
    });

    if (!complaintResponse.ok) {
      console.error("Failed to fetch complaints");
      return;
    }

    const complaints = await complaintResponse.json();
    displayPerformanceData(complaints);
  } catch (error) {
    console.error("Error loading performance data:", error);
  }
}

// Display performance data
function displayPerformanceData(complaints) {
  if (!complaints || complaints.length === 0) {
    document.getElementById("avg-rating").textContent = "N/A";
    document.getElementById("complaint-count").textContent = "0";
    document.getElementById("compliment-count").textContent = "0";
    document.getElementById("net-complaints").textContent = "0";
    return;
  }

  // Filter by valid complaints/compliments
  const validComplaints = complaints.filter(c => c.status === "Valid" && c.is_complaint);
  const validCompliments = complaints.filter(c => c.status === "Valid" && !c.is_complaint);

  // Calculate average rating
  const ratings = complaints
    .filter(c => c.rating > 0)
    .map(c => c.rating);
  const avgRating = ratings.length > 0 
    ? (ratings.reduce((a, b) => a + b) / ratings.length).toFixed(2)
    : "N/A";

  // Calculate net complaints
  const netComplaints = validComplaints.length - validCompliments.length;

  // Update display
  document.getElementById("avg-rating").textContent = avgRating;
  document.getElementById("complaint-count").textContent = validComplaints.length;
  document.getElementById("compliment-count").textContent = validCompliments.length;
  document.getElementById("net-complaints").textContent = netComplaints;

  // Display recent reviews
  displayReviews(complaints.slice(0, 10));

  // Show status message if near threshold
  showStatusMessage(avgRating, netComplaints, validCompliments.length);
}

// Display recent reviews
function displayReviews(reviews) {
  const container = document.getElementById("reviews-list");

  if (!reviews || reviews.length === 0) {
    container.innerHTML = "<p>No reviews yet</p>";
    return;
  }

  container.innerHTML = reviews.map(review => `
    <div class="review-card ${review.status.toLowerCase()}">
      <div class="review-header">
        <span class="review-type ${review.is_complaint ? 'complaint' : 'compliment'}">
          ${review.is_complaint ? '[DISLIKE] Complaint' : '[LIKE] Compliment'}
        </span>
        <span class="review-rating">
          ${review.rating > 0 ? '[*]'.repeat(review.rating) + '[o]'.repeat(5 - review.rating) : 'N/A'}
        </span>
      </div>
      <div class="review-content">
        <p><strong>From:</strong> ${review.from_name}</p>
        <p><strong>Message:</strong> ${review.text || 'No message'}</p>
        <p class="review-date"> ${new Date(review.created_at).toLocaleString()}</p>
      </div>
    </div>
  `).join('');
}

// Show status message
function showStatusMessage(avgRating, netComplaints, compliments) {
  const statusMsg = document.getElementById("status-message");
  const statusTitle = document.getElementById("status-title");
  const statusText = document.getElementById("status-text");

  // Check demotion threshold
  if (avgRating !== "N/A" && avgRating < 2.0) {
    statusMsg.className = "status-card danger";
    statusTitle.textContent = "[WARNING] CRITICAL: Low Ratings";
    statusText.textContent = `Your average rating (${avgRating}) is below 2.0 stars. You are at risk of demotion. Improve your performance immediately!`;
    statusMsg.style.display = "block";
    return;
  }

  if (netComplaints >= 3) {
    statusMsg.className = "status-card danger";
    statusTitle.textContent = "[WARNING] CRITICAL: High Complaints";
    statusText.textContent = `You have ${netComplaints} net complaints. You are at risk of demotion. Resolve complaints and improve service!`;
    statusMsg.style.display = "block";
    return;
  }

  // Check bonus threshold
  if (avgRating !== "N/A" && avgRating > 4.0) {
    statusMsg.className = "status-card success";
    statusTitle.textContent = "[CONGRATS] Excellent Performance!";
    statusText.textContent = `Your average rating (${avgRating}) is excellent! You may be eligible for a performance bonus.`;
    statusMsg.style.display = "block";
    return;
  }

  if (compliments >= 3) {
    statusMsg.className = "status-card success";
    statusTitle.textContent = "[CONGRATS] Excellent Feedback!";
    statusText.textContent = `You have received ${compliments} compliments! You may be eligible for a performance bonus.`;
    statusMsg.style.display = "block";
    return;
  }

  // Good standing
  if (netComplaints <= 1) {
    statusMsg.className = "status-card info";
    statusTitle.textContent = "[OK] Good Standing";
    statusText.textContent = "Your performance is satisfactory. Keep maintaining high quality!";
    statusMsg.style.display = "block";
  }
}

// Check performance evaluation
async function checkPerformance() {
  try {
    const response = await fetch(`${API_BASE}/chefs/performance/${currentUser.userId}`, {
      headers: {
        "Authorization": `Bearer ${currentUser.token}`
      }
    });

    if (!response.ok) {
      throw new Error("Failed to fetch performance evaluation");
    }

    const result = await response.json();
    displayPerformanceResult(result);
    document.getElementById("performance-modal").style.display = "flex";
  } catch (error) {
    console.error("Error checking performance:", error);
    alert(`Error: ${error.message}`);
  }
}

// Display performance result
function displayPerformanceResult(result) {
  const container = document.getElementById("performance-result");

  let actionIcon = "";
  let actionColor = "#2196F3";

  if (result.action === "demoted") {
    actionIcon = "[HOLD]";
    actionColor = "#F44336";
  } else if (result.action === "terminated") {
    actionIcon = "[ERROR]";
    actionColor = "#C62828";
  } else if (result.action === "bonus") {
    actionIcon = "[BONUS]";
    actionColor = "#4CAF50";
  }

  container.innerHTML = `
    <div style="text-align: center;">
      <h2 style="font-size: 48px; margin: 0;">${actionIcon}</h2>
      <h3 style="color: ${actionColor}; margin-top: 10px;">
        ${result.message || "Performance Evaluated"}
      </h3>
    </div>

    <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px;">
      <h4>Performance Metrics:</h4>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;">
        <div>
          <p><strong>Average Rating:</strong> ${result.avg_rating}/5.0</p>
          <p><strong>Complaints:</strong> ${result.complaint_count}</p>
        </div>
        <div>
          <p><strong>Compliments:</strong> ${result.compliment_count}</p>
          <p><strong>Net Complaints:</strong> ${result.net_complaints}</p>
        </div>
      </div>
    </div>

    ${result.action === "demoted" ? `
      <div style="margin-top: 20px; padding: 15px; background: #ffebee; border-left: 4px solid #F44336; border-radius: 4px;">
        <strong style="color: #C62828;">Demotion Notice:</strong>
        <p>Your role has been changed to "Demoted_Chef" due to poor performance. You have one opportunity to improve before termination.</p>
      </div>
    ` : ""}

    ${result.action === "terminated" ? `
      <div style="margin-top: 20px; padding: 15px; background: #ffebee; border-left: 4px solid #C62828; border-radius: 4px;">
        <strong style="color: #C62828;">Termination Notice:</strong>
        <p>Your employment has been terminated due to repeated poor performance. Please contact the manager for details.</p>
      </div>
    ` : ""}

    ${result.action === "bonus" ? `
      <div style="margin-top: 20px; padding: 15px; background: #e8f5e9; border-left: 4px solid #4CAF50; border-radius: 4px;">
        <strong style="color: #2e7d32;">Bonus Awarded!</strong>
        <p>Congratulations! You have been awarded a performance bonus for your excellent service and high ratings.</p>
      </div>
    ` : ""}
  `;
}

// Close modal
function closePerformanceModal() {
  document.getElementById("performance-modal").style.display = "none";
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

  // Check performance button
  const checkPerformanceBtn = document.getElementById("check-performance-btn");
  if (checkPerformanceBtn) {
    checkPerformanceBtn.addEventListener("click", checkPerformance);
  }

  // Close modal buttons
  const closeModalBtn = document.getElementById("close-modal-btn");
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closePerformanceModal);
  }

  const closeModalFooterBtn = document.getElementById("close-modal-footer-btn");
  if (closeModalFooterBtn) {
    closeModalFooterBtn.addEventListener("click", closePerformanceModal);
  }

  // Initialize
  currentUser = checkAuth();
  if (currentUser) {
    loadPerformanceData();
  }
});
