const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const {
  getOrdersForPreparation,
  getOrderDetails,
  startPreparation,
  completePreparation,
  setOrderOnHold,
  getChefOrders,
  evaluateChefPerformance
} = require('../services/chef_service');
const User = require('../models/User');
const Dish = require('../models/Dish');
const { tokenRequired } = require('../utils/auth');

// verify user is chef before allowing access
const chefOnly = (req, res, next) => {
  if (!req.current_user || !["Chef", "Demoted_Chef"].includes(req.current_user.role)) {
    return res.status(403).json({ error: "Unauthorized. Only chefs can access this." });
  }
  next();
};

// specific routes must come before parameterized routes
router.get("/queue", tokenRequired, chefOnly, async (req, res) => {
  const orders = await getOrdersForPreparation();
  return res.status(200).json(orders);
});

// menu management routes - must be before /:order_id route
router.get("/menu", tokenRequired, chefOnly, async (req, res) => {
  try {
    const chefId = req.current_user.id;
    const dishes = await Dish.find({ created_by_chef_id: chefId })
      .sort({ created_at: -1 });
    
    return res.status(200).json(dishes.map(d => ({
      id: d._id.toString(),
      name: d.name,
      description: d.description,
      category: d.category,
      image_url: d.image_url,
      price: d.price,
      is_available: d.is_available,
      order_count: d.order_count,
      average_rating: d.average_rating,
      rating_count: d.rating_count,
      tags: d.tags || []
    })));
  } catch (error) {
    console.error("Error fetching chef menu:", error);
    return res.status(500).json({ error: "Failed to fetch menu." });
  }
});

router.post("/menu/create", tokenRequired, chefOnly, async (req, res) => {
  try {
    const chefId = req.current_user.id;
    const data = req.body;
    
    const requiredFields = ["name", "category", "price"];
    for (const field of requiredFields) {
      if (!(field in data)) {
        return res.status(400).json({ error: `${field} is required.` });
      }
    }
    
    const price = parseFloat(data.price);
    if (isNaN(price) || price < 0) {
      return res.status(400).json({ error: "price must be a valid positive number." });
    }
    
    // convert chefId string to mongoose ObjectId
    let chefObjectId;
    try {
      chefObjectId = new mongoose.Types.ObjectId(chefId);
    } catch (error) {
      return res.status(400).json({ error: "Invalid chef ID format." });
    }
    
    const dish = new Dish({
      name: data.name,
      description: data.description || "",
      category: data.category,
      price: price,
      image_url: data.image_url || "",
      tags: data.tags || [],
      is_available: data.is_available !== undefined ? Boolean(data.is_available) : true,
      created_by_chef_id: chefObjectId
    });
    
    await dish.save();
    
    return res.status(201).json({
      message: "Dish created successfully.",
      dish_id: dish._id.toString(),
      dish: {
        id: dish._id.toString(),
        name: dish.name,
        description: dish.description,
        category: dish.category,
        price: dish.price,
        image_url: dish.image_url,
        tags: dish.tags,
        is_available: dish.is_available
      }
    });
  } catch (error) {
    console.error("Error creating dish:", error);
    console.error("Error stack:", error.stack);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: "Validation error", details: error.message });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({ error: "Invalid data format", details: error.message });
    }
    return res.status(500).json({ error: "Failed to create dish.", details: error.message });
  }
});

router.get("/dashboard/:chef_id", tokenRequired, chefOnly, async (req, res) => {
  // verify chef_id matches authenticated user
  if (req.current_user.id !== req.params.chef_id) {
    return res.status(403).json({ error: "Unauthorized. You can only access your own dashboard." });
  }
  
  const orders = await getChefOrders(req.params.chef_id);
  return res.status(200).json(orders);
});

router.get("/performance/:chef_id", tokenRequired, chefOnly, async (req, res) => {
  // verify chef_id matches authenticated user
  if (req.current_user.id !== req.params.chef_id) {
    return res.status(403).json({ error: "Unauthorized. You can only access your own performance." });
  }
  
  const [result, status] = await evaluateChefPerformance(req.params.chef_id);
  return res.status(status).json(result);
});

router.post("/start/:order_id", tokenRequired, chefOnly, async (req, res) => {
  const [response, status] = await startPreparation(req.params.order_id);
  return res.status(status).json(response);
});

router.post("/complete/:order_id", tokenRequired, chefOnly, async (req, res) => {
  const [response, status] = await completePreparation(req.params.order_id);
  return res.status(status).json(response);
});

router.post("/hold/:order_id", tokenRequired, chefOnly, async (req, res) => {
  const { note } = req.body;
  
  if (!note) {
    return res.status(400).json({ error: "note is required" });
  }
  
  const [response, status] = await setOrderOnHold(req.params.order_id, note);
  return res.status(status).json(response);
});

router.put("/menu/:dish_id", tokenRequired, chefOnly, async (req, res) => {
  try {
    const chefId = req.current_user.id;
    const dishId = req.params.dish_id;
    const data = req.body;
    
    const dish = await Dish.findById(dishId);
    if (!dish) {
      return res.status(404).json({ error: "Dish not found." });
    }
    
    // verify chef owns this dish
    if (dish.created_by_chef_id && dish.created_by_chef_id.toString() !== chefId) {
      return res.status(403).json({ error: "Unauthorized. You can only edit your own dishes." });
    }
    
    const fields = ["name", "description", "category", "price", "image_url", "tags", "is_available"];
    for (const field of fields) {
      if (field in data) {
        if (field === "price") {
          dish[field] = parseFloat(data[field]);
        } else if (field === "is_available") {
          dish[field] = Boolean(data[field]);
        } else {
          dish[field] = data[field];
        }
      }
    }
    
    await dish.save();
    
    return res.status(200).json({
      message: "Dish updated successfully.",
      dish: {
        id: dish._id.toString(),
        name: dish.name,
        description: dish.description,
        category: dish.category,
        price: dish.price,
        image_url: dish.image_url,
        is_available: dish.is_available,
        tags: dish.tags
      }
    });
  } catch (error) {
    console.error("Error updating dish:", error);
    return res.status(500).json({ error: "Failed to update dish." });
  }
});

router.delete("/menu/:dish_id", tokenRequired, chefOnly, async (req, res) => {
  try {
    const chefId = req.current_user.id;
    const dishId = req.params.dish_id;
    
    const dish = await Dish.findById(dishId);
    if (!dish) {
      return res.status(404).json({ error: "Dish not found." });
    }
    
    // verify chef owns this dish
    if (dish.created_by_chef_id && dish.created_by_chef_id.toString() !== chefId) {
      return res.status(403).json({ error: "Unauthorized. You can only delete your own dishes." });
    }
    
    await dish.deleteOne();
    
    return res.status(200).json({ message: "Dish removed from menu." });
  } catch (error) {
    console.error("Error deleting dish:", error);
    return res.status(500).json({ error: "Failed to delete dish." });
  }
});

// generic parameterized route must be last
router.get("/:order_id", tokenRequired, chefOnly, async (req, res) => {
  const [response, status] = await getOrderDetails(req.params.order_id);
  return res.status(status).json(response);
});

module.exports = router;
