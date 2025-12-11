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

let editingDishId = null;

async function loadChefMenu() {
  try {
    const response = await fetch(`${API_URL}/api/chef/menu`, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    });

    if (response.ok) {
      const dishes = await response.json();
      const container = document.getElementById('chefMenuList');

      if (dishes && dishes.length > 0) {
        container.innerHTML = dishes.map(dish => `
          <div class="menu-item">
            <div class="menu-item-info">
              <div class="menu-item-name">${dish.name}</div>
              <div class="menu-item-details">${dish.description || 'No description'}</div>
              <div class="menu-item-details">Category: ${dish.category} | Orders: ${dish.order_count} | Rating: ${dish.average_rating.toFixed(1)} (${dish.rating_count} reviews)</div>
              ${dish.tags && dish.tags.length > 0 ? `<div class="menu-item-details">Tags: ${dish.tags.join(', ')}</div>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
              <div class="menu-item-price">$${dish.price.toFixed(2)}</div>
              <div class="menu-item-actions">
                <button class="btn-action btn-start" onclick="editDish('${dish.id}')">Edit</button>
                <button class="btn-action btn-hold" onclick="deleteDish('${dish.id}', '${dish.name}')">Delete</button>
              </div>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = '<p>You haven\'t created any dishes yet. Click "Add New Dish" to get started!</p>';
      }
    } else {
      console.error('Failed to load menu');
      document.getElementById('chefMenuList').innerHTML = '<p>Error loading menu. Please refresh the page.</p>';
    }
  } catch (error) {
    console.error('Error loading chef menu:', error);
    document.getElementById('chefMenuList').innerHTML = '<p>Error loading menu. Please refresh the page.</p>';
  }
}

function showCreateDishForm() {
  editingDishId = null;
  document.getElementById('modalTitle').textContent = 'Create New Dish';
  document.getElementById('dishForm').reset();
  document.getElementById('dishAvailable').checked = true;
  document.getElementById('dishModal').style.display = 'block';
}

function editDish(dishId) {
  editingDishId = dishId;
  document.getElementById('modalTitle').textContent = 'Edit Dish';
  
  // fetch dish details
  fetch(`${API_URL}/api/menu/${dishId}`, {
    headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
  })
    .then(res => res.json())
    .then(dish => {
      document.getElementById('dishName').value = dish.name || '';
      document.getElementById('dishDescription').value = dish.description || '';
      document.getElementById('dishCategory').value = dish.category || '';
      document.getElementById('dishPrice').value = dish.price || '';
      document.getElementById('dishImageUrl').value = dish.image_url || '';
      document.getElementById('dishTags').value = dish.tags ? dish.tags.join(', ') : '';
      document.getElementById('dishAvailable').checked = dish.is_available !== false;
      document.getElementById('dishModal').style.display = 'block';
    })
    .catch(error => {
      console.error('Error loading dish:', error);
      showMessage('Error loading dish details', false);
    });
}

function closeDishModal() {
  document.getElementById('dishModal').style.display = 'none';
  editingDishId = null;
  document.getElementById('dishForm').reset();
}

async function saveDish(event) {
  event.preventDefault();
  
  const dishData = {
    name: document.getElementById('dishName').value.trim(),
    description: document.getElementById('dishDescription').value.trim(),
    category: document.getElementById('dishCategory').value.trim(),
    price: parseFloat(document.getElementById('dishPrice').value),
    image_url: document.getElementById('dishImageUrl').value.trim(),
    tags: document.getElementById('dishTags').value.split(',').map(t => t.trim()).filter(t => t),
    is_available: document.getElementById('dishAvailable').checked
  };
  
  if (!dishData.name || !dishData.category || !dishData.price) {
    showMessage('Please fill in all required fields', false);
    return;
  }
  
  try {
    const url = editingDishId 
      ? `${API_URL}/api/chef/menu/${editingDishId}`
      : `${API_URL}/api/chef/menu/create`;
    
    const method = editingDishId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify(dishData)
    });
    
    let data;
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      showMessage(`Server error: ${response.status} ${response.statusText}`, false);
      return;
    }
    
    if (response.ok) {
      showMessage(data.message || (editingDishId ? 'Dish updated successfully' : 'Dish created successfully'), true);
      closeDishModal();
      loadChefMenu();
    } else {
      const errorMsg = data.error || data.details || `Failed to save dish (${response.status})`;
      console.error('Error saving dish:', errorMsg, data);
      showMessage(errorMsg, false);
    }
  } catch (error) {
    console.error('Error saving dish:', error);
    showMessage(`Network error: ${error.message}`, false);
  }
}

async function deleteDish(dishId, dishName) {
  if (!confirm(`Are you sure you want to delete "${dishName}"? This action cannot be undone.`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/api/chef/menu/${dishId}`, {
      method: 'DELETE',
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      showMessage(data.message || 'Dish deleted successfully', true);
      loadChefMenu();
    } else {
      showMessage(data.error || 'Failed to delete dish', false);
    }
  } catch (error) {
    console.error('Error deleting dish:', error);
    showMessage('Error deleting dish', false);
  }
}

// close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById('dishModal');
  if (event.target === modal) {
    closeDishModal();
  }
}

document.addEventListener('DOMContentLoaded', function() {
  loadOrderQueue();
  loadChefMenu();
  setInterval(loadOrderQueue, 5000);
});
