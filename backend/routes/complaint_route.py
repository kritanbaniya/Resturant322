from flask import Blueprint, request, jsonify
from models.complaint import Complaint
from models.user import User
from services.user_service import apply_warning, apply_complaint_effect

complaint_bp = Blueprint('complaint', __name__)

@complaint_bp.get("/test")
def test():
    print("Test endpoint called!")
    return jsonify({"message": "Complaints API is working!"}), 200

@complaint_bp.post("/file")
def file_complaint():
    data = request.get_json()
    
    print("Received complaint data:", data) 

    from_user = data.get("from_user")
    target_id = data.get("to_user")
    message = data.get("text")
    entity_type = data.get("entity_type", "General")
    rating = data.get("rating", 0)
    weight = data.get("weight", 1)
    is_complaint = data.get("isComplaint", True)
    
    print(f"from_user: {from_user}, target_id: {target_id}, message: {message}, entity_type: {entity_type}")
    
    if not from_user or not target_id or not message:
        error_msg = f"Missing fields - from_user: {bool(from_user)}, to_user: {bool(target_id)}, text: {bool(message)}"
        print(error_msg)
        return jsonify({"error": error_msg}), 400
    
    # Ensure entity_type is not empty
    if not entity_type or entity_type == "":
        entity_type = "General"
    
    user_from = User.objects(id=from_user).first()
    if not user_from:
        print(f"User not found with ID: {from_user}")
        return jsonify({"error": f"User not found with ID: {from_user}"}), 404
    
    print(f"Found user: {user_from.name} (ID: {user_from.id})")
    
    # Try to find target user, but handle invalid ObjectId
    user_to = None
    try:
        from bson import ObjectId
        # Only try to query if target_id looks like a valid ObjectId
        if ObjectId.is_valid(target_id):
            user_to = User.objects(id=target_id).first()
            if user_to:
                print(f"Found target user: {user_to.name} (ID: {user_to.id})")
            else:
                print(f"Target ID is a valid ObjectId but user not found: {target_id}")
        else:
            print(f"Target ID is not a valid ObjectId, storing as raw ID: {target_id}")
    except Exception as e:
        print(f"Error checking target user: {e}")
        user_to = None
    
    try:
        print(f"Creating complaint with: fromUser={user_from.id}, toUser={user_to.id if user_to else None}, targetId={target_id}, entityType={entity_type}, message={message[:50]}...")
        
        complaint = Complaint(
            fromUser=user_from,
            toUser=user_to if user_to else None,
            targetId=target_id,
            message=message,
            entityType=entity_type,
            rating=rating,
            weight=weight,
            isComplaint=is_complaint
        )
        
        print("Complaint object created, attempting to save...")
        complaint.save()
        print("Complaint saved successfully!")

        return jsonify({
            "message": "Complaint filed successfully.",
            "complaint_id": str(complaint.id)
        }), 201
    except Exception as e:
        import traceback
        print(f"Error saving complaint: {str(e)}")
        print(traceback.format_exc())
        return jsonify({"error": f"Validation Error: {str(e)}"}), 400

@complaint_bp.get("/received/<user_id>")
def received(user_id):
    complaints = Complaint.objects(toUser=user_id)

    return jsonify([{
        "id": str(c.id),
        "from": str(c.fromUser.id),
        "from_name": c.fromUser.name if c.fromUser else "Unknown",
        "target_id": c.targetId,
        "entity_type": c.entityType,
        "text": c.message,
        "weight": c.weight,
        "is_complaint": c.isComplaint,
        "status": c.status,
        "created_at": c.created_at
    } for c in complaints]), 200

@complaint_bp.get("/submitted/<user_id>")
def submitted(user_id):
    complaints = Complaint.objects(fromUser=user_id)

    return jsonify([{
        "id": str(c.id),
        "to": str(c.toUser.id) if c.toUser else c.targetId,
        "to_name": c.toUser.name if c.toUser else "N/A",
        "target_id": c.targetId,
        "entity_type": c.entityType,
        "text": c.message,
        "weight": c.weight,
        "is_complaint": c.isComplaint,
        "status": c.status,
        "created_at": c.created_at
    } for c in complaints]), 200

@complaint_bp.get("/pending")
def get_pending_complaints():
    """Get all pending complaints for manager review"""
    complaints = Complaint.objects(status="PendingReview")
    
    return jsonify([{
        "id": str(c.id),
        "from": str(c.fromUser.id),
        "from_name": c.fromUser.name if c.fromUser else "Unknown",
        "to": str(c.toUser.id) if c.toUser else None,
        "to_name": c.toUser.name if c.toUser else "N/A",
        "target_id": c.targetId,
        "entity_type": c.entityType,
        "text": c.message,
        "rating": c.rating,
        "weight": c.weight,
        "is_complaint": c.isComplaint,
        "status": c.status,
        "created_at": c.created_at
    } for c in complaints]), 200

@complaint_bp.put("/resolve/<complaint_id>")
def resolve_complaint(complaint_id):
    """Manager endpoint to resolve a complaint as Valid or Invalid"""
    data = request.get_json()
    outcome = data.get("outcome")  # "Valid" or "Invalid"
    manager_id = data.get("manager_id")
    reason = data.get("reason", "")
    
    if outcome not in ["Valid", "Invalid"]:
        return jsonify({"error": "Outcome must be 'Valid' or 'Invalid'"}), 400
    
    # Verify manager role
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return jsonify({"error": "Unauthorized. Only managers can resolve complaints."}), 403
    
    complaint = Complaint.objects(id=complaint_id).first()
    if not complaint:
        return jsonify({"error": "Complaint not found"}), 404
    
    if complaint.status != "PendingReview":
        return jsonify({"error": "Complaint already resolved"}), 400
    
    if outcome == "Valid":
        # Mark complaint as valid
        complaint.status = "Valid"
        complaint.save()
        
        # Apply punishment to the target employee
        if complaint.toUser and complaint.entityType in ["Chef", "DeliveryPerson"]:
            apply_complaint_effect(
                str(complaint.toUser.id),
                complaint.entityType,
                complaint.weight
            )
            return jsonify({
                "message": "Complaint marked as Valid. Punishment applied to employee.",
                "complaint_id": str(complaint.id)
            }), 200
        else:
            return jsonify({
                "message": "Complaint marked as Valid (no employee punishment applicable).",
                "complaint_id": str(complaint.id)
            }), 200
    
    else:  # outcome == "Invalid"
        # Mark complaint as invalid
        complaint.status = "Invalid"
        complaint.save()
        
        # Apply warning to the complainer
        apply_warning(str(complaint.fromUser.id), reason)
        
        return jsonify({
            "message": "Complaint marked as Invalid. Warning applied to complainer.",
            "complaint_id": str(complaint.id)
        }), 200
