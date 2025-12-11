from flask import Blueprint, request, jsonify
from services.manager_service import approve_registration, resolve_complaint, add_kb_entry, update_kb_entry, get_flagged_chat_responses, resolve_flagged_chat_response

manager_bp = Blueprint('manager', __name__)

@manager_bp.post("/approve-registration")
def approve():
    data = request.get_json()
    
    manager_id = data.get("manager_id")
    user_id = data.get("user_id")
    decision = data.get("decision")
    reason = data.get("reason")

    if not manager_id or not user_id or not decision:
        return jsonify({"error": "manager_id, user_id, and decision are required."}), 400
    
    response, status = approve_registration(manager_id, user_id, decision, reason)
    return jsonify(response), status

@manager_bp.post("/resolve-complaint")
def resolve():
    data = request.get_json()
    
    manager_id = data.get("manager_id")
    complaint_id = data.get("complaint_id")
    decision = data.get("decision")

    if not manager_id or not complaint_id or not decision:
        return jsonify({"error": "manager_id, complaint_id, and decision are required."}), 400
    
    response, status = resolve_complaint(manager_id, complaint_id, decision)
    return jsonify(response), status

@manager_bp.post("/kb/add")
def add_kb():
    data = request.get_json()
    
    question = data.get("question")
    answer = data.get("answer")
    keywords = data.get("keywords", [])

    if not question or not answer:
        return jsonify({"error": "question and answer are required."}), 400
    
    response, status = add_kb_entry(question, answer, keywords)
    return jsonify(response), status

@manager_bp.put("/kb/update/<entry_id>")
def kb_update(entry_id):
    data = request.get_json()

    new_answer = data.get("answer")

    if not new_answer:
        return jsonify({"error": "answer is required."}), 400
    
    response, status = update_kb_entry(entry_id, new_answer)
    return jsonify(response), status

@manager_bp.get("/chat/flagged")
def chat_flagged():
    response = get_flagged_chat_responses()
    return jsonify(response), 200

@manager_bp.post("/chat/resolve/<chat_id>")
def chat_resolve(chat_id):
    data = request.get_json()

    corrected_answer = data.get("corrected_answer")

    if not corrected_answer:
        return jsonify({"error": "corrected_answer is required."}), 400
    
    response, status = resolve_flagged_chat_response(chat_id, corrected_answer)
    return jsonify(response), status
