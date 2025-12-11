const express = require('express');
const router = express.Router();
const Dish = require('../models/Dish');
const User = require('../models/User');

router.get("/", async (req, res) => {
  const dishes = await Dish.find({});
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
    tags: d.tags
  })));
});

router.get("/:dish_id", async (req, res) => {
  const dish = await Dish.findById(req.params.dish_id);
  if (!dish) {
    return res.status(404).json({ error: "Dish not found." });
  }
  
  return res.status(200).json({
    id: dish._id.toString(),
    name: dish.name,
    description: dish.description,
    category: dish.category,
    image_url: dish.image_url,
    price: dish.price,
    is_available: dish.is_available,
    order_count: dish.order_count,
    average_rating: dish.average_rating,
    rating_count: dish.rating_count,
    tags: dish.tags
  });
});

router.post("/add", async (req, res) => {
  const data = req.body;
  const managerId = data.manager_id;
  const manager = await User.findById(managerId);
  
  if (!manager || manager.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized. Only managers may add dishes." });
  }
  
  const requiredFields = ["name", "category", "price"];
  for (const field of requiredFields) {
    if (!(field in data)) {
      return res.status(400).json({ error: `${field} is required.` });
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
  
  return res.status(201).json({
    message: "Dish created successfully.",
    dish_id: dish._id.toString()
  });
});

router.put("/update/:dish_id", async (req, res) => {
  const data = req.body;
  const managerId = data.manager_id;
  const manager = await User.findById(managerId);
  
  if (!manager || manager.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized." });
  }
  
  const dish = await Dish.findById(req.params.dish_id);
  if (!dish) {
    return res.status(404).json({ error: "Dish not found." });
  }
  
  const fields = ["name", "description", "category", "price", "image_url", "tags"];
  for (const field of fields) {
    if (field in data) {
      dish[field] = data[field];
    }
  }
  
  await dish.save();
  return res.status(200).json({ message: "Dish updated successfully." });
});

router.put("/availability/:dish_id", async (req, res) => {
  const data = req.body;
  const managerId = data.manager_id;
  const manager = await User.findById(managerId);
  
  if (!manager || manager.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized." });
  }
  
  if (!("is_available" in data)) {
    return res.status(400).json({ error: "is_available is required." });
  }
  
  const dish = await Dish.findById(req.params.dish_id);
  if (!dish) {
    return res.status(404).json({ error: "Dish not found." });
  }
  
  dish.is_available = Boolean(data.is_available);
  await dish.save();
  
  return res.status(200).json({
    message: "Availability updated.",
    is_available: dish.is_available
  });
});

router.delete("/delete/:dish_id", async (req, res) => {
  const data = req.body;
  const managerId = data.manager_id;
  const manager = await User.findById(managerId);
  
  if (!manager || manager.role !== "Manager") {
    return res.status(403).json({ error: "Unauthorized." });
  }
  
  const dish = await Dish.findById(req.params.dish_id);
  if (!dish) {
    return res.status(404).json({ error: "Dish not found." });
  }
  
  await dish.deleteOne();
  return res.status(200).json({ message: "Dish removed from menu." });
});

router.post("/rate/:dish_id", async (req, res) => {
  const { rating } = req.body;
  
  if (rating === undefined || rating < 0 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 0 and 5." });
  }
  
  const dish = await Dish.findById(req.params.dish_id);
  if (!dish) {
    return res.status(404).json({ error: "Dish not found." });
  }
  
  await dish.add_rating(rating);
  
  return res.status(200).json({
    message: "Rating added.",
    average_rating: dish.average_rating,
    rating_count: dish.rating_count
  });
});

module.exports = router;
