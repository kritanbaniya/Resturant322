const API_URL = "http://127.0.0.1:5000";

function loadCart() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  let container = document.getElementById("cart-items");
  let emptyCart = document.getElementById("empty-cart");
  let cartSummary = document.getElementById("cart-summary");
  
  container.innerHTML = "";
  
  if (cart.length === 0) {
    emptyCart.style.display = "block";
    cartSummary.style.display = "none";
    return;
  }
  
  emptyCart.style.display = "none";
  cartSummary.style.display = "block";
  
  let subtotal = 0;
  
  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    
    const imageSrc = item.image || 'images/default.jpeg';
    container.innerHTML += `
      <div class="cart-item">
        <img src="${imageSrc}" alt="${item.name}" class="cart-item-image">
        <div class="cart-item-details">
          <h4>${item.name}</h4>
          <p>${item.description}</p>
          <span class="item-price">$${item.price.toFixed(2)}</span>
        </div>
        <div class="cart-item-controls">
          <div class="quantity-controls">
            <button onclick="updateQuantity(${index}, -1)">-</button>
            <span class="quantity">${item.quantity}</span>
            <button onclick="updateQuantity(${index}, 1)">+</button>
          </div>
          <button class="remove-btn" onclick="removeItem(${index})">🗑️</button>
        </div>
        <div class="item-total">$${itemTotal.toFixed(2)}</div>
      </div>
    `;
  });
  
  const isVIP = localStorage.getItem("isVIP") === "true";
  let finalSubtotal = subtotal;
  
  if (isVIP) {
    finalSubtotal = subtotal * 0.9;
  }
  
  const deliveryFee = isVIP ? 0 : 2.99;
  const tax = finalSubtotal * 0.08;
  const total = finalSubtotal + deliveryFee + tax;
  
  document.getElementById("subtotal").textContent = `$${finalSubtotal.toFixed(2)}`;
  if (isVIP && subtotal !== finalSubtotal) {
    document.getElementById("subtotal").innerHTML += ' <span class="vip-discount">(10% VIP discount)</span>';
  }
  
  const deliveryElement = document.querySelector('.summary-row:nth-child(2) span:last-child');
  deliveryElement.textContent = isVIP ? 'FREE (VIP)' : '$2.99';
  
  document.getElementById("tax").textContent = `$${tax.toFixed(2)}`;
  document.getElementById("total").textContent = `$${total.toFixed(2)}`;
  
  updateCartCount();
}

function updateQuantity(index, change) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart[index].quantity += change;
  
  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  }
  
  localStorage.setItem("cart", JSON.stringify(cart));
  loadCart();
}

function removeItem(index) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  loadCart();
}

function clearCart() {
  if (confirm("Are you sure you want to clear your cart?")) {
    localStorage.removeItem("cart");
    loadCart();
  }
}

function checkout() {
  window.location.href = "checkout.html";
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

// initialize on page load
loadCart();
updateAuthStatus();
