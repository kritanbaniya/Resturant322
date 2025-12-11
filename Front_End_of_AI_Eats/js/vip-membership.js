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

document.addEventListener('DOMContentLoaded', function() {
  updateCartCount();
  updateAuthStatus();
});
