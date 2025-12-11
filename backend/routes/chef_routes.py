from flask import Blueprint, request, jsonify
from services.chef_service import (
    get_orders_for_preparation, 
    get_order_details,
    start_preparation, 
    complete_preparation, 
    set_order_on_hold,
    get_chef_orders,
    evaluate_chef_performance
)
from models.user import User

chef_bp = Blueprint('chefs', __name__)

@chef_bp.get("/queue")
def get_queue():
    """UC-02 Step 1: Get pending orders for preparation"""
    orders = get_orders_for_preparation()
    return jsonify(orders), 200

@chef_bp.get("/<order_id>")
def get_order(order_id):
    """UC-02 Step 2: Get detailed order information"""
    response, status = get_order_details(order_id)
    return jsonify(response), status

@chef_bp.post("/start/<order_id>")
def start(order_id):
    """UC-02 Step 3: Start preparing order"""
    response, status = start_preparation(order_id)
    return jsonify(response), status

@chef_bp.post("/complete/<order_id>")
def complete(order_id):
    """UC-02 Step 5: Mark order as ready for delivery"""
    response, status = complete_preparation(order_id)
    return jsonify(response), status

@chef_bp.post("/hold/<order_id>")
def hold(order_id):
    """UC-02 A1: Put order on hold due to ingredient shortage"""
    data = request.get_json()
    note = data.get("note")

    if not note:
        return jsonify({"error": "note is required"}), 400

    response, status = set_order_on_hold(order_id, note)
    return jsonify(response), status

@chef_bp.get("/dashboard/<chef_id>")
def dashboard(chef_id):
    """Chef dashboard: Get all orders in progress"""
    # Verify chef role
    chef = User.objects(id=chef_id).first()
    if not chef or chef.role not in ["Chef", "Demoted_Chef"]:
        return jsonify({"error": "Unauthorized. Only chefs can access this."}), 403
    
    orders = get_chef_orders(chef_id)
    return jsonify(orders), 200

@chef_bp.get("/performance/<chef_id>")
def check_performance(chef_id):
    """UC-02 A3: Evaluate chef performance and apply bonuses/demotions"""
    # Verify chef role
    chef = User.objects(id=chef_id).first()
    if not chef or chef.role not in ["Chef", "Demoted_Chef"]:
        return jsonify({"error": "Unauthorized. Only chefs can access this."}), 403
    
    result, status = evaluate_chef_performance(chef_id)
    return jsonify(result), status
