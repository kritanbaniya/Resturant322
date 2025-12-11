const API_URL = "http://127.0.0.1:5000";

async function loadProfile() {
  const username = localStorage.getItem("username");
  const email = localStorage.getItem("email");
  const userId = localStorage.getItem("userId");
  const isLoggedIn = localStorage.getItem("isLoggedIn");

  if (isLoggedIn !== "true" || !username) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("profile-username").textContent = username;
  document.getElementById("profile-email").textContent = email || "Not provided";
  document.getElementById("display-username").textContent = username;
  document.getElementById("display-email").textContent = email || "Not provided";
  
  // Set member since date (using current date as placeholder)
  const memberSince = localStorage.getItem("memberSince") || new Date().toLocaleDateString();
  localStorage.setItem("memberSince", memberSince);
  document.getElementById("member-since").textContent = memberSince;

  // Fetch user data from backend if userId is available
  if (userId) {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/users/${userId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const userData = await response.json();
        // Update profile with backend data
        localStorage.setItem("userBalance", userData.balance);
        localStorage.setItem("totalSpent", userData.totalSpent);
        localStorage.setItem("orderCount", userData.orderCount);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  }

  loadOrderHistory();
  loadUserBalance();
  updateVIPStatus();
  updateCartCount();
  updateAuthStatus();
}

function editProfile() {
  alert("Edit profile feature coming soon!");
}

function openCardModal() {
  const amountInput = document.getElementById("deposit-amount");
  const amount = parseFloat(amountInput.value);
  const messageEl = document.getElementById("deposit-message");
  
  if (!amount || amount <= 0) {
    messageEl.textContent = "Please enter a valid amount";
    messageEl.style.color = "#d32f2f";
    return;
  }

  // Clear previous values
  document.getElementById("card-number").value = "";
  document.getElementById("card-name").value = "";
  document.getElementById("card-expiry").value = "";
  document.getElementById("card-cvv").value = "";
  document.getElementById("billing-zip").value = "";
  document.getElementById("card-error").style.display = "none";
  
  document.getElementById("modal-amount").textContent = amount.toFixed(2);
  document.getElementById("card-modal").style.display = "flex";
}

function closeCardModal() {
  document.getElementById("card-modal").style.display = "none";
}

function formatCardNumber(input) {
  let value = input.value.replace(/\s/g, '');
  let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
  input.value = formattedValue;
}

function formatExpiry(input) {
  let value = input.value.replace(/\D/g, '');
  if (value.length >= 2) {
    value = value.slice(0, 2) + '/' + value.slice(2, 4);
  }
  input.value = value;
}

function validateCard() {
  const cardNumber = document.getElementById("card-number").value.replace(/\s/g, '');
  const cardName = document.getElementById("card-name").value.trim();
  const cardExpiry = document.getElementById("card-expiry").value;
  const cardCvv = document.getElementById("card-cvv").value;
  const billingZip = document.getElementById("billing-zip").value.trim();
  const errorEl = document.getElementById("card-error");

  if (cardNumber.length < 13 || cardNumber.length > 16) {
    errorEl.textContent = "Invalid card number";
    errorEl.style.display = "block";
    return false;
  }

  if (!cardName || cardName.length < 3) {
    errorEl.textContent = "Please enter cardholder name";
    errorEl.style.display = "block";
    return false;
  }

  if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
    errorEl.textContent = "Invalid expiry date (use MM/YY)";
    errorEl.style.display = "block";
    return false;
  }

  if (!/^\d{3}$/.test(cardCvv)) {
    errorEl.textContent = "Invalid CVV";
    errorEl.style.display = "block";
    return false;
  }

  if (!billingZip || billingZip.length < 5) {
    errorEl.textContent = "Please enter billing ZIP code";
    errorEl.style.display = "block";
    return false;
  }

  errorEl.style.display = "none";
  return true;
}

