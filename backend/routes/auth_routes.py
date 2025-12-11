from flask import Blueprint, request, jsonify
from services.user_service import register_customer, login_user

auth_bp = Blueprint('auth', __name__)

@auth_bp.post("/register")
def register():
    data = request.get_json()
    try:
        response = register_customer(data)
        return jsonify(response), 201
    
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    
    except Exception as e:
        return jsonify({"error": "Registration failed", "details": str(e)}), 500


@auth_bp.post("/login")
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400
    
    response, status = login_user(email, password)
    return jsonify(response), status