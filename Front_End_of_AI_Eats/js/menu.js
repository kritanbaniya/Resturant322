const API_URL = "http://127.0.0.1:5000";
let menuItems = {};
let menuLoaded = false;

const staticItems = [
  { name: "Salmon Sushi", price: 14.99, description: "Fresh salmon with perfectly seasoned rice.", image: "images/sushi.jpeg", vipOnly: false },
  { name: "Fettuccine Alfredo", price: 12.99, description: "Creamy pasta with parmesan cheese and herbs.", image: "images/pasta.jpeg", vipOnly: false },
  { name: "Spaghetti Bolognese", price: 12.99, description: "Classic Italian pasta with meat sauce.", image: "images/spaghetti_bolognese.jpeg", vipOnly: false },
  { name: "Grilled Chicken Salad", price: 10.99, description: "Fresh greens with chicken and dressing.", image: "images/salad.jpeg", vipOnly: false },
  { name: "Margherita Pizza", price: 14.99, description: "Tomatoes, mozzarella, and fresh basil.", image: "images/margherita_pizza.jpeg", vipOnly: false },
  { name: "Chicken Parmesan", price: 15.99, description: "Breaded chicken topped with marinara and cheese.", image: "images/chicken_parmesan.jpeg", vipOnly: false },
  { name: "Penne alla Vodka", price: 13.99, description: "Pasta in a creamy tomato-vodka sauce.", image: "images/penne_alla_vodka.jpeg", vipOnly: false },
  { name: "Chicken Wings", price: 11.99, description: "Spicy and crispy chicken wings with dipping sauce.", image: "images/chicken_wings.jpeg", vipOnly: false },
  { name: "Grilled Lobster", price: 35.99, description: "Succulent lobster grilled to perfection.", image: "images/lobster.jpeg", vipOnly: true },
  { name: "Ribeye Steak", price: 29.99, description: "Juicy ribeye steak, perfectly seared.", image: "images/ribeye.jpeg", vipOnly: true },
  { name: "Tomahawk Steak", price: 49.99, description: "Premium tomahawk cut with rich marbling.", image: "images/tomahawk.jpeg", vipOnly: true }
];

function seedStaticMenu() {
  staticItems.forEach(item => {
    menuItems[item.name] = {
      id: null,
      name: item.name,
      price: item.price,
      description: item.description,
      image: item.image,
      vipOnly: item.vipOnly,
      rating: 5,
      ratingCount: 0
    };
  });
}

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
    const stars = generateStars(dish.average_rating);
    const menuCard = document.createElement("div");
    menuCard.className = "menu-card";
    menuCard.innerHTML = `
      <img src="${dish.image_url || 'images/default.jpeg'}" alt="${dish.name}">
      <h3>${dish.name}</h3>
      <p>${dish.description}</p>
      <div class="dish-rating">
        <span class="stars">${stars}</span>
        <span class="rating-text">${dish.average_rating.toFixed(1)} (${dish.rating_count} reviews)</span>
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
  try {
    const response = await fetch(`${API_URL}/api/menu/`);
    const dishes = await response.json();
    
    console.log("API returned dishes:", dishes);
    
    const menuGrid = document.getElementById("menu-grid");
    menuGrid.innerHTML = "";
    
    // If API returns empty or error, use static items
    let dishesToDisplay = dishes;
    if (!Array.isArray(dishes) || dishes.length === 0) {
      console.log("Using static menu items as fallback");
      seedStaticMenu();
      dishesToDisplay = staticItems;
    }
    
    allDishes = dishesToDisplay; // Store for filtering
    
    dishesToDisplay.forEach(dish => {
      const imageUrl = dish.image_url || dish.image || 'images/default.jpeg';
      console.log("Processing dish:", dish.name, "with image:", imageUrl);
      menuItems[dish.name] = {
        id: dish.id,
        name: dish.name,
        price: dish.price,
        description: dish.description,
        image: imageUrl,
        vipOnly: dish.vipOnly || false,
        rating: dish.average_rating || 5,
        ratingCount: dish.rating_count || 0,
        category: dish.category || 'Other'
      };
      
      const rating = dish.average_rating || 5;
      const stars = generateStars(rating);
      const menuCard = document.createElement("div");
      menuCard.className = "menu-card";
      menuCard.innerHTML = `
        <img src="${imageUrl}" alt="${dish.name}" onerror="this.src='images/default.jpeg'">
        <h3>${dish.name}</h3>
        <p>${dish.description}</p>
        <div class="dish-rating">
          <span class="stars">${stars}</span>
          <span class="rating-text">${rating.toFixed(1)} (${dish.rating_count || 0} reviews)</span>
        </div>
        <span class="price">$${dish.price.toFixed(2)}</span>
        <button class="add-to-cart" onclick="addToCart('${dish.name}')">Add to Cart</button>
      `;
      menuGrid.appendChild(menuCard);
    });
    
    console.log("Menu loaded with", dishesToDisplay.length, "dishes");
    menuLoaded = true;
  } catch (error) {
    console.error("Error loading menu:", error);
    // Fallback to static items on error
    seedStaticMenu();
    allDishes = staticItems;
    const menuGrid = document.getElementById("menu-grid");
    menuGrid.innerHTML = "";
    
    staticItems.forEach(dish => {
      const menuCard = document.createElement("div");
      menuCard.className = "menu-card";
      menuCard.innerHTML = `
        <img src="${dish.image}" alt="${dish.name}" onerror="this.src='images/default.jpeg'">
        <h3>${dish.name}</h3>
        <p>${dish.description}</p>
        <div class="dish-rating">
          <span class="stars">[*][*][*][*][*]</span>
          <span class="rating-text">5.0 (0 reviews)</span>
        </div>
        <span class="price">$${dish.price.toFixed(2)}</span>
        <button class="add-to-cart" onclick="addToCart('${dish.name}')">Add to Cart</button>
      `;
      menuGrid.appendChild(menuCard);
    });
    menuLoaded = true;
  }
}

function generateStars(rating) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  let stars = "[*]".repeat(fullStars);
  if (hasHalfStar && fullStars < 5) stars += "[o]";
  return stars;
}

function addToCart(itemName) {
  const item = menuItems[itemName];
  
  if (!item) {
    alert("Item not found. Please refresh the page.");
    return;
  }
  
  // Don't require item.id - static items won't have it
  const isVIP = localStorage.getItem("isVIP") === "true";
  
  if (item.vipOnly && !isVIP) {
    alert("This item is exclusive to VIP members!\n\nUpgrade to VIP membership to access premium dishes.");
    return;
  }
  
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  
  const existingItem = cart.find(cartItem => cartItem.name === itemName);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      ...item,
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
  const isVIP = localStorage.getItem("isVIP") === "true";
  const vipMenuContent = document.getElementById("vip-menu-content");
  const vipMenuLocked = document.getElementById("vip-menu-locked");
  
  if (isVIP) {
    vipMenuContent.style.display = "block";
    vipMenuLocked.style.display = "none";
  } else {
    vipMenuContent.style.display = "none";
    vipMenuLocked.style.display = "block";
  }
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
