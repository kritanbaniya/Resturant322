from flask import Blueprint, request, jsonify
from bson import ObjectId
from services.manager_service import (
    get_pending_registrations,
    approve_registration,
    get_pending_complaints,
    resolve_complaint,
    get_employees,
    hire_employee,
    fire_employee,
    promote_employee,
    pay_bonus,
    get_pending_delivery_bids,
    assign_delivery_with_justification,
    get_flagged_ai_responses,
    update_kb_from_flagged,
    check_unresolved_complaints_alert,
    add_kb_entry,
    update_kb_entry,
    get_flagged_chat_responses,
    resolve_flagged_chat_response
)
from utils.auth import token_required

manager_bp = Blueprint('manager', __name__)

# UC-04 Step 1: Get manager dashboard (all pending items)
@manager_bp.route('/dashboard', methods=['GET'])
@token_required
def dashboard(current_user):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    # Check for alerts
    alert = check_unresolved_complaints_alert()
    
    # Get all pending items
    pending_registrations = get_pending_registrations()
    pending_complaints = get_pending_complaints()
    pending_bids = get_pending_delivery_bids()
    flagged_ai = get_flagged_ai_responses()
    
    return jsonify({
        "dashboard": {
            "alert": alert,
            "pending_registrations": len(pending_registrations),
            "pending_complaints": len(pending_complaints),
            "pending_bids": len(pending_bids),
            "flagged_ai": len(flagged_ai)
        }
    }), 200

# UC-04 Step 2: Get pending registrations
@manager_bp.route('/registrations/pending', methods=['GET'])
@token_required
def get_registrations(current_user):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    registrations = get_pending_registrations()
    return jsonify({
        "registrations": registrations,
        "total": len(registrations)
    }), 200

# UC-04 Step 3: Approve or reject registration (A1 for rejection)
@manager_bp.route('/registrations/<user_id>/approve', methods=['POST'])
@token_required
def approve(current_user, user_id):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    if not ObjectId.is_valid(user_id):
        return jsonify({"error": "Invalid user ID"}), 400
    
    data = request.get_json()
    decision = data.get('decision')  # APPROVE or REJECT
    reason = data.get('reason')  # Required for REJECT (A1)
    
    if not decision:
        return jsonify({"error": "decision required (APPROVE or REJECT)"}), 400
    
    if decision == "REJECT" and not reason:
        return jsonify({"error": "reason required for rejection (A1)"}), 400
    
    response, status = approve_registration(current_user['id'], user_id, decision, reason)
    return jsonify(response), status

# UC-04 Step 4: Get pending complaints for review
@manager_bp.route('/complaints/pending', methods=['GET'])
@token_required
def get_complaints(current_user):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    complaints = get_pending_complaints()
    return jsonify({
        "complaints": complaints,
        "total": len(complaints)
    }), 200

# UC-04 Step 5: Resolve complaint (Valid/Invalid/Escalated)
@manager_bp.route('/complaints/<complaint_id>/resolve', methods=['POST'])
@token_required
def resolve(current_user, complaint_id):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    if not ObjectId.is_valid(complaint_id):
        return jsonify({"error": "Invalid complaint ID"}), 400
    
    data = request.get_json()
    decision = data.get('decision')  # VALID, INVALID, or ESCALATED
    escalation_note = data.get('escalation_note')  # For ESCALATED
    
    if not decision:
        return jsonify({"error": "decision required (VALID, INVALID, or ESCALATED)"}), 400
    
    response, status = resolve_complaint(current_user['id'], complaint_id, decision, escalation_note)
    return jsonify(response), status

# UC-04 Step 6: Get all employees
@manager_bp.route('/employees', methods=['GET'])
@token_required
def get_staff(current_user):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    employees = get_employees()
    return jsonify({
        "employees": employees,
        "total": len(employees)
    }), 200

