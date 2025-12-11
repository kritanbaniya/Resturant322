const API_URL = "http://127.0.0.1:5000";

function showTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab
  document.getElementById(`${tabName}-tab`).classList.add('active');
  
  // Find and activate the clicked button
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    }
  });

  // Load data for the tab
  if (tabName === 'submitted') {
    loadSubmittedComplaints();
  } else if (tabName === 'received') {
    loadReceivedComplaints();
  }
}

async function loadSubmittedComplaints() {
  const userId = localStorage.getItem("userId");
  const listEl = document.getElementById("submitted-list");

  if (!userId) {
    listEl.innerHTML = '<p class="no-data">Please login to view your submissions.</p>';
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/api/complaints/submitted/${userId}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    if (response.ok) {
      const complaints = await response.json();
      
      if (complaints.length === 0) {
        listEl.innerHTML = '<p class="no-data">No submissions yet.</p>';
        return;
      }

      listEl.innerHTML = complaints.map(c => `
        <div class="complaint-card ${c.is_complaint ? 'complaint' : 'compliment'}">
          <div class="complaint-header">
            <span class="complaint-type">${c.is_complaint ? 'Complaint' : 'Compliment'}</span>
            <span class="complaint-status ${c.status.toLowerCase()}">${c.status}</span>
            <span class="complaint-date">${new Date(c.created_at).toLocaleDateString()}</span>
          </div>
          <div class="complaint-body">
            <p><strong>About:</strong> ${c.entity_type}</p>
            <p><strong>Target ID:</strong> ${c.target_id}</p>
            <p><strong>To:</strong> ${c.to_name || c.to}</p>
            <p><strong>Weight:</strong> ${c.weight}</p>
            <p><strong>Message:</strong> ${c.text}</p>
          </div>
        </div>
      `).join('');
    } else {
      listEl.innerHTML = '<p class="error">Failed to load submissions.</p>';
    }
  } catch (error) {
    console.error("Error loading submissions:", error);
    listEl.innerHTML = '<p class="error">Error connecting to server.</p>';
  }
}

