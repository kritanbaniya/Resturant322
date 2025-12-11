const Dish = require('../models/Dish');
const User = require('../models/User');

// retrieve all dishes
async function getAllDishes() {
  return await Dish.find({});
}

// retrieve dish by id
async function getDishById(dishId) {
  return await Dish.findById(dishId);
}

// add a new dish to the menu
async function addDish(managerId, data) {
  const manager = await User.findById(managerId);
  
  if (!manager || manager.role !== "Manager") {
    return { error: "Unauthorized. Only managers can add dishes." }, 403;
  }
  
  const requiredFields = ["name", "category", "price"];
  for (const field of requiredFields) {
    if (!(field in data)) {
      return { error: `${field} is required.` }, 400;
    }
  }
  
  const dish = new Dish({
    name: data.name,
    description: data.description,
    category: data.category,
    price: data.price,
    image_url: data.image_url,
    tags: data.tags || []
  });
  
  await dish.save();
  
  return { message: "Dish created successfully.", dish_id: dish._id.toString() }, 201;
}

// update existing dish details
async function updateDish(managerId, dishId, data) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return { error: "Unauthorized." }, 403;
  }
  
  const dish = await Dish.findById(dishId);
  if (!dish) {
    return { error: "Dish not found." }, 404;
  }
  
  const fields = ["name", "description", "category", "price", "image_url", "tags"];
  for (const field of fields) {
    if (field in data) {
      dish[field] = data[field];
    }
  }
  
  await dish.save();
  return { message: "Dish updated successfully." }, 200;
}

// change dish availability
async function changeAvailability(managerId, dishId, isAvailable) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return { error: "Unauthorized." }, 403;
  }
  
  const dish = await Dish.findById(dishId);
  if (!dish) {
    return { error: "Dish not found." }, 404;
  }
  
  dish.is_available = Boolean(isAvailable);
  await dish.save();
  
  return { message: "Availability updated.", is_available: dish.is_available }, 200;
}

// remove a dish from the menu
async function deleteDish(managerId, dishId) {
  const manager = await User.findById(managerId);
  if (!manager || manager.role !== "Manager") {
    return { error: "Unauthorized." }, 403;
  }
  
  const dish = await Dish.findById(dishId);
  if (!dish) {
    return { error: "Dish not found." }, 404;
  }
  
  await dish.deleteOne();
  return { message: "Dish removed from menu." }, 200;
}

// rate a dish
async function rateDish(dishId, rating) {
  const dish = await Dish.findById(dishId);
  if (!dish) {
    return { error: "Dish not found." }, 404;
  }
  
  if (rating === null || rating === undefined || rating < 0 || rating > 5) {
    return { error: "Rating must be between 0 and 5." }, 400;
  }
  
  await dish.add_rating(rating);
  
  return {
    message: "Rating added.",
    average_rating: dish.average_rating,
    rating_count: dish.rating_count
  }, 200;
}

module.exports = {
  getAllDishes,
  getDishById,
  addDish,
  updateDish,
  changeAvailability,
  deleteDish,
  rateDish
};
