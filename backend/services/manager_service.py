from models.user import User
from models.complaint import Complaint
from models.knowledge_base import KnowledgeBaseEntry
from models.chat import ChatAnswer
from models.delivery import DeliveryBid
from models.order import Order
import datetime

"""
UC-04: Manage System and Personnel
Actor: Manager

Preconditions: Manager is authenticated

Main Flow:
1. Manager logs in and accesses admin dashboard
2. Reviews pending registrations (Customer or Delivery Person) 
3. Approves/rejects applications with reason (A1 for rejection)
4. Monitors open complaints from Customers or Employees
5. Resolves disputes (Valid/Invalid/Escalated outcomes)
6. Manages Employees (hire, fire, promote, pay bonuses)
7. Reviews delivery bids and assigns to Delivery People
8. If higher bid accepted, submit justification memo
9. Reviews AI responses flagged as "outrageous" and updates Knowledge Base

Postconditions: System data updated, reports logged
"""

# Get pending registrations (UC-04 Step 2)
def get_pending_registrations():
    """Get all users pending approval (PendingApproval status)"""
    pending = User.objects(status="PendingApproval").order_by("-created_at")
    
    return [
        {
            "user_id": str(u.id),
            "name": u.name,
            "email": u.email,
            "phone": u.phone or "N/A",
            "role": u.role,
            "address": u.address or "N/A",
            "created_at": u.created_at
        }
        for u in pending
    ]

# Manager approval of user registrations (UC-04 Step 3, A1)
def approve_registration(manager_id, user_id, decision, reason=None):
    """UC-04 Step 3: Approve or reject registration with reason"""
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized. Only managers can approve registrations."}, 403
    
    user = User.objects(id=user_id).first()
    if not user or user.status != "PendingApproval":
        return {"error": "User not found or not pending approval."}, 404
    
    if decision == "APPROVE":
        user.status = "Active"
        message = f"User {user.name} approved successfully."
    elif decision == "REJECT":
        user.status = "Rejected"
        user.rejectionReason = reason or "Application rejected by manager."
        message = f"User {user.name} rejected. Reason: {reason or 'No reason provided'}"
    else:
        return {"error": "Invalid decision. Use 'APPROVE' or 'REJECT'."}, 400
    
    user.save()
    return {"message": message}, 200

# Get pending complaints (UC-04 Step 4)
def get_pending_complaints():
    """Get all unresolved complaints for manager review"""
    complaints = Complaint.objects(status="PendingReview").order_by("-created_at")
    
    result = []
    for c in complaints:
        result.append({
            "complaint_id": str(c.id),
            "from_user": c.fromUser.name if c.fromUser else "Unknown",
            "to_user": c.toUser.name if c.toUser else "Unknown",
            "type": "Complaint" if c.isComplaint else "Compliment",
            "rating": c.rating,
            "weight": c.weight,
            "message": c.message or "",
            "entity_type": c.entityType,
            "created_at": c.created_at
        })
    
    return result

# Resolve complaint (UC-04 Step 5)
def resolve_complaint(manager_id, complaint_id, decision, escalation_note=None):
    """UC-04 Step 5: Resolve complaint (Valid/Invalid/Escalated)"""
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized. Only managers can resolve complaints."}, 403
    
    complaint = Complaint.objects(id=complaint_id).first()
    if not complaint:
        return {"error": "Complaint not found."}, 404
    
    target = complaint.toUser
    if not target:
        return {"error": "Cannot resolve complaint without target user."}, 400

    result = {"message": ""}

    if decision == "VALID":
        complaint.mark_valid()
        
        # Apply complaint effect to employee (chef/delivery person)
        if target.role in ["Chef", "DeliveryPerson", "Demoted_Chef", "Demoted_DeliveryPerson"]:
            from services.user_service import apply_complaint_effect
            apply_complaint_effect(target.id, complaint.entityType, complaint.weight)
            result["message"] = f"Complaint marked VALID. Penalty applied to {target.name}."
        else:
            # Apply warning to customer for invalid compliment
            if not complaint.isComplaint:
                from services.user_service import apply_warning
                apply_warning(complaint.fromUser.id, "Invalid compliment filed.")
                result["message"] = f"Compliment marked VALID."
            else:
                result["message"] = f"Complaint marked VALID."
    
    elif decision == "INVALID":
        complaint.mark_invalid()
        
        # Apply warning to complainer for invalid complaint
        from services.user_service import apply_warning
        apply_warning(complaint.fromUser.id, f"Invalid {('complaint' if complaint.isComplaint else 'compliment')} filed.")
        result["message"] = f"Complaint marked INVALID. Warning applied to {complaint.fromUser.name}."
    
    elif decision == "ESCALATED":
        complaint.status = "Escalated"
        complaint.escalationNote = escalation_note or "Escalated for further review"
        complaint.save()
        result["message"] = f"Complaint ESCALATED for further investigation."
    
    else:
        return {"error": "Invalid decision. Use 'VALID', 'INVALID', or 'ESCALATED'."}, 400
    
    return result, 200