# UC-04 Step 6: Hire new employee
@manager_bp.route('/employees/hire', methods=['POST'])
@token_required
def hire(current_user):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    data = request.get_json()
    user_id = data.get('user_id')
    role = data.get('role')  # Chef or DeliveryPerson
    
    if not user_id or not role:
        return jsonify({"error": "user_id and role required"}), 400
    
    if not ObjectId.is_valid(user_id):
        return jsonify({"error": "Invalid user ID"}), 400
    
    response, status = hire_employee(current_user['id'], user_id, role)
    return jsonify(response), status

# UC-04 Step 6: Fire (terminate) employee
@manager_bp.route('/employees/<user_id>/fire', methods=['POST'])
@token_required
def fire(current_user, user_id):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    if not ObjectId.is_valid(user_id):
        return jsonify({"error": "Invalid user ID"}), 400
    
    data = request.get_json()
    reason = data.get('reason')
    
    response, status = fire_employee(current_user['id'], user_id, reason)
    return jsonify(response), status

# UC-04 Step 6: Promote employee (remove demotion)
@manager_bp.route('/employees/<user_id>/promote', methods=['POST'])
@token_required
def promote(current_user, user_id):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    if not ObjectId.is_valid(user_id):
        return jsonify({"error": "Invalid user ID"}), 400
    
    response, status = promote_employee(current_user['id'], user_id)
    return jsonify(response), status

# UC-04 Step 6: Pay performance bonus
@manager_bp.route('/employees/<user_id>/bonus', methods=['POST'])
@token_required
def bonus(current_user, user_id):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    if not ObjectId.is_valid(user_id):
        return jsonify({"error": "Invalid user ID"}), 400
    
    data = request.get_json()
    bonus_amount = data.get('amount')
    
    if not bonus_amount or bonus_amount <= 0:
        return jsonify({"error": "Valid bonus amount required"}), 400
    
    response, status = pay_bonus(current_user['id'], user_id, bonus_amount)
    return jsonify(response), status

# UC-04 Step 7: Get pending delivery bids
@manager_bp.route('/delivery-bids/pending', methods=['GET'])
@token_required
def get_bids(current_user):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    bids = get_pending_delivery_bids()
    return jsonify({
        "bids": bids,
        "total": len(bids)
    }), 200

# UC-04 Step 7-8: Assign delivery with justification
@manager_bp.route('/delivery-bids/<bid_id>/assign', methods=['POST'])
@token_required
def assign_bid(current_user, bid_id):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    if not ObjectId.is_valid(bid_id):
        return jsonify({"error": "Invalid bid ID"}), 400
    
    data = request.get_json()
    justification = data.get('justification')
    
    response, status = assign_delivery_with_justification(current_user['id'], bid_id, justification)
    return jsonify(response), status

# UC-04 Step 9: Get flagged AI responses
@manager_bp.route('/ai/flagged', methods=['GET'])
@token_required
def get_flagged(current_user):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    flagged = get_flagged_ai_responses()
    return jsonify({
        "flagged_responses": flagged,
        "total": len(flagged)
    }), 200

# UC-04 Step 9: Correct flagged AI response and update KB
@manager_bp.route('/ai/flagged/<chat_id>/correct', methods=['POST'])
@token_required
def correct_ai(current_user, chat_id):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    if not ObjectId.is_valid(chat_id):
        return jsonify({"error": "Invalid chat ID"}), 400
    
    data = request.get_json()
    corrected_answer = data.get('corrected_answer')
    
    if not corrected_answer:
        return jsonify({"error": "corrected_answer required"}), 400
    
    response, status = update_kb_from_flagged(current_user['id'], chat_id, corrected_answer)
    return jsonify(response), status

# UC-04 A2: Get unresolved complaints alert
@manager_bp.route('/alerts/complaints', methods=['GET'])
@token_required
def complaints_alert(current_user):
    if current_user['role'] != "Manager":
        return jsonify({"error": "Unauthorized"}), 403
    
    alert = check_unresolved_complaints_alert()
    return jsonify(alert), 200

# Legacy endpoints
@manager_bp.post("/approve-registration")
def approve_legacy():
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
def resolve_legacy():
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
