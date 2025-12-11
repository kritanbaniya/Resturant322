from models.dish import Dish
from models.user import User


def get_all_dishes():
    dishes = Dish.objects()
    return dishes


def get_dish_by_id(dish_id):
    return Dish.objects(id=dish_id).first()


def add_dish(manager_id, data):
    manager = User.objects(id=manager_id).first()

    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized. Only managers can add dishes."}, 403

    required_fields = ["name", "category", "price"]
    for f in required_fields:
        if f not in data:
            return {"error": f"{f} is required."}, 400

    dish = Dish(
        name=data["name"],
        description=data.get("description"),
        category=data["category"],
        price=data["price"],
        image_url=data.get("image_url"),
        tags=data.get("tags", []),
    ).save()

    return {"message": "Dish created successfully.", "dish_id": str(dish.id)}, 201

def update_dish(manager_id, dish_id, data):
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized."}, 403

    dish = Dish.objects(id=dish_id).first()
    if not dish:
        return {"error": "Dish not found."}, 404

    for field in ["name", "description", "category", "price", "image_url", "tags"]:
        if field in data:
            setattr(dish, field, data[field])

    dish.save()
    return {"message": "Dish updated successfully."}, 200


def change_availability(manager_id, dish_id, is_available):
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized."}, 403

    dish = Dish.objects(id=dish_id).first()
    if not dish:
        return {"error": "Dish not found."}, 404

    dish.is_available = bool(is_available)
    dish.save()

    return {"message": "Availability updated.", "is_available": dish.is_available}, 200


def delete_dish(manager_id, dish_id):
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized."}, 403

    dish = Dish.objects(id=dish_id).first()
    if not dish:
        return {"error": "Dish not found."}, 404

    dish.delete()
    return {"message": "Dish removed from menu."}, 200


def rate_dish(dish_id, rating):
    dish = Dish.objects(id=dish_id).first()
    if not dish:
        return {"error": "Dish not found."}, 404

    if rating is None or not (0 <= rating <= 5):
        return {"error": "Rating must be between 0 and 5."}, 400

    dish.add_rating(rating)

    return {
        "message": "Rating added.",
        "average_rating": dish.average_rating,
        "rating_count": dish.rating_count
    }, 200
