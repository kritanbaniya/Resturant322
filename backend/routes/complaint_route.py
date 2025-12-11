from flask import Blueprint, request, jsonify
from models.complaint import Complaint
from models.user import User

complaint_bp = Blueprint('complaint', __name__)

@complaint_bp.post("/file")
def file_complaint():
    data = request.get_json()

    from_user = data.get("from_user")
    to_user = data.get("to_user")
    text = data.get("text")
    weight = data.get("weight", 1)
    is_complaint = data.get("isComplaint", True)
    
    if not from_user or not to_user or not text:
        return jsonify({"error": "from_user, to_user, and text are required."}), 400
    
    user_from = User.objects(id=from_user).first()
    user_to = User.objects(id=to_user).first()

    if not user_from or not user_to:
        return jsonify({"error": "Invalid user id."}), 404
    
    complaint = Complaint(
        fromUser=user_from,
        toUser=user_to,
        text=text,
        weight=weight,
        isComplaint=is_complaint
    ).save()

    return jsonify({
        "message": "Complaint filed successfully.",
        "complaint_id": str(complaint.id)
    }), 201

@complaint_bp.get("/received/<user_id>")
def received(user_id):
    complaints = Complaint.objects(toUser=user_id)

    return jsonify([{
        "id": str(c.id),
        "from": str(c.fromUser.id),
        "text": c.text,
        "weight": c.weight,
        "is_complaint": c.isComplaint,
        "created_at": c.created_at
    } for c in complaints]), 200

@complaint_bp.get("/submitted/<user_id>")
def submitted(user_id):
    complaints = Complaint.objects(fromUser=user_id)

    return jsonify([{
        "id": str(c.id),
        "to": str(c.toUser.id),
        "text": c.text,
        "weight": c.weight,
        "is_complaint": c.isComplaint,
        "created_at": c.created_at
    } for c in complaints]), 200