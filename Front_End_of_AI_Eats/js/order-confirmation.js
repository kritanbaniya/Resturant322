const API_URL = "http://127.0.0.1:5000";

function loadOrderConfirmation() {
  const orderData = JSON.parse(localStorage.getItem("lastOrder"));
  
  if (!orderData) {
    window.location.href = "index.html";
    return;
  }
  
  document.getElementById("order-id").textContent = orderData.orderId;
  document.getElementById("order-total").textContent = orderData.total;
  
  const deliveryTime = new Date();
  deliveryTime.setMinutes(deliveryTime.getMinutes() + 35);
  document.getElementById("delivery-time").textContent = deliveryTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  
  const itemsContainer = document.getElementById("confirmation-items");
  orderData.items.forEach(item => {
    itemsContainer.innerHTML += `
      <div class="item-row">
        <div class="item-details">
          <span class="item-name">${item.name}</span>
          <span class="item-qty">Qty: ${item.quantity}</span>
        </div>
        <span class="item-price">$${(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `;
  });
  
  localStorage.removeItem("lastOrder");
}

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
    const vipIcon = isVIP ? "[VIP] " : "";
    authLink.textContent = `[USER] ${vipIcon}${username}`;
    authLink.href = "profile.html";
  } else {
    authLink.textContent = "Login/Register";
    authLink.href = "login.html";
  }
}

loadOrderConfirmation();
updateCartCount();
updateAuthStatus();
