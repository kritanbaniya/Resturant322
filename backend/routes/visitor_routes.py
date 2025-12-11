from flask import Blueprint, request, jsonify
from services import menu_service, chat_service
from models.dish import Dish
from bson import ObjectId
from datetime import datetime

"""
UC-05: View Menu (Visitor)
Actor: Visitor (unauthenticated user)

Preconditions: Visitor has access to system interface

Main Flow:
1. Visitor enters AI System (possibly for first time)
2. Visitor can browse menus (UC-05 Step 2)
3. Visitor can use AI chatbot for questions (UC-05 Step 3)
4. Visitor can choose to register (UC-05 A1)

Alternate Flows:
A1: Registration Attempt - redirect to registration form
A2: AI Unavailable - display "AI assistance temporarily unavailable"

Postconditions: Visitor actions logged (chat interactions, ratings)
"""

visitor_bp = Blueprint('visitor', __name__)

# UC-05 Step 2: Browse menu without authentication
@visitor_bp.route('/menu', methods=['GET'])
def get_menu():
    """UC-05 Step 2: Get all available dishes for visitors
    
    Returns all dishes with basic info (name, price, description, image)
    No authentication required
    """
    try:
        dishes = Dish.objects()
        menu = [{
            "id": str(d.id),
            "name": d.name,
            "price": d.price,
            "description": d.description,
            "image_url": d.image_url,
            "available": d.available if hasattr(d, 'available') else True,
            "preparation_time": d.preparation_time if hasattr(d, 'preparation_time') else "30 mins"
        } for d in dishes]
        
        return jsonify({
            "message": "Menu retrieved successfully",
            "menu": menu
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# UC-05 Step 3: Ask AI chatbot (visitor session)
@visitor_bp.route('/chat', methods=['POST'])
def ask_ai_visitor():
    """UC-05 Step 3: Ask AI chatbot for general inquiries
    
    No authentication required
    user_id is None for visitors (unauthenticated)
    
    Request body:
    {
        "question": "What are your vegetarian options?"
    }
    """
    try:
        data = request.json
        question = data.get('question', '').strip()
        
        if not question:
            return jsonify({"error": "Question cannot be empty"}), 400
        
        # UC-05 A2: Check if AI is available
        response, status = chat_service.ask_ai(user_id=None, question_text=question)
        
        if status != 200:
            # AI service is unavailable (A2)
            return jsonify(response), status
        
        return jsonify(response), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# UC-05 Postcondition: Rate visitor AI response
@visitor_bp.route('/chat/<answer_id>/rate', methods=['POST'])
def rate_visitor_answer(answer_id):
    """UC-05 Postcondition: Log visitor rating of AI responses
    
    No authentication required
    
    Request body:
    {
        "rating": 4  (0-5 scale, 0 = very poor, 5 = excellent)
    }
    """
    try:
        # Validate answer_id is a valid ObjectId
        if not ObjectId.is_valid(answer_id):
            return jsonify({"error": "Invalid answer ID"}), 400
        
        data = request.json
        rating = data.get('rating')
        
        if rating is None:
            return jsonify({"error": "Rating is required"}), 400
        
        # UC-05 Postcondition: Log the rating
        response, status = chat_service.rate_answer(answer_id, rating)
        return jsonify(response), status
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# UC-05 Postcondition: Flag inappropriate AI response
@visitor_bp.route('/chat/<answer_id>/flag', methods=['POST'])
def flag_visitor_answer(answer_id):
    """UC-05 Postcondition: Log visitor flagging of problematic responses
    
    No authentication required
    
    Request body (optional):
    {
        "reason": "Response is inaccurate or offensive"
    }
    """
    try:
        # Validate answer_id is a valid ObjectId
        if not ObjectId.is_valid(answer_id):
            return jsonify({"error": "Invalid answer ID"}), 400
        
        data = request.json or {}
        reason = data.get('reason')
        
        # UC-05 Postcondition: Log the flag
        response, status = chat_service.flag_answer(answer_id, reason)
        return jsonify(response), status
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# UC-05 A1: Registration redirect endpoint
@visitor_bp.route('/register', methods=['GET'])
def visitor_register():
    """UC-05 A1: Redirect visitor to registration form
    
    Returns redirect URL to registration page
    No authentication required
    """
    return jsonify({
        "message": "Register to save your preferences and place orders",
        "redirect_url": "/register.html",
        "note": "Visitors can browse menu and chat with AI, but need to register to place orders"
    }), 200

# UC-05 A2: Check AI service status
@visitor_bp.route('/chat/status', methods=['GET'])
def get_chat_status():
    """UC-05 A2: Check if AI service is currently available
    
    No authentication required
    Returns availability status
    """
    try:
        response, status = chat_service.get_ai_status()
        return jsonify(response), status
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# UC-05: Log visitor action (for analytics)
@visitor_bp.route('/action', methods=['POST'])
def log_visitor_action():
    """UC-05 Postcondition: Log visitor actions for analytics
    
    No authentication required
    
    Request body:
    {
        "action_type": "menu_browse|chat_query|registration_click",
        "details": {...}  # action-specific details
    }
    """
    try:
        data = request.json
        action_type = data.get('action_type', '').strip()
        details = data.get('details', {})
        
        if not action_type:
            return jsonify({"error": "action_type is required"}), 400
        
        # Log the action (placeholder - could save to database)
        # For now, just acknowledge it
        return jsonify({
            "message": f"Action logged: {action_type}",
            "timestamp": datetime.utcnow().isoformat()
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
