from flask import Blueprint, request, jsonify
from services.chef_service import get_orders_for_preparation, start_preparation, complete_preparation, set_order_on_hold

chef_bp = Blueprint('chefs', __name__)

@chef_bp.get("/queue")
def get_queue():
    orders = get_orders_for_preparation()
    return jsonify(orders), 200

@chef_bp.post("/start/<order_id>")
def start(order_id):
    response, status = start_preparation(order_id)
    return jsonify(response), status

@chef_bp.post("/complete/<order_id>")
def complete(order_id):
    response, status = complete_preparation(order_id)
    return jsonify(response), status

@chef_bp.post("/hold/<order_id>")
def hold(order_id):
    data = request.get_json()
    note = data.get("note")

    if not note:
        return jsonify({"error": "note is required"}), 400

    response, status = set_order_on_hold(order_id, note)
    return jsonify(response), status