from flask import Blueprint, request, jsonify
from services.chat_service import ask_ai, rate_answer, flag_answer, get_chat_history

chat_bp = Blueprint('chat', __name__)

@chat_bp.post("/ask")
def ask():
    data = request.get_json()

    user_id = data.get("user_id")
    question = data.get("question")

    if not user_id or not question:
        return jsonify({"error": "user_id and question are required."}), 400
    
    response, status = ask_ai(user_id, question)
    return jsonify(response), status


@chat_bp.post("/rate")
def rate():
    data = request.get_json()

    answer_id = data.get("answer_id")
    rating = data.get("rating")

    if answer_id is None or rating is None:
        return jsonify({"error": "answer_id and rating are required."}), 400
    
    response, status = rate_answer(answer_id, int(rating))
    return jsonify(response), status

@chat_bp.post("/flag")
def flag():
    data = request.get_json()

    answer_id = data.get("answer_id")
    reason = data.get("reason")

    if answer_id is None:
        return jsonify({"error": "answer_id is required."}), 400
    
    response, status = flag_answer(answer_id, reason)
    return jsonify(response), status

@chat_bp.get("/history/<user_id>")
def history(user_id):
    response, status = get_chat_history(user_id)
    return jsonify(response), status