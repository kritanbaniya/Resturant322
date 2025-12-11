const API_URL = "http://127.0.0.1:5000";

async function loadFeaturedDishes() {
  try {
    const response = await fetch(`${API_URL}/api/menu/`);
    if (response.ok) {
      const dishes = await response.json();
      const featured = dishes
        .filter(d => d.average_rating >= 4.5)
        .sort((a, b) => b.average_rating - a.average_rating)
        .slice(0, 3);
      
      console.log('Featured dishes loaded:', featured);
    }
  } catch (error) {
    console.error('Error loading featured dishes:', error);
  }
}

function updateCartCount() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById("cart-count").textContent = totalItems;
}

function updateAuthStatus() {
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  const username = localStorage.getItem("username");
  const userRole = localStorage.getItem("userRole");
  const isVIP = localStorage.getItem("isVIP") === "true";
  const authLink = document.getElementById("auth-link");
  const dashboardLink = document.getElementById("dashboard-link");
  
  if (isLoggedIn === "true" && username) {
    const vipIcon = isVIP ? "[VIP] " : "";
    authLink.textContent = `[USER] ${vipIcon}${username}`;
    authLink.href = "profile.html";
    
    if (isVIP) {
      dashboardLink.style.display = "block";
      dashboardLink.href = "vip-dashboard.html";
      dashboardLink.textContent = "VIP Dashboard";
    } else if (userRole && userRole !== "Customer") {
      dashboardLink.style.display = "block";
      const dashboardMap = {
        "Manager": "manager-dashboard.html",
        "Chef": "chef-dashboard.html",
        "DeliveryPerson": "delivery-dashboard.html"
      };
      const linkTextMap = {
        "Manager": "Tasks",
        "Chef": "Orders",
        "DeliveryPerson": "Deliveries"
      };
      dashboardLink.href = dashboardMap[userRole] || "profile.html";
      dashboardLink.textContent = linkTextMap[userRole] || "Dashboard";
    }
  } else {
    authLink.textContent = "Login/Register";
    authLink.href = "login.html";
    dashboardLink.style.display = "none";
  }
}

function checkVIPAccess() {
  const isVIP = localStorage.getItem("isVIP") === "true";
  const vipContent = document.getElementById("vip-content");
  const vipLocked = document.getElementById("vip-locked");
  const vipBanner = document.getElementById("vip-banner");
  
  if (isVIP) {
    vipContent.style.display = "block";
    vipLocked.style.display = "none";
    vipBanner.style.display = "block";
  } else {
    vipContent.style.display = "none";
    vipLocked.style.display = "block";
    vipBanner.style.display = "none";
  }
}

function getStatusLabel(status) {
  const statusMap = {
    'PendingPayment': 'Pending Payment',
    'Paid': 'Payment Confirmed',
    'Rejected_Insufficient_Funds': 'Payment Failed',
    'Queued_For_Preparation': 'Waiting for Chef',
    'In_Preparation': 'Preparing',
    'On_Hold': 'On Hold',
    'Ready_For_Delivery': 'Ready',
    'Awaiting_Pickup': 'Awaiting Pickup',
    'Out_For_Delivery': 'Out for Delivery',
    'Completed': 'Delivered',
    'Delivery_Failed': 'Delivery Failed'
  };
  return statusMap[status] || status;
}

