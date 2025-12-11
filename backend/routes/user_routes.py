from flask import Blueprint, request, jsonify
from models.user import User
from services.user_service import deposit_money, update_vip_status

user_bp = Blueprint('users', __name__)

@user_bp.get("/<user_id>")
def get_user(user_id):
    user = User.objects(id=user_id).first()
    if not user:
        return jsonify({"error": "User not found."}), 404
    
    user_data = {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,

        "balance": user.balance,
        "totalSpent": user.totalSpent,
        "orderCount": user.orderCount,
        "isVIP": user.isVIP,
        "status": user.status,
        "warningCount": user.warningCount,
        "netComplaints": user.netComplaints,
        "demotionsCount": user.demotions
    }
    return jsonify(user_data), 200

@user_bp.post("/deposit")
def deposit():
    data = request.get_json()
    user_id = data.get("user_id")
    amount = data.get("amount")

    if not user_id or amount is None:
        return jsonify({"error": "user_id and amount are required."}), 400
    
    response, status = deposit_money(user_id, amount)
    return jsonify(response), status

@user_bp.put("/update-vip/<user_id>")
def update_vip(user_id):
    user = User.objects(id=user_id).first()
    if not user:
        return jsonify({"error": "User not found."}), 404

    updated = update_vip_status(user_id)
    if not updated:
        return jsonify({"message": "User does not qualify for VIP status."}), 400
    
    return jsonify({"message": "User promoted to VIP status."}), 200