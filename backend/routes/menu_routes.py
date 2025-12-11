from flask import Blueprint, request, jsonify
from models.dish import Dish
from models.user import User

menu_bp = Blueprint("menu", __name__)



# Get all dishes
@menu_bp.get("/")
def get_menu():
    dishes = Dish.objects()
    return jsonify([
        {
            "id": str(d.id),
            "name": d.name,
            "description": d.description,
            "category": d.category,
            "image_url": d.image_url,
            "price": d.price,
            "is_available": d.is_available,
            "order_count": d.order_count,
            "average_rating": d.average_rating,
            "rating_count": d.rating_count,
            "tags": d.tags,
        }
        for d in dishes
    ]), 200



# Public: Get one dish
@menu_bp.get("/<dish_id>")
def get_dish(dish_id):
    dish = Dish.objects(id=dish_id).first()
    if not dish:
        return jsonify({"error": "Dish not found."}), 404

    return jsonify({
        "id": str(dish.id),
        "name": dish.name,
        "description": dish.description,
        "category": dish.category,
        "image_url": dish.image_url,
        "price": dish.price,
        "is_available": dish.is_available,
        "order_count": dish.order_count,
        "average_rating": dish.average_rating,
        "rating_count": dish.rating_count,
        "tags": dish.tags,
    }), 200



# Manager: Add a new dish
@menu_bp.post("/add")
def add_dish():
    data = request.get_json()

    manager_id = data.get("manager_id")
    manager = User.objects(id=manager_id).first()

    if not manager or manager.role != "Manager":
        return jsonify({"error": "Unauthorized. Only managers may add dishes."}), 403

    required_fields = ["name", "category", "price"]
    for field in required_fields:
        if field not in data:
            return jsonify({"error": f"{field} is required."}), 400

    dish = Dish(
        name=data["name"],
        description=data.get("description"),
        category=data["category"],
        price=data["price"],
        image_url=data.get("image_url"),
        tags=data.get("tags", []),
    ).save()

    return jsonify({
        "message": "Dish created successfully.",
        "dish_id": str(dish.id)
    }), 201



# Manager: Update a dish
@menu_bp.put("/update/<dish_id>")
def update_dish(dish_id):
    data = request.get_json()

    manager_id = data.get("manager_id")
    manager = User.objects(id=manager_id).first()

    if not manager or manager.role != "Manager":
        return jsonify({"error": "Unauthorized."}), 403

    dish = Dish.objects(id=dish_id).first()
    if not dish:
        return jsonify({"error": "Dish not found."}), 404

    # Optional fields
    for field in ["name", "description", "category", "price", "image_url", "tags"]:
        if field in data:
            setattr(dish, field, data[field])

    dish.save()

    return jsonify({"message": "Dish updated successfully."}), 200


# Manager: Change availability

@menu_bp.put("/availability/<dish_id>")
def change_availability(dish_id):
    data = request.get_json()

    manager_id = data.get("manager_id")
    manager = User.objects(id=manager_id).first()

    if not manager or manager.role != "Manager":
        return jsonify({"error": "Unauthorized."}), 403

    if "is_available" not in data:
        return jsonify({"error": "is_available is required."}), 400

    dish = Dish.objects(id=dish_id).first()
    if not dish:
        return jsonify({"error": "Dish not found."}), 404

    dish.is_available = bool(data["is_available"])
    dish.save()

    return jsonify({
        "message": "Availability updated.",
        "is_available": dish.is_available
    }), 200


# Manager: Delete a dish
@menu_bp.delete("/delete/<dish_id>")
def delete_dish(dish_id):
    data = request.get_json()

    manager_id = data.get("manager_id")
    manager = User.objects(id=manager_id).first()

    if not manager or manager.role != "Manager":
        return jsonify({"error": "Unauthorized."}), 403

    dish = Dish.objects(id=dish_id).first()
    if not dish:
        return jsonify({"error": "Dish not found."}), 404

    dish.delete()
    return jsonify({"message": "Dish removed from menu."}), 200


# 🟢 Customer: Rate a dish
@menu_bp.post("/rate/<dish_id>")
def rate_dish(dish_id):
    data = request.get_json()
    rating = data.get("rating")

    if rating is None or not (0 <= rating <= 5):
        return jsonify({"error": "Rating must be between 0 and 5."}), 400

    dish = Dish.objects(id=dish_id).first()
    if not dish:
        return jsonify({"error": "Dish not found."}), 404

    dish.add_rating(rating)

    return jsonify({
        "message": "Rating added.",
        "average_rating": dish.average_rating,
        "rating_count": dish.rating_count
    }), 200