function loadOrderHistory() {
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  if (isLoggedIn !== "true") {
    document.getElementById("orders-section").style.display = "none";
    return;
  }

  const userId = localStorage.getItem("userId");
  const API_URL = "http://127.0.0.1:5000";
  
  fetch(`${API_URL}/api/orders/history/${userId}`)
    .then(res => res.json())
    .then(orders => {
      const ordersSection = document.getElementById("orders-section");
      const ordersList = document.getElementById("orders-list");
      const noOrders = document.getElementById("no-orders");
      
      if (!Array.isArray(orders) || orders.length === 0) {
        ordersSection.style.display = "block";
        ordersList.innerHTML = "";
        noOrders.style.display = "block";
        return;
      }
      
      ordersSection.style.display = "block";
      noOrders.style.display = "none";
      
      ordersList.innerHTML = orders.map(order => `
        <div class="order-card">
          <div class="order-header">
            <div class="order-id">Order #${String(order.id).slice(-6).toUpperCase()}</div>
            <div class="order-status ${order.status.toLowerCase()}">${getStatusLabel(order.status)}</div>
          </div>
          <div class="order-details">
            <p><strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
            <p><strong>Total:</strong> $${order.final_price.toFixed(2)}</p>
            <p><strong>Status:</strong> ${order.status}</p>
            <p><strong>Updated:</strong> ${new Date(order.created_at).toLocaleTimeString()}</p>
          </div>
          <div class="order-items-list">
            <strong>Items (${order.items.length}):</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #666;">
              ${order.items.map(item => `<li>${item.dish_name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}</li>`).join('')}
            </ul>
            ${order.discount_applied > 0 ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #ff6b6b;">VIP Discount Applied: -$${order.discount_applied.toFixed(2)}</p>` : ''}
          </div>
        </div>
      `).join("");
    })
    .catch(err => {
      console.error("Error loading orders:", err);
      document.getElementById("orders-section").style.display = "none";
    });
}

/* UC-05: Visitor Menu Browsing */
async function loadVisitorMenu() {
  try {
    const response = await fetch(`${API_URL}/api/visitor/menu`);
    if (!response.ok) {
      console.error("Error loading visitor menu:", response.statusText);
      return;
    }
    
    const data = await response.json();
    const dishes = data.menu || [];
    
    const menuGrid = document.getElementById("visitor-menu-grid");
    const noMenu = document.getElementById("no-menu");
    const visitorSection = document.getElementById("visitor-menu-section");
    
    if (dishes.length === 0) {
      menuGrid.innerHTML = "";
      noMenu.style.display = "block";
      return;
    }
    
    noMenu.style.display = "none";
    menuGrid.innerHTML = dishes.map(dish => `
      <div class="menu-card">
        <img src="${dish.image_url || 'images/default-dish.jpeg'}" alt="${dish.name}">
        <h3>${dish.name}</h3>
        <p>${dish.description}</p>
        <div class="dish-info">
          <span class="time">${dish.preparation_time}</span>
          <span class="available">${dish.available ? 'Available' : 'Out of Stock'}</span>
        </div>
        <span class="price">$${dish.price.toFixed(2)}</span>
        <div class="card-actions">
          <button onclick="viewDishDetails('${dish.id}')" class="btn-secondary">View Details</button>
        </div>
      </div>
    `).join("");
    
    visitorSection.style.display = "block";
  } catch (error) {
    console.error("Error loading visitor menu:", error);
  }
}

function viewDishDetails(dishId) {
  // Open a modal or navigate to dish details page
  // Placeholder for now
  alert(`Viewing details for dish: ${dishId}`);
}

// UC-05 A1: Handle registration attempt
function showRegistrationPrompt() {
  const message = "Register now to place orders, track deliveries, and enjoy VIP benefits!";
  const response = confirm(message + "\n\nClick OK to go to registration.");
  if (response) {
    window.location.href = "register.html";
  }
}

// UC-05: Search and filter menu
function filterMenu() {
  const searchBox = document.getElementById("search-box").value.toLowerCase();
  const categoryFilter = document.getElementById("category-filter").value;
  const cards = document.querySelectorAll(".menu-card");
  
  cards.forEach(card => {
    const name = card.querySelector("h3").textContent.toLowerCase();
    const desc = card.querySelector("p").textContent.toLowerCase();
    
    const matchesSearch = name.includes(searchBox) || desc.includes(searchBox);
    const matchesCategory = !categoryFilter || 
      (card.dataset.category && card.dataset.category === categoryFilter);
    
    card.style.display = (matchesSearch && matchesCategory) ? "block" : "none";
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // UC-05: Initialize menu links
  document.getElementById("menu-link").onclick = function(e) {
    e.preventDefault();
    loadVisitorMenu();
    document.getElementById("visitor-menu-section").scrollIntoView({ behavior: 'smooth' });
  };

  document.getElementById("chat-link").onclick = function(e) {
    e.preventDefault();
    window.location.href = "chat.html";
  };

  // Update cart link visibility based on login status
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  const cartLink = document.getElementById("cart-link");
  if (!isLoggedIn) {
    cartLink.onclick = function(e) {
      e.preventDefault();
      showRegistrationPrompt();
    };
  }

  // Add event listeners for search and filter
  const searchBox = document.getElementById("search-box");
  const categoryFilter = document.getElementById("category-filter");
  if (searchBox) searchBox.addEventListener("input", filterMenu);
  if (categoryFilter) categoryFilter.addEventListener("change", filterMenu);

  // Show visitor menu on page load for non-logged-in users
  if (!isLoggedIn) {
    loadVisitorMenu();
  }

  updateCartCount();
  updateAuthStatus();
  checkVIPAccess();
  loadOrderHistory();
  loadFeaturedDishes();
});