# Get all employees for management (UC-04 Step 6)
def get_employees():
    """Get all Chef and DeliveryPerson employees"""
    employees = User.objects(role__in=["Chef", "DeliveryPerson", "Demoted_Chef", "Demoted_DeliveryPerson"]).order_by("role")
    
    return [
        {
            "user_id": str(e.id),
            "name": e.name,
            "email": e.email,
            "role": e.role,
            "status": e.status,
            "net_complaints": e.netComplaints,
            "demotions": e.demotionsCount,
            "warnings": e.warningCount,
            "hired_date": e.created_at
        }
        for e in employees
    ]

# Hire new employee (UC-04 Step 6)
def hire_employee(manager_id, user_id, employee_role):
    """UC-04 Step 6: Hire new employee (Chef or DeliveryPerson)"""
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized"}, 403
    
    user = User.objects(id=user_id).first()
    if not user:
        return {"error": "User not found"}, 404
    
    if employee_role not in ["Chef", "DeliveryPerson"]:
        return {"error": "Invalid employee role"}, 400
    
    user.role = employee_role
    user.status = "Active"
    user.save()
    return {"message": f"User {user.name} hired as {employee_role}"}, 200

# Fire employee (UC-04 Step 6)
def fire_employee(manager_id, user_id, reason=None):
    """UC-04 Step 6: Terminate employee"""
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized"}, 403
    
    user = User.objects(id=user_id).first()
    if not user:
        return {"error": "User not found"}, 404
    
    user.status = "Terminated"
    user.terminationReason = reason or "Terminated by manager"
    user.save()
    return {"message": f"Employee {user.name} terminated."}, 200

# Promote employee (UC-04 Step 6)
def promote_employee(manager_id, user_id, new_role=None):
    """UC-04 Step 6: Promote employee (remove demotion status)"""
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized"}, 403
    
    user = User.objects(id=user_id).first()
    if not user:
        return {"error": "User not found"}, 404
    
    # Restore to full role if demoted
    if user.role == "Demoted_Chef":
        user.role = "Chef"
        user.demotionsCount = 0
        user.netComplaints = 0
        message = "Chef promoted back to full Chef role"
    elif user.role == "Demoted_DeliveryPerson":
        user.role = "DeliveryPerson"
        user.demotionsCount = 0
        user.netComplaints = 0
        message = "DeliveryPerson promoted back to full role"
    else:
        return {"error": "User is not in demoted status"}, 400
    
    user.save()
    return {"message": message}, 200

# Pay bonus (UC-04 Step 6)
def pay_bonus(manager_id, user_id, bonus_amount):
    """UC-04 Step 6: Pay performance bonus to employee"""
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized"}, 403
    
    user = User.objects(id=user_id).first()
    if not user:
        return {"error": "User not found"}, 404
    
    if bonus_amount <= 0:
        return {"error": "Bonus amount must be positive"}, 400
    
    # Add bonus to user's balance
    user.balance += bonus_amount
    user.save()
    
    return {
        "message": f"Bonus of ${bonus_amount:.2f} paid to {user.name}",
        "new_balance": user.balance
    }, 200

# Get pending delivery bids (UC-04 Step 7)
def get_pending_delivery_bids():
    """UC-04 Step 7: Get pending delivery bids for review"""
    bids = DeliveryBid.objects(status="Pending").order_by("-created_at")
    
    result = []
    for bid in bids:
        order = bid.order
        result.append({
            "bid_id": str(bid.id),
            "order_id": str(order.id),
            "delivery_person": bid.deliveryPerson.name,
            "bid_amount": bid.bidAmount,
            "order_status": order.status,
            "customer": order.customer.name,
            "items_count": len(order.items),
            "created_at": bid.created_at
        })
    
    return result

