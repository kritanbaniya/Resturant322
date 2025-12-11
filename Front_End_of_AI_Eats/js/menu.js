const API_URL = "http://127.0.0.1:5000";
let menuItems = {};
let menuLoaded = false;

let currentFilter = '';
let allDishes = [];

function filterMenu() {
  const searchTerm = document.getElementById("search-menu").value.toLowerCase();
  const menuGrid = document.getElementById("menu-grid");
  menuGrid.innerHTML = "";
  
  const filtered = allDishes.filter(dish => {
    const matchesSearch = dish.name.toLowerCase().includes(searchTerm) || 
                         dish.description.toLowerCase().includes(searchTerm);
    const matchesCategory = !currentFilter || dish.category === currentFilter;
    return matchesSearch && matchesCategory;
  });
  
  if (filtered.length === 0) {
    menuGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">No dishes found matching your search.</p>';
    return;
  }
  
  filtered.forEach(dish => {
    const imageUrl = dish.image_url || 'images/default.jpeg';
    const rating = dish.average_rating || 0;
    const ratingCount = dish.rating_count || 0;
    const stars = generateStars(rating);
    
    const menuCard = document.createElement("div");
    menuCard.className = "menu-card";
    menuCard.innerHTML = `
      <img src="${imageUrl}" alt="${dish.name}" onerror="this.src='images/default.jpeg'">
      <h3>${dish.name}</h3>
      <p>${dish.description || 'No description available'}</p>
      <div class="dish-rating">
        <span class="stars">${stars}</span>
        <span class="rating-text">${rating.toFixed(1)} (${ratingCount} review${ratingCount !== 1 ? 's' : ''})</span>
      </div>
      <span class="price">$${dish.price.toFixed(2)}</span>
      <button class="add-to-cart" onclick="addToCart('${dish.name}')">Add to Cart</button>
    `;
    menuGrid.appendChild(menuCard);
  });
}

function filterByCategory(category) {
  currentFilter = category;
  
  // Update active button
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.classList.remove("active");
    if (btn.getAttribute('data-category') === category) {
      btn.classList.add("active");
    }
  });
  
  filterMenu();
}

async function loadMenu() {
  const menuGrid = document.getElementById("menu-grid");
  menuGrid.innerHTML = "<p style='text-align: center; padding: 20px;'>Loading menu...</p>";
  
  try {
    const response = await fetch(`${API_URL}/api/menu/`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const dishes = await response.json();
    
    console.log("API returned dishes:", dishes);
    
    menuGrid.innerHTML = "";
    
    // ensure dishes is an array
    if (!Array.isArray(dishes)) {
      throw new Error("Invalid response format from API");
    }
    
    // filter out unavailable dishes (shouldn't happen if backend filters, but double-check)
    const availableDishes = dishes.filter(dish => dish.is_available !== false);
    
    if (availableDishes.length === 0) {
      menuGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">No dishes available at the moment. Please check back later!</p>';
      allDishes = [];
      menuLoaded = true;
      return;
    }
    
    allDishes = availableDishes; // store for filtering
    
    // clear menuItems object and populate with dish data for cart
    menuItems = {};
    availableDishes.forEach(dish => {
      const imageUrl = dish.image_url || 'images/default.jpeg';
      const rating = dish.average_rating || 0;
      const ratingCount = dish.rating_count || 0;
      
      // store dish info for cart
      menuItems[dish.name] = {
        id: dish.id || dish._id,
        name: dish.name,
        price: dish.price,
        description: dish.description || '',
        image: imageUrl,
        vipOnly: false, // vip-only dishes are handled differently now
        rating: rating,
        ratingCount: ratingCount,
        category: dish.category || 'Other'
      };
    });
    
    console.log("Menu loaded with", availableDishes.length, "dishes from database");
    menuLoaded = true;
    
    // display dishes using filterMenu
    filterMenu();
  } catch (error) {
    console.error("Error loading menu:", error);
    menuGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #d32f2f;">Error loading menu. Please refresh the page or contact support.</p>';
    allDishes = [];
    menuLoaded = false;
  }
}

function generateStars(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  let stars = "⭐".repeat(fullStars);
  if (hasHalfStar && fullStars < 5) stars += "☆";
  return stars;
}

function addToCart(itemName) {
  const item = menuItems[itemName];
  
  if (!item) {
    alert("Item not found. Please refresh the page.");
    return;
  }
  
  // require item.id - all items should have database ID now
  if (!item.id) {
    console.error("Item missing ID:", item);
    alert("Error: Item data incomplete. Please refresh the page.");
    return;
  }
  
  const isVIP = localStorage.getItem("isVIP") === "true";
  
  if (item.vipOnly && !isVIP) {
    alert("This item is exclusive to VIP members!\n\nUpgrade to VIP membership to access premium dishes.");
    return;
  }
  
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  
  // find existing item by name or id
  const existingItem = cart.find(cartItem => 
    cartItem.name === itemName || cartItem.id === item.id
  );
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      description: item.description,
      image: item.image,
      quantity: 1
    });
  }
  
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  
  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = 'Added!';
  btn.style.backgroundColor = '#4CAF50';
  
  setTimeout(() => {
    btn.textContent = originalText;
    btn.style.backgroundColor = '';
  }, 1000);
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

function checkVIPMenuAccess() {
  // vip menu section removed, function kept for compatibility but does nothing
}

document.addEventListener('DOMContentLoaded', async function() {
  // Setup search input
  document.getElementById('search-menu').addEventListener('keyup', filterMenu);
  
  // Setup filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const category = this.getAttribute('data-category') || '';
      filterByCategory(category);
    });
  });
  
  updateCartCount();
  updateAuthStatus();
  checkVIPMenuAccess();
  await loadMenu();
});
