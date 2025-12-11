from flask import Blueprint, request, jsonify
from services.order_service import create_order, confirm_order, get_customer_orders

order_bp = Blueprint("orders", __name__)

@order_bp.post("/create")
def create():
    data = request.get_json()
    customer_id = data.get("customer_id")
    items = data.get("items")

    if not customer_id or not items:
        return jsonify({"error": "customer_id and items are required"}), 400

    response, status = create_order(customer_id, items)
    return jsonify(response), status


@order_bp.post("/confirm/<order_id>")
def confirm(order_id):
    response, status = confirm_order(order_id)
    return jsonify(response), status


@order_bp.get("/history/<customer_id>")
def history(customer_id):
    orders = get_customer_orders(customer_id)
    return jsonify(orders), 200