async function processDeposit() {
  if (!validateCard()) {
    return;
  }

  const userId = localStorage.getItem("userId");
  const amount = parseFloat(document.getElementById("modal-amount").textContent);
  const messageEl = document.getElementById("deposit-message");
  const processBtn = document.getElementById("process-btn");
  
  processBtn.textContent = "Processing...";
  processBtn.disabled = true;

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/api/users/deposit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        amount: amount
      })
    });

    const data = await response.json();

    if (response.ok) {
      closeCardModal();
      messageEl.textContent = `Successfully deposited $${amount.toFixed(2)}`;
      messageEl.style.color = "#2e7d32";
      document.getElementById("deposit-amount").value = "25.00";
      
      // Refresh balance display immediately
      loadUserBalance();
      setTimeout(() => {
        messageEl.textContent = "";
      }, 3000);
    } else {
      document.getElementById("card-error").textContent = data.error || "Deposit failed";
      document.getElementById("card-error").style.display = "block";
    }
  } catch (error) {
    console.error("Error depositing funds:", error);
    document.getElementById("card-error").textContent = "Error connecting to server";
    document.getElementById("card-error").style.display = "block";
  } finally {
    processBtn.textContent = "Process Payment";
    processBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const cardNumberInput = document.getElementById('card-number');
  const expiryInput = document.getElementById('card-expiry');
  const cvvInput = document.getElementById('card-cvv');
  
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', function() {
      formatCardNumber(this);
    });
  }
  
  if (expiryInput) {
    expiryInput.addEventListener('input', function() {
      formatExpiry(this);
    });
  }
  
  if (cvvInput) {
    cvvInput.addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '').slice(0, 3);
    });
  }
});

async function loadUserBalance() {
  const userId = localStorage.getItem("userId");
  
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    if (response.ok) {
      const userData = await response.json();
      document.getElementById("balance-value").textContent = `$${userData.balance.toFixed(2)}`;
      document.getElementById("total-spent").textContent = `$${userData.totalSpent.toFixed(2)}`;
      document.getElementById("order-count").textContent = userData.orderCount;
      document.getElementById("warning-count").textContent = userData.warningCount || 0;
      
      // UC-01 A3: Update warning message based on role
      const warningMsg = document.getElementById("warning-message");
      const isVIP = userData.role === "VIP";
      const warningCount = userData.warningCount || 0;
      
      if (warningCount === 0) {
        warningMsg.textContent = "No warnings - Account in good standing ✓";
        warningMsg.style.color = "#2e7d32";
      } else if (isVIP) {
        // VIPs: 2 warnings = lose VIP status
        if (warningCount === 1) {
          warningMsg.textContent = "You have 1 warning. One more warning will result in VIP status loss!";
          warningMsg.style.color = "#f57f17";
        } else if (warningCount >= 2) {
          warningMsg.textContent = "CRITICAL: You will lose VIP status on next warning!";
          warningMsg.style.color = "#d32f2f";
        }
      } else {
        // Regular Customers: 3 warnings = deregistration
        if (warningCount === 1) {
          warningMsg.textContent = "You have 1 warning. 2 more warnings will result in account deregistration.";
          warningMsg.style.color = "#f57f17";
        } else if (warningCount === 2) {
          warningMsg.textContent = "CRITICAL: You have 2 warnings. One more warning will deregister your account!";
          warningMsg.style.color = "#d32f2f";
        } else if (warningCount >= 3) {
          warningMsg.textContent = "Account flagged for deregistration due to excessive warnings.";
          warningMsg.style.color = "#d32f2f";
        }
      }
      
      localStorage.setItem("userBalance", userData.balance);
      localStorage.setItem("totalSpent", userData.totalSpent);
      localStorage.setItem("orderCount", userData.orderCount);
    }
  } catch (error) {
    console.error("Error loading balance:", error);
  }
}

function logout() {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    localStorage.removeItem("password");
    localStorage.removeItem("userId");
    window.location.href = "index.html";
  }
}

function updateCartCount() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById("cart-count").textContent = totalItems;
}

