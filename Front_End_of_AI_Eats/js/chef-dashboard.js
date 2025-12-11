const API_URL = "http://127.0.0.1:5000";
const chefId = localStorage.getItem("userId");
const userRole = localStorage.getItem("userRole");

if (userRole !== "Chef") {
  alert("Access Denied: This dashboard is for Chefs only.");
  window.location.href = "index.html";
}

async function loadOrderQueue() {
  try {
    const response = await fetch(`${API_URL}/api/chef/queue`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });

    if (response.ok) {
      const data = await response.json();
      const container = document.getElementById('ordersQueue');

      if (data && data.length > 0) {
        let stats = { pending: 0, preparing: 0, ready: 0, held: 0 };

        container.innerHTML = data.map(order => {
          const status = order.status || 'pending';
          if (status === 'pending') stats.pending++;
          if (status === 'preparing') stats.preparing++;
          if (status === 'ready') stats.ready++;
          if (status === 'on_hold') stats.held++;

          const statusClass = {
            'pending': 'status-pending',
            'preparing': 'status-preparing',
            'ready': 'status-ready',
            'on_hold': 'status-held'
          }[status] || 'status-pending';

          const statusText = {
            'pending': 'Pending',
            'preparing': 'Preparing',
            'ready': 'Ready',
            'on_hold': 'On Hold'
          }[status] || 'Pending';

          return `
            <div class="order-card">
              <div class="order-header">
                <div class="order-id">Order #${order._id.slice(-6)}</div>
                <div class="order-status ${statusClass}">${statusText}</div>
              </div>
              <div class="order-time">Customer: ${order.customer_name || 'Unknown'}</div>
              <div class="order-items">
                ${order.items.map((item, i) => `
                  <div class="item-line">
                    <span class="item-quantity">${item.quantity}x</span> ${item.name} ${item.special_requests ? '- ' + item.special_requests : ''}
                  </div>
                `).join('')}
              </div>
              ${order.notes ? `<div class="order-notes"><strong>Notes:</strong> ${order.notes}</div>` : ''}
              <div class="order-actions">
                ${status === 'pending' ? `<button class="btn-action btn-start" onclick="startPrep('${order._id}')">Start Prep</button>` : ''}
                ${status === 'preparing' ? `<button class="btn-action btn-complete" onclick="completePrep('${order._id}')">Mark Ready</button>` : ''}
                ${status !== 'ready' ? `<button class="btn-action btn-hold" onclick="holdOrder('${order._id}')">On Hold</button>` : ''}
              </div>
            </div>
          `;
        }).join('');

        document.getElementById('statPending').textContent = stats.pending;
        document.getElementById('statPreparing').textContent = stats.preparing;
        document.getElementById('statReady').textContent = stats.ready;
        document.getElementById('statHeld').textContent = stats.held;
      } else {
        container.innerHTML = '<p>No orders in queue</p>';
      }
    }
  } catch (error) {
    console.error('Error loading orders:', error);
  }
}

async function startPrep(orderId) {
  try {
    const response = await fetch(`${API_URL}/api/chef/start/${orderId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({})
    });

    const data = await response.json();
    showMessage(data.message || 'Order preparation started', response.ok);
    if (response.ok) loadOrderQueue();
  } catch (error) {
    console.error('Error starting prep:', error);
    showMessage('Error starting preparation', false);
  }
}

async function completePrep(orderId) {
  try {
    const response = await fetch(`${API_URL}/api/chef/complete/${orderId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({})
    });

    const data = await response.json();
    showMessage(data.message || 'Order marked as ready', response.ok);
    if (response.ok) loadOrderQueue();
  } catch (error) {
    console.error('Error completing prep:', error);
    showMessage('Error marking order ready', false);
  }
}

async function holdOrder(orderId) {
  const note = prompt("Enter reason for hold:");
  if (!note) return;

  try {
    const response = await fetch(`${API_URL}/api/chef/hold/${orderId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({ note: note })
    });

    const data = await response.json();
    showMessage(data.message || 'Order put on hold', response.ok);
    if (response.ok) loadOrderQueue();
  } catch (error) {
    console.error('Error holding order:', error);
    showMessage('Error putting order on hold', false);
  }
}

function showMessage(message, isSuccess) {
  const el = document.getElementById('message');
  el.textContent = message;
  el.className = `message ${isSuccess ? 'success' : 'error'}`;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3000);
}

function logout() {
  localStorage.clear();
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', function() {
  loadOrderQueue();
  setInterval(loadOrderQueue, 5000);
});