# Assign delivery with justification (UC-04 Step 7-8)
def assign_delivery_with_justification(manager_id, bid_id, justification=None):
    """UC-04 Step 7-8: Assign delivery, with justification if higher bid"""
    from services.delivery_service import assign_delivery
    
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized"}, 403
    
    bid = DeliveryBid.objects(id=bid_id).first()
    if not bid:
        return {"error": "Bid not found"}, 404
    
    # Check if this is highest bid
    lowest_bid = DeliveryBid.objects(order=bid.order, status="Pending").order_by("bidAmount").first()
    if bid.amount > lowest_bid.amount and not justification:
        return {
            "error": "Justification required for accepting higher bid",
            "lowest_bid": lowest_bid.bidAmount,
            "selected_bid": bid.bidAmount
        }, 400
    
    # Use delivery service to assign
    result, status = assign_delivery(manager_id, bid_id, justification)
    return result, status

# Get flagged AI responses (UC-04 Step 9)
def get_flagged_ai_responses():
    """UC-04 Step 9: Get AI responses flagged as outrageous"""
    flagged = ChatAnswer.objects(flagged=True).order_by("-created_at")
    
    return [
        {
            "chat_id": str(c.id),
            "question": c.queryText,
            "answer": c.answerText,
            "source": c.source or "Unknown",
            "flag_reason": c.flagReason or "Marked as outrageous",
            "created_at": c.created_at
        }
        for c in flagged
    ]

# Update knowledge base from flagged response (UC-04 Step 9)
def update_kb_from_flagged(manager_id, chat_id, corrected_answer):
    """UC-04 Step 9: Correct flagged AI response and update KB"""
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized"}, 403
    
    answer = ChatAnswer.objects(id=chat_id).first()
    if not answer:
        return {"error": "Chat answer not found"}, 404
    
    # Create or update KB entry with correction
    kb_entry = KnowledgeBaseEntry(
        questionText=answer.queryText,
        answerText=corrected_answer,
        keywords=[]
    ).save()
    
    # Mark AI response as resolved
    answer.flagged = False
    answer.save()
    
    return {
        "message": "Knowledge base updated with corrected answer",
        "kb_entry_id": str(kb_entry.id)
    }, 200

# System alert for unresolved complaints (UC-04 A2)
def check_unresolved_complaints_alert():
    """UC-04 A2: Alert manager if multiple unresolved complaints"""
    pending = Complaint.objects(status="PendingReview")
    count = len(pending)
    
    if count >= 3:
        return {
            "alert": True,
            "message": f"URGENT: {count} unresolved complaints requiring action",
            "pending_count": count
        }
    
    return {
        "alert": False,
        "pending_count": count
    }

# Add knowledge base entry (legacy support)
def add_kb_entry(question, answer, keywords=None):
    entry = KnowledgeBaseEntry(
        questionText=question,
        answerText=answer,
        keywords=keywords or []
    ).save()
    return {"message": "Knowledge base entry added successfully.", "entry_id": str(entry.id)}, 201

# Update knowledge base entry (legacy support)
def update_kb_entry(entry_id, new_answer):
    entry = KnowledgeBaseEntry.objects(id=entry_id).first()
    if not entry:
        return {"error": "Knowledge base entry not found."}, 404
    
    entry.update_answer(new_answer)
    return {"message": "Knowledge base entry updated successfully."}, 200

# Get flagged chat responses (legacy support)
def get_flagged_chat_responses():
    flagged = ChatAnswer.objects(flagged=True)
    return [
        {
            "id": str(c.id),
            "question": c.queryText,
            "answer": c.answerText,
            "source": c.source,
            "created_at": c.created_at
        }
        for c in flagged
    ]

# Resolve flagged chat response (legacy support)
def resolve_flagged_chat_response(chat_id, corrected_answer):
    answer = ChatAnswer.objects(id=chat_id).first()
    if not answer:
        return {"error": "Chat answer not found."}, 404
    
    kb_entry = KnowledgeBaseEntry(
        questionText=answer.queryText,
        answerText=corrected_answer,
        keywords=[]
    ).save()
    answer.flagged = False
    answer.save()
    return {"message": "Flagged chat response resolved and knowledge base updated."}, 200