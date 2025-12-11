const mongoose = require('mongoose');
const Dish = require('../models/Dish');
const config = require('../config');

// static dishes from menu.js
const dishesToSeed = [
  { 
    name: "Salmon Sushi", 
    price: 14.99, 
    description: "Fresh salmon with perfectly seasoned rice.", 
    image_url: "images/sushi.jpeg", 
    category: "Seafood",
    tags: ["sushi", "seafood", "japanese"]
  },
  { 
    name: "Fettuccine Alfredo", 
    price: 12.99, 
    description: "Creamy pasta with parmesan cheese and herbs.", 
    image_url: "images/pasta.jpeg", 
    category: "Pasta",
    tags: ["pasta", "italian", "creamy"]
  },
  { 
    name: "Spaghetti Bolognese", 
    price: 12.99, 
    description: "Classic Italian pasta with meat sauce.", 
    image_url: "images/spaghetti_bolognese.jpeg", 
    category: "Pasta",
    tags: ["pasta", "italian", "meat"]
  },
  { 
    name: "Grilled Chicken Salad", 
    price: 10.99, 
    description: "Fresh greens with chicken and dressing.", 
    image_url: "images/salad.jpeg", 
    category: "Appetizer",
    tags: ["salad", "chicken", "healthy"]
  },
  { 
    name: "Margherita Pizza", 
    price: 14.99, 
    description: "Tomatoes, mozzarella, and fresh basil.", 
    image_url: "images/margherita_pizza.jpeg", 
    category: "Pizza",
    tags: ["pizza", "italian", "vegetarian"]
  },
  { 
    name: "Chicken Parmesan", 
    price: 15.99, 
    description: "Breaded chicken topped with marinara and cheese.", 
    image_url: "images/chicken_parmesan.jpeg", 
    category: "Main",
    tags: ["chicken", "italian", "cheese"]
  },
  { 
    name: "Penne alla Vodka", 
    price: 13.99, 
    description: "Pasta in a creamy tomato-vodka sauce.", 
    image_url: "images/penne_alla_vodka.jpeg", 
    category: "Pasta",
    tags: ["pasta", "italian", "creamy"]
  },
  { 
    name: "Chicken Wings", 
    price: 11.99, 
    description: "Spicy and crispy chicken wings with dipping sauce.", 
    image_url: "images/chicken_wings.jpeg", 
    category: "Appetizer",
    tags: ["chicken", "spicy", "wings"]
  },
  { 
    name: "Grilled Lobster", 
    price: 35.99, 
    description: "Succulent lobster grilled to perfection.", 
    image_url: "images/lobster.jpeg", 
    category: "Seafood",
    tags: ["lobster", "seafood", "premium"]
  },
  { 
    name: "Ribeye Steak", 
    price: 29.99, 
    description: "Juicy ribeye steak, perfectly seared.", 
    image_url: "images/ribeye.jpeg", 
    category: "Main",
    tags: ["steak", "beef", "premium"]
  },
  { 
    name: "Tomahawk Steak", 
    price: 49.99, 
    description: "Premium tomahawk cut with rich marbling.", 
    image_url: "images/tomahawk.jpeg", 
    category: "Main",
    tags: ["steak", "beef", "premium", "luxury"]
  }
];

async function seedDishes() {
  try {
    // connect to mongodb
    await mongoose.connect(config.MONGO_URI);
    console.log('Connected to MongoDB');

    let created = 0;
    let skipped = 0;

    for (const dishData of dishesToSeed) {
      // check if dish already exists
      const existingDish = await Dish.findOne({ name: dishData.name });
      
      if (existingDish) {
        console.log(`⏭️  Skipping "${dishData.name}" - already exists`);
        skipped++;
        continue;
      }

      // create new dish
      const dish = new Dish({
        name: dishData.name,
        description: dishData.description,
        category: dishData.category,
        price: dishData.price,
        image_url: dishData.image_url,
        tags: dishData.tags || [],
        is_available: true,
        order_count: 0,
        average_rating: 0.0,
        rating_count: 0,
        created_by_chef_id: null
      });

      await dish.save();
      console.log(`✅ Created "${dishData.name}" - $${dishData.price.toFixed(2)}`);
      created++;
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Seeding complete!`);
    console.log(`   Created: ${created} dishes`);
    console.log(`   Skipped: ${skipped} dishes (already exist)`);
    console.log(`   Total:   ${dishesToSeed.length} dishes`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding dishes:', error);
    process.exit(1);
  }
}

seedDishes();
