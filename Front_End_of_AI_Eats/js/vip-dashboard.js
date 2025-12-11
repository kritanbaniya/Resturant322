const API_URL = "http://127.0.0.1:5000";
const userId = localStorage.getItem("userId");
const isVIP = localStorage.getItem("isVIP") === "true";
const username = localStorage.getItem("username");

if (!isVIP) {
  alert("Access Denied: This dashboard is for VIP members only.");
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

  if (tabName === 'exclusive') loadExclusiveItems();
  if (tabName === 'history') loadOrderHistory();
}

async function loadExclusiveItems() {
  try {
    const response = await fetch(`${API_URL}/api/menu/`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });

    if (response.ok) {
      const dishes = await response.json();
      const vipDishes = dishes.filter(d => d.average_rating >= 4.7).slice(0, 8);
      const container = document.getElementById('exclusiveItems');

      if (vipDishes.length > 0) {
        container.innerHTML = vipDishes.map(dish => `
          <div class="item">
            <div class="item-name">⭐ ${dish.name}</div>
            <div class="item-details">
              <strong>Price:</strong> $${dish.price}<br>
              <strong>Rating:</strong> ${dish.average_rating}/5 (${dish.rating_count} reviews)<br>
              <strong>Category:</strong> ${dish.category}
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p>No exclusive items available</p>';
      }
    }
  } catch (error) {
    console.error('Error loading exclusive items:', error);
  }
}

async function loadOrderHistory() {
  try {
    const response = await fetch(`${API_URL}/api/orders/history/${userId}`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });

    if (response.ok) {
      const data = await response.json();
      const container = document.getElementById('orderHistory');

      if (data.orders && data.orders.length > 0) {
        container.innerHTML = data.orders.slice(0, 10).map(order => `
          <div class="item">
            <div class="item-name">Order #${order._id.slice(-6)}</div>
            <div class="item-details">
              <strong>Status:</strong> ${order.status}<br>
              <strong>Total:</strong> $${order.total_price.toFixed(2)} (10% VIP discount applied)<br>
              <strong>Items:</strong> ${order.items.length} items<br>
              <strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p>No orders found</p>';
      }
    }
  } catch (error) {
    console.error('Error loading order history:', error);
  }
}

function copyReferralCode() {
  const code = document.getElementById('referralCode').textContent;
  navigator.clipboard.writeText(code);
  alert('Referral code copied: ' + code);
}

function updateAuthStatus() {
  const username = localStorage.getItem("username");
  const authLink = document.getElementById("auth-link");
  
  if (username) {
    authLink.textContent = `👤 👑 ${username}`;
    authLink.href = "profile.html";
  }
}

function updateCartCount() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById("cart-count").textContent = totalItems;
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

  updateAuthStatus();
  updateCartCount();
  loadExclusiveItems();
});
