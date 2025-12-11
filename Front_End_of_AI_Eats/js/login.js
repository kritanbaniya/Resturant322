const API_URL = "http://127.0.0.1:5000";

async function login(event) {
  event.preventDefault();
  
  const loginEmail = document.getElementById("loginUser").value;
  const loginPass = document.getElementById("loginPass").value;
  const messageEl = document.getElementById("loginMessage");

  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: loginEmail,
        password: loginPass
      })
    });

    const data = await response.json();

    if (response.ok) {
      messageEl.textContent = "Login successful! Redirecting...";
      messageEl.className = "message success";
      
      if (data.token) {
        localStorage.setItem("token", data.token);
      }
      if (data.user_id) {
        localStorage.setItem("userId", data.user_id);
      }
      if (data.role) {
        localStorage.setItem("userRole", data.role);
      }
      if (data.isVIP) {
        localStorage.setItem("isVIP", "true");
      }
      localStorage.setItem("username", loginEmail);
      localStorage.setItem("email", loginEmail);
      localStorage.setItem("isLoggedIn", "true");
      
      const userRole = data.role || "Customer";
      const isVIP = data.isVIP || false;
      
      const redirectMap = {
        "Manager": "manager-dashboard.html",
        "Chef": "chef-dashboard.html",
        "DeliveryPerson": "delivery-dashboard.html",
        "VIP": "vip-dashboard.html",
        "Customer": "index.html"
      };
      
      let redirectUrl = isVIP ? "vip-dashboard.html" : (redirectMap[userRole] || "index.html");
      
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1500);
    } else {
      messageEl.textContent = data.error || "Invalid email or password.";
      messageEl.className = "message error";
    }
  } catch (error) {
    messageEl.textContent = "Error connecting to server. Make sure backend is running.";
    messageEl.className = "message error";
    console.error("Login error:", error);
  }
}

function updateCartCount() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById("cart-count").textContent = totalItems;
}

document.addEventListener('DOMContentLoaded', function() {
  updateCartCount();
});