async function loadReceivedComplaints() {
  const userId = localStorage.getItem("userId");
  const listEl = document.getElementById("received-list");

  if (!userId) {
    listEl.innerHTML = '<p class="no-data">Please login to view received complaints.</p>';
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/api/complaints/received/${userId}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    if (response.ok) {
      const complaints = await response.json();
      
      if (complaints.length === 0) {
        listEl.innerHTML = '<p class="no-data">No complaints or compliments received.</p>';
        return;
      }

      listEl.innerHTML = complaints.map(c => `
        <div class="complaint-card ${c.is_complaint ? 'complaint' : 'compliment'}">
          <div class="complaint-header">
            <span class="complaint-type">${c.is_complaint ? 'Complaint' : 'Compliment'}</span>
            <span class="complaint-status ${c.status.toLowerCase()}">${c.status}</span>
            <span class="complaint-date">${new Date(c.created_at).toLocaleDateString()}</span>
          </div>
          <div class="complaint-body">
            <p><strong>About:</strong> ${c.entity_type}</p>
            <p><strong>Target ID:</strong> ${c.target_id}</p>
            <p><strong>From:</strong> ${c.from_name || c.from}</p>
            <p><strong>Weight:</strong> ${c.weight}</p>
            <p><strong>Message:</strong> ${c.text}</p>
          </div>
        </div>
      `).join('');
    } else {
      listEl.innerHTML = '<p class="error">Failed to load received complaints.</p>';
    }
  } catch (error) {
    console.error("Error loading received complaints:", error);
    listEl.innerHTML = '<p class="error">Error connecting to server.</p>';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Handle tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      showTab(tabName);
    });
  });

  // Handle type selector buttons
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      document.getElementById('selected-type').value = this.dataset.type;
    });
  });

  // Handle star rating
  document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', function() {
      const rating = parseInt(this.dataset.rating);
      document.getElementById('rating').value = rating;
      
      // Update star display
      document.querySelectorAll('.star').forEach((s, index) => {
        if (index < rating) {
          s.textContent = '★';
          s.classList.add('active');
        } else {
          s.textContent = '[o]';
          s.classList.remove('active');
        }
      });
    });
  });

  document.getElementById('complaint-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userId = localStorage.getItem("userId");
    const isVIP = localStorage.getItem("isVIP") === "true";
    const messageEl = document.getElementById("form-message");

    if (!userId) {
      messageEl.textContent = "Please login to file a complaint or compliment.";
      messageEl.style.color = "#d32f2f";
      return;
    }

    const targetUser = document.getElementById("target-user").value.trim();
    const messageText = document.getElementById("message").value.trim();
    const entityType = document.getElementById("entity-type").value;

    // Validate all fields
    if (!targetUser) {
      messageEl.textContent = "Please enter a Recipient ID.";
      messageEl.style.color = "#d32f2f";
      return;
    }

    if (!messageText) {
      messageEl.textContent = "Please enter a message.";
      messageEl.style.color = "#d32f2f";
      return;
    }

    if (!entityType) {
      messageEl.textContent = "Please select what this complaint is about.";
      messageEl.style.color = "#d32f2f";
      return;
    }

    const rating = parseInt(document.getElementById('rating').value) || 0;

    const formData = {
      from_user: userId,
      to_user: targetUser,
      text: messageText,
      entity_type: entityType,
      rating: rating,
      weight: isVIP ? 2 : 1,
      isComplaint: document.getElementById('selected-type').value === 'complaint'
    };

    console.log("Submitting rating/feedback:");
    console.log("- from_user:", formData.from_user);
    console.log("- to_user:", formData.to_user);
    console.log("- text:", formData.text);
    console.log("- entity_type:", formData.entity_type);
    console.log("- rating:", formData.rating);
    console.log("- weight:", formData.weight);
    console.log("- isComplaint:", formData.isComplaint);
    console.log("Full data object:", JSON.stringify(formData, null, 2));

    try {
      const token = localStorage.getItem("token");
      // remove from_user from formData - backend will use authenticated user
      const { from_user, ...complaintData } = formData;
      const response = await fetch(`${API_URL}/api/complaints/file`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(complaintData)
      });

      const data = await response.json();

      if (response.ok) {
        messageEl.textContent = formData.isComplaint ? 
          "Complaint filed successfully!" : 
          "Compliment submitted successfully!";
        messageEl.style.color = "#2e7d32";
        
        // Reset form
        document.getElementById("complaint-form").reset();
        // Reset type selector
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.type-btn[data-type="complaint"]').classList.add('active');
        document.getElementById('selected-type').value = 'complaint';
        // Reset star rating
        document.getElementById('rating').value = '0';
        document.querySelectorAll('.star').forEach(s => {
          s.textContent = '[o]';
          s.classList.remove('active');
        });
        
        // Clear message after 3 seconds
        setTimeout(() => {
          messageEl.textContent = "";
        }, 3000);
      } else {
        console.error("Server error:", data);
        console.error("Full response:", response);
        const errorMsg = data.error || data.message || JSON.stringify(data) || "Failed to submit.";
        messageEl.textContent = errorMsg;
        messageEl.style.color = "#d32f2f";
        alert("Error: " + errorMsg); // Show alert with full error
      }
    } catch (error) {
      console.error("Error submitting:", error);
      messageEl.textContent = "Error connecting to server: " + error.message;
      messageEl.style.color = "#d32f2f";
    }
  });

  updateCartCount();
  updateAuthStatus();
});

function updateCartCount() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById("cart-count").textContent = totalItems;
}

function updateAuthStatus() {
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  const username = localStorage.getItem("username");
  const isVIP = localStorage.getItem("isVIP") === "true";
  const authLink = document.getElementById("auth-link");
  
  if (isLoggedIn === "true" && username) {
    const vipIcon = isVIP ? "VIP " : "";
    authLink.textContent = `${vipIcon}${username}`;
    authLink.href = "profile.html";
  } else {
    authLink.textContent = "Login/Register";
    authLink.href = "login.html";
  }
}
