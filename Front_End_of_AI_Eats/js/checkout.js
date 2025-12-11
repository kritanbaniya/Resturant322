const API_URL = "http://127.0.0.1:5000";

function loadCheckoutSummary() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  let container = document.getElementById("checkout-items");
  
  if (cart.length === 0) {
    window.location.href = "cart.html";
    return;
  }
  
  container.innerHTML = "";
  let subtotal = 0;
  
  cart.forEach(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    
    container.innerHTML += `
      <div class="checkout-item">
        <img src="${item.image}" alt="${item.name}">
        <div class="item-info">
          <h4>${item.name}</h4>
          <span>Qty: ${item.quantity}</span>
        </div>
        <span class="item-price">$${itemTotal.toFixed(2)}</span>
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
  
  document.getElementById("checkout-subtotal").textContent = `$${finalSubtotal.toFixed(2)}`;
  if (isVIP && subtotal !== finalSubtotal) {
    document.getElementById("checkout-subtotal").innerHTML += ' <span class="vip-discount">(10% VIP discount applied)</span>';
  }
  
  const deliveryElement = document.querySelector('.summary-row:nth-child(2) span:last-child');
  deliveryElement.textContent = isVIP ? 'FREE (VIP)' : '$2.99';
  
  document.getElementById("checkout-tax").textContent = `$${tax.toFixed(2)}`;
  document.getElementById("checkout-total").textContent = `$${total.toFixed(2)}`;
  document.getElementById("order-total-check").textContent = `$${total.toFixed(2)}`;
  
  // Load and check balance
  checkBalance(total);
}

async function checkBalance(orderTotal) {
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
      const balance = userData.balance;
      
      document.getElementById("available-balance").textContent = `$${balance.toFixed(2)}`;
      const warningEl = document.getElementById("balance-warning");
      const placeOrderBtn = document.querySelector(".place-order-btn");
      
      // UC-01 Precondition: Must have positive balance
      if (balance <= 0) {
        warningEl.innerHTML = '<p style="color: #d32f2f; margin: 10px 0 0 0; padding: 10px; background: #ffebee; border-radius: 4px;">[WARNING] <strong>No Balance!</strong> You must deposit funds before ordering. Please visit your profile to deposit money.</p>';
        warningEl.style.display = "block";
        placeOrderBtn.disabled = true;
        placeOrderBtn.style.opacity = "0.5";
        placeOrderBtn.textContent = "Deposit Funds Required";
      } else if (balance < orderTotal) {
        // UC-01 A1: Insufficient funds warning
        warningEl.innerHTML = '<p style="color: #d32f2f; margin: 10px 0 0 0; padding: 10px; background: #ffebee; border-radius: 4px;">[WARNING] <strong>Insufficient Balance!</strong> Your balance is insufficient for this order. <strong>WARNING:</strong> Attempting to place this order will result in a warning on your account.</p>';
        warningEl.style.display = "block";
        placeOrderBtn.disabled = true;
        placeOrderBtn.style.opacity = "0.5";
        placeOrderBtn.textContent = "Insufficient Balance - Deposit Funds";
      } else {
        warningEl.style.display = "none";
        placeOrderBtn.disabled = false;
        placeOrderBtn.style.opacity = "1";
        placeOrderBtn.textContent = "Place Order";
      }
    }
  } catch (error) {
    console.error("Error checking balance:", error);
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

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById("checkout-form").addEventListener("submit", async function(e) {
    e.preventDefault();
    
    const submitBtn = document.querySelector(".place-order-btn");
    submitBtn.textContent = "Processing...";
    submitBtn.disabled = true;
    
    try {
      const userId = localStorage.getItem("userId");
      const cart = JSON.parse(localStorage.getItem("cart")) || [];
      
      const items = cart.map(item => ({
        dish_id: item.id,
        quantity: item.quantity
      }));
      
      console.log("Cart items to send:", JSON.stringify(cart, null, 2));
      console.log("Formatted items for API:", JSON.stringify(items, null, 2));
      console.log("User ID:", userId);
      
      const token = localStorage.getItem("token");
      const requestBody = {
        items: items
      };
      
      console.log("Full request body:", JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(`${API_URL}/api/orders/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const orderId = data.order_id;
        
        // UC-01 A2: Check for VIP upgrade
        if (data.vip_upgraded) {
          localStorage.setItem("isVIP", "true");
          alert("[CONGRATS] Congratulations! You've been upgraded to VIP status!\n\nEnjoy 10% discounts and free delivery on all future orders!");
        }
        
        // Update balance in localStorage if provided
        if (data.new_balance !== undefined) {
          localStorage.setItem("balance", data.new_balance);
        }
        
        const orderData = {
          orderId: orderId,
          username: localStorage.getItem("username"),
          items: cart,
          total: document.getElementById("checkout-total").textContent,
          customerInfo: {
            name: document.getElementById("full-name").value,
            phone: document.getElementById("phone").value,
            address: document.getElementById("address").value
          },
          orderDate: new Date().toISOString(),
          status: "confirmed"
        };
        
        let orders = JSON.parse(localStorage.getItem("orders")) || [];
        orders.push(orderData);
        localStorage.setItem("orders", JSON.stringify(orders));
        
        localStorage.removeItem("cart");
        
        localStorage.setItem("lastOrder", JSON.stringify(orderData));
        window.location.href = "order-confirmation.html";
      } else {
        const errorMsg = data.error || data.details || "Unknown error";
        const submitBtn = document.querySelector(".place-order-btn");
        
        // UC-01 Preconditions: Check for balance/login errors
        if (errorMsg.includes("Insufficient funds") || errorMsg.includes("Insufficient")) {
          alert("[ERROR] ORDER REJECTED - INSUFFICIENT FUNDS\n\n" +
                "Required: $" + (data.required || "N/A") + "\n" +
                "Your Balance: $" + (data.balance || "N/A") + "\n\n" +
                "[WARNING] WARNING APPLIED: You have received a warning for attempting to place an order without sufficient funds.\n\n" +
                "Please deposit more funds in your profile before trying again.\n\n" +
                "Note: 3 warnings will result in account deregistration (VIPs: 2 warnings = VIP status loss).");
        } else if (errorMsg.includes("positive balance")) {
          alert("[ERROR] NO BALANCE\n\nYou must deposit funds before placing an order.\n\nPlease visit your profile to deposit money.");
          submitBtn.textContent = "Deposit Funds Required";
          submitBtn.disabled = true;
        } else if (errorMsg.includes("Customer or VIP")) {
          alert("[ERROR] UNAUTHORIZED\n\nOnly customers can place orders. Please log in with a customer account.");
        } else if (errorMsg.includes("not active")) {
          alert("[ERROR] ACCOUNT INACTIVE\n\nYour account is not active. Please contact support.");
        } else {
          alert("Error creating order: " + errorMsg);
        }
        
        console.error("Order error full response:", JSON.stringify(data, null, 2));
        submitBtn.textContent = "Place Order";
        submitBtn.disabled = false;
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error connecting to server. Please try again.");
      submitBtn.textContent = "Place Order";
      submitBtn.disabled = false;
    }
  });

  loadCheckoutSummary();
  updateCartCount();
  updateAuthStatus();
});