async function loadOrderHistory() {
  const userId = localStorage.getItem("userId");
  const currentUsername = localStorage.getItem("username");
  const orderHistoryContainer = document.getElementById("order-history");
  
  try {
    // Try to fetch from backend first
    if (userId) {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/orders/history/${userId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const orders = await response.json();
        if (orders.length > 0) {
          orderHistoryContainer.innerHTML = orders.map(order => `
            <div class="order-item">
              <div class="order-header">
                <span class="order-id">Order #${order.id || order.order_id}</span>
                <span class="order-date">${new Date(order.order_date).toLocaleDateString()}</span>
              </div>
              <div class="order-details">
                <div class="order-status">Status: ${order.status}</div>
                <div class="order-total">Total: ${order.total}</div>
              </div>
            </div>
          `).join('');
          return;
        }
      }
    }
  } catch (error) {
    console.error("Error fetching order history:", error);
  }
  
  // Fallback to localStorage
  const allOrders = JSON.parse(localStorage.getItem("orders")) || [];
  const userOrders = allOrders.filter(order => order.username === currentUsername);
  
  if (userOrders.length === 0) {
    orderHistoryContainer.innerHTML = '<p class="no-orders">No orders yet. <a href="menu.html">Start ordering!</a></p>';
    return;
  }
  
  orderHistoryContainer.innerHTML = userOrders.map(order => `
    <div class="order-item">
      <div class="order-header">
        <span class="order-id">Order #${order.orderId}</span>
        <span class="order-date">${new Date(order.orderDate).toLocaleDateString()}</span>
      </div>
      <div class="order-details">
        <div class="order-items">
          ${order.items.map(item => `<span>${item.name} x${item.quantity}</span>`).join(', ')}
        </div>
        <div class="order-total">${order.total}</div>
      </div>
      <div class="order-status">Status: ${order.status}</div>
    </div>
  `).join('');
}

async function updateVIPStatus() {
  const userId = localStorage.getItem("userId");
  
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_URL}/api/users/${userId}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    if (response.ok) {
      const userData = await response.json();
      const isVIP = userData.role === "VIP";
      const membershipStatus = document.getElementById("membership-status");
      const vipActionBtn = document.getElementById("vip-action-btn");
      
      // Update localStorage
      localStorage.setItem("isVIP", isVIP.toString());
      
      // UC-02: Show Chef/DeliveryPerson status
      if (userData.role === "Chef" || userData.role === "DeliveryPerson") {
        membershipStatus.innerHTML = `<span class="vip-status">${userData.role === "Chef" ? "[CHEF]" : "[DELIVERY]"} ${userData.role}</span>`;
        if (vipActionBtn) {
          vipActionBtn.textContent = userData.role === "Chef" ? "View Dashboard" : "View Deliveries";
          vipActionBtn.href = userData.role === "Chef" ? "chef-dashboard.html" : "delivery-dashboard.html";
        }
      } else if (userData.role === "Demoted_Chef" || userData.role === "Demoted_DeliveryPerson") {
        membershipStatus.innerHTML = `<span class="vip-status" style="background: #ff6b6b;">[WARNING] ${userData.role}</span>`;
        if (vipActionBtn) {
          vipActionBtn.textContent = userData.role === "Demoted_Chef" ? "Improve Performance" : "View Deliveries";
          vipActionBtn.href = userData.role === "Demoted_Chef" ? "chef-ratings.html" : "delivery-dashboard.html";
        }
      } else if (isVIP) {
        membershipStatus.innerHTML = '<span class="vip-status">[VIP] VIP Member</span>';
        if (vipActionBtn) {
          vipActionBtn.textContent = "Manage VIP";
          vipActionBtn.href = "vip-membership.html";
        }
      } else {
        // UC-01 A2: Show VIP upgrade progress
        const totalSpent = userData.totalSpent || 0;
        const orderCount = userData.orderCount || 0;
        const warningCount = userData.warningCount || 0;
        
        let vipMessage = "Regular Member";
        
        if (warningCount > 0) {
          vipMessage += " ([WARNING] Clear warnings to qualify for VIP)";
        } else {
          const spentProgress = Math.min((totalSpent / 100) * 100, 100);
          const orderProgress = Math.min((orderCount / 3) * 100, 100);
          
          if (totalSpent >= 100 || orderCount >= 3) {
            vipMessage += " (Eligible for VIP upgrade!)";
          } else {
            vipMessage += ` (Spend $${(100 - totalSpent).toFixed(2)} more OR make ${3 - orderCount} more order${3 - orderCount !== 1 ? 's' : ''} for VIP)`;
          }
        }
        
        membershipStatus.textContent = vipMessage;
        if (vipActionBtn) {
          vipActionBtn.textContent = "Upgrade to VIP";
          vipActionBtn.href = "vip-membership.html";
        }
      }
    }
  } catch (error) {
    console.error("Error updating VIP status:", error);
  }
}

function updateAuthStatus() {
  const username = localStorage.getItem("username");
  const isVIP = localStorage.getItem("isVIP") === "true";
  const authLink = document.getElementById("auth-link");
  
  if (username) {
    const vipIcon = isVIP ? "VIP " : "";
    authLink.textContent = `${vipIcon}${username}`;
    authLink.href = "profile.html";
  }
}

// Load profile on page load
loadProfile();
