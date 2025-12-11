const API_URL = "http://127.0.0.1:5000";
const deliveryPersonId = localStorage.getItem("userId");
const userRole = localStorage.getItem("userRole");
const token = localStorage.getItem("token");

if (!userRole || (!userRole.includes("DeliveryPerson"))) {
  alert("Access Denied: This dashboard is for Delivery Personnel only.");
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

  if (tabName === 'available') loadAvailableOrders();
  if (tabName === 'assignments') loadAssignedDeliveries();
  if (tabName === 'history') loadDeliveryHistory();
  if (tabName === 'performance') loadPerformanceEvaluation();
}

// Load available orders for bidding
async function loadAvailableOrders() {
  try {
    const response = await fetch(`${API_URL}/api/delivery/available`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const container = document.getElementById('availableOrdersList');

      if (data.orders && data.orders.length > 0) {
        container.innerHTML = data.orders.map(order => {
          const itemsList = order.items.map(item => `${item.quantity}x ${item.name}`).join(', ');
          
          return `
            <div class="delivery-item">
              <div class="delivery-header">
                <div class="order-info">Order #${order.order_id.slice(-6)}</div>
                ${order.has_bid ? '<div class="delivery-status status-assigned">Bid Submitted</div>' : ''}
              </div>
              <div class="delivery-details">
                <div class="detail-row"><strong>Customer:</strong> ${order.customer_name}</div>
                <div class="detail-row"><strong>Address:</strong> ${order.customer_address}</div>
                <div class="detail-row"><strong>Items:</strong> ${itemsList}</div>
                <div class="detail-row"><strong>Order Total:</strong> $${order.final_price.toFixed(2)}</div>
              </div>
              ${!order.has_bid ? `
                <div class="delivery-actions">
                  <input type="number" id="bidAmount_${order.order_id}" placeholder="Bid amount ($)" 
                         min="0" step="0.01" style="padding: 8px; margin-right: 8px; width: 150px; border: 1px solid #ddd; border-radius: 4px;">
                  <button class="btn-small btn-bid" onclick="submitBid('${order.order_id}')">Submit Bid</button>
                </div>
              ` : `
                <div class="delivery-actions">
                  <p style="color: #4dabf7; font-weight: bold; margin: 0;">Your bid is pending manager review</p>
                </div>
              `}
            </div>
          `;
        }).join('');

        document.getElementById('statAvailable').textContent = data.orders.length;
      } else {
        container.innerHTML = '<p>No orders available for delivery at this moment</p>';
        document.getElementById('statAvailable').textContent = '0';
      }
    } else {
      showMessage('Error loading available orders', false);
    }
  } catch (error) {
    console.error('Error loading available orders:', error);
    showMessage('Error loading available orders', false);
  }
}

// Submit bid for an order
async function submitBid(orderId) {
  const bidAmountInput = document.getElementById(`bidAmount_${orderId}`);
  const bidAmount = parseFloat(bidAmountInput.value);

  if (!bidAmount || bidAmount <= 0) {
    alert('Please enter a valid bid amount');
    return;
  }

  if (!confirm(`Submit bid of $${bidAmount.toFixed(2)} for this order?`)) return;

  try {
    const response = await fetch(`${API_URL}/api/delivery/bid`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        order_id: orderId,
        amount: bidAmount
      })
    });

    const data = await response.json();
    showMessage(data.message || 'Bid submitted successfully!', response.ok);
    if (response.ok) {
      loadAvailableOrders();
    }
  } catch (error) {
    console.error('Error submitting bid:', error);
    showMessage('Error submitting bid', false);
  }
}

