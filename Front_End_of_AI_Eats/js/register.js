const API_URL = "http://127.0.0.1:5000";

async function register(event) {
  event.preventDefault();
  
  const user = document.getElementById("regUser").value;
  const email = document.getElementById("regEmail").value;
  const pass = document.getElementById("regPass").value;
  const confirmPass = document.getElementById("regConfirmPass").value;
  const messageEl = document.getElementById("registerMessage");

  if (pass !== confirmPass) {
    messageEl.textContent = "Passwords do not match.";
    messageEl.className = "message error";
    return;
  }

  if (pass.length < 6) {
    messageEl.textContent = "Password must be at least 6 characters.";
    messageEl.className = "message error";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: user,
        email: email,
        password: pass
      })
    });

    const data = await response.json();

    if (response.ok) {
      messageEl.textContent = data.message || "Account created successfully! Redirecting to login...";
      messageEl.className = "message success";

      if (data.user_id) {
        localStorage.setItem("userId", data.user_id);
      }
      localStorage.setItem("registeredEmail", email);

      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);
    } else {
      messageEl.textContent = data.error || "Registration failed. Please try again.";
      messageEl.className = "message error";
    }
  } catch (error) {
    messageEl.textContent = "Error connecting to server. Make sure backend is running.";
    messageEl.className = "message error";
    console.error("Registration error:", error);
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