// UC-03 Step 1: Load assigned deliveries
async function loadAssignedDeliveries() {
  try {
    const response = await fetch(`${API_URL}/api/delivery/assignments/${deliveryPersonId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const container = document.getElementById('assignmentsList');

      if (data.deliveries && data.deliveries.length > 0) {
        container.innerHTML = data.deliveries.map(delivery => {
          const status = delivery.status;
          const statusClass = getStatusClass(status);
          const statusText = getStatusText(status);

          return `
            <div class="delivery-item">
              <div class="delivery-header">
                <div class="order-info">Order #${delivery.order_id.slice(-6)}</div>
                <div class="delivery-status ${statusClass}">${statusText}</div>
              </div>
              <div class="delivery-details">
                <div class="detail-row"><strong>Customer:</strong> ${delivery.customer_name}</div>
                <div class="detail-row"><strong>Phone:</strong> ${delivery.customer_phone}</div>
                <div class="detail-row"><strong>Address:</strong> ${delivery.customer_address}</div>
                <div class="detail-row"><strong>Items:</strong> ${delivery.items.join(', ')}</div>
                <div class="detail-row"><strong>Bid Amount:</strong> $${delivery.bid_amount.toFixed(2)}</div>
              </div>
              <div class="delivery-actions">
                ${status === 'Assigned' ? `
                  <button class="btn-small btn-update" onclick="confirmPickup('${delivery.delivery_id}')">Confirm Pickup (Step 2)</button>
                ` : ''}
                ${status === 'Out_For_Delivery' ? `
                  <button class="btn-small btn-update" onclick="showDeliveryModal('${delivery.delivery_id}')">View Details</button>
                  <button class="btn-small btn-bid" onclick="markDelivered('${delivery.delivery_id}')">Mark Delivered (Step 6)</button>
                  <button class="btn-small" style="background-color: #ff6b6b; color: white;" onclick="markFailed('${delivery.delivery_id}')">Mark Failed (A1)</button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');

        document.getElementById('statAssigned').textContent = data.deliveries.filter(d => d.status === 'Assigned').length;
        // load completed today count separately
        loadCompletedTodayCount();
      } else {
        container.innerHTML = '<p>No assigned deliveries at this moment</p>';
        document.getElementById('statAssigned').textContent = '0';
        // still load completed count even if no assigned deliveries
        loadCompletedTodayCount();
      }
    } else {
      showMessage('Error loading deliveries', false);
    }
  } catch (error) {
    console.error('Error loading assignments:', error);
    showMessage('Error loading deliveries', false);
  }
}

// UC-03 Step 2: Confirm pickup
async function confirmPickup(deliveryId) {
  if (!confirm('Confirm that you have picked up the order from the restaurant?')) return;

  try {
    const response = await fetch(`${API_URL}/api/delivery/pickup/${deliveryId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await response.json();
    showMessage(data.message || 'Pickup confirmed!', response.ok);
    if (response.ok) loadAssignedDeliveries();
  } catch (error) {
    console.error('Error confirming pickup:', error);
    showMessage('Error confirming pickup', false);
  }
}

// Show delivery details modal
async function showDeliveryModal(deliveryId) {
  try {
    const response = await fetch(`${API_URL}/api/delivery/${deliveryId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const itemsList = data.items.map(item => 
        `${item.dish_name} x${item.quantity} - $${item.price.toFixed(2)}`
      ).join('\n');

      alert(`Order #${data.order_id.slice(-6)}
          
Customer: ${data.customer_name}
Phone: ${data.customer_phone}
Address: ${data.customer_address}
Notes: ${data.customer_notes || 'None'}

Items:
${itemsList}

Total: $${data.final_price.toFixed(2)}`);
    }
  } catch (error) {
    console.error('Error loading details:', error);
    showMessage('Error loading delivery details', false);
  }
}

// Load completed deliveries count for today
async function loadCompletedTodayCount() {
  try {
    const response = await fetch(`${API_URL}/api/delivery/completed-today`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      document.getElementById('statCompleted').textContent = data.count || 0;
    } else {
      console.error('Error loading completed today count');
      document.getElementById('statCompleted').textContent = '0';
    }
  } catch (error) {
    console.error('Error loading completed today count:', error);
    document.getElementById('statCompleted').textContent = '0';
  }
}

// UC-03 Step 6: Mark delivery as completed
async function markDelivered(deliveryId) {
  if (!confirm('Confirm that the customer has received the order?')) return;

  try {
    const response = await fetch(`${API_URL}/api/delivery/confirm/${deliveryId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await response.json();
    showMessage(data.message || 'Delivery marked as completed!', response.ok);
    if (response.ok) {
      loadAssignedDeliveries();
      loadCompletedTodayCount(); // update completed count
      setTimeout(() => loadDeliveryHistory(), 500);
    }
  } catch (error) {
    console.error('Error marking delivered:', error);
    showMessage('Error completing delivery', false);
  }
}

// UC-03 A1: Mark delivery as failed
async function markFailed(deliveryId) {
  const reason = prompt("Why did delivery fail?");
  if (!reason) return;

  try {
    const response = await fetch(`${API_URL}/api/delivery/failed/${deliveryId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ reason })
    });

    const data = await response.json();
    showMessage(data.message || 'Delivery marked as failed. Manager will be notified.', response.ok);
    if (response.ok) loadAssignedDeliveries();
  } catch (error) {
    console.error('Error marking failed:', error);
    showMessage('Error marking delivery as failed', false);
  }
}

// Load delivery history
async function loadDeliveryHistory() {
  try {
    const response = await fetch(`${API_URL}/api/delivery/history/${deliveryPersonId}?limit=30`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const container = document.getElementById('historyList');

      if (data.deliveries && data.deliveries.length > 0) {
        container.innerHTML = data.deliveries.map(delivery => {
          const status = delivery.status;
          const statusClass = getStatusClass(status);
          const statusText = getStatusText(status);

          return `
            <div class="delivery-item">
              <div class="delivery-header">
                <div class="order-info">Order #${delivery.order_id.slice(-6)}</div>
                <div class="delivery-status ${statusClass}">${statusText}</div>
              </div>
              <div class="delivery-details">
                <div class="detail-row"><strong>Customer:</strong> ${delivery.customer_name}</div>
                <div class="detail-row"><strong>Bid Amount:</strong> $${delivery.bid_amount.toFixed(2)}</div>
                <div class="detail-row"><strong>Completed:</strong> ${new Date(delivery.completed_at).toLocaleDateString()}</div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        container.innerHTML = '<p>No delivery history yet</p>';
      }
    }
  } catch (error) {
    console.error('Error loading history:', error);
    showMessage('Error loading history', false);
  }
}

// UC-03 A3: Load performance evaluation
async function loadPerformanceEvaluation() {
  try {
    const response = await fetch(`${API_URL}/api/delivery/performance/${deliveryPersonId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const container = document.getElementById('performanceStats');

      let html = `
        <div class="stats-container">
          <div class="stat-box">
            <div class="stat-number">${data.avg_rating.toFixed(1)}</div>
            <div class="stat-label">Average Rating</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${data.complaint_count}</div>
            <div class="stat-label">Complaints</div>
          </div>
          <div class="stat-box">
            <div class="stat-number">${data.compliment_count}</div>
            <div class="stat-label">Compliments</div>
          </div>
        </div>
      `;

      if (data.action === 'demoted') {
        html += `
          <div class="message error">
            <strong>DEMOTION WARNING!</strong><br>
            Your performance rating (${data.avg_rating}/5 or ${data.net_complaints} net complaints) has resulted in demotion.
            ${data.message}
          </div>
        `;
      } else if (data.action === 'terminated') {
        html += `
          <div class="message error">
            <strong>ACCOUNT TERMINATED</strong><br>
            Multiple demotions have resulted in account termination. ${data.message}
          </div>
        `;
      } else if (data.action === 'bonus') {
        html += `
          <div class="message success">
            <strong>PERFORMANCE BONUS ELIGIBLE!</strong><br>
            ${data.message}
          </div>
        `;
      } else {
        html += `
          <div class="message success">
            Your performance is being tracked. Maintain high ratings for bonuses!<br>
            Net complaints: ${data.net_complaints}
          </div>
        `;
      }

      container.innerHTML = html;
    }
  } catch (error) {
    console.error('Error loading performance:', error);
    showMessage('Error loading performance data', false);
  }
}

function getStatusClass(status) {
  const classes = {
    'Assigned': 'status-assigned',
    'Out_For_Delivery': 'status-in-transit',
    'Delivered': 'status-delivered',
    'Delivery_Failed': 'status-pending'
  };
  return classes[status] || 'status-pending';
}

function getStatusText(status) {
  const texts = {
    'Assigned': 'Assigned to You',
    'Out_For_Delivery': 'Out for Delivery',
    'Delivered': 'Delivered',
    'Delivery_Failed': 'Failed'
  };
  return texts[status] || status;
}

function showMessage(message, isSuccess) {
  const el = document.getElementById('message');
  el.textContent = message;
  el.className = `message ${isSuccess ? 'success' : 'error'}`;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
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

  loadAvailableOrders();
  loadAssignedDeliveries();
  loadCompletedTodayCount(); // load completed count on page load
});
