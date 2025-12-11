from models.user import User
from models.complaint import Complaint
from models.knowledge_base import KnowledgeBaseEntry
from models.chat import ChatAnswer

# Manager approval of user registrations
def approve_registration(manager_id, user_id, decision, reason=None):
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized. Only managers can approve registrations."}, 403
    
    user = User.objects(id=user_id).first()
    if not user:
        return {"error": "User not found."}, 404
    
    if decision == "APPROVE":
        user.status = "Active"
    elif decision == "REJECT":
        user.status = "Rejected"
    else:
        return {"error": "Invalid decision. Use 'APPROVE' or 'REJECT'."}, 400
    
    user.save()
    return {"message": f"User {decision.lower()}ed successfully."}, 200

# Manager resolution of complaints
def resolve_complaint(manager_id, complaint_id, decision):
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized. Only managers can resolve complaints."}, 403
    
    complaint = Complaint.objects(id=complaint_id).first()
    if not complaint:
        return {"error": "Complaint not found."}, 404
    
    target = complaint.toUser
    weight = complaint.weight if complaint.isComplaint else -complaint.weight

    if decision == "VALID":
        complaint.mark_valid()

        if complaint.isComplaint:
            target.netComplaints += weight

            if target.netComplaints >= 3:
                target.demotionsCount += 1
                target.netComplaints = 0

                if target.demotionsCount >= 2:
                    target.status = "Terminated"
                else:
                    target.role = "Customer"
        
        else:
            target.netComplaints = max(0, target.netComplaints - 1)

        target.save()
    
    elif decision == "INVALID":
        complaint.mark_invalid()

        from services.user_service import apply_warning
        apply_warning(complaint.fromUser.id, "Invalid complaint filed.")
    else:
        return {"error": "Invalid decision. Use 'VALID' or 'INVALID'."}, 400
    
    return {"message": f"Complaint marked as {decision.lower()}."}, 200

# Add knowledge base entry
def add_kb_entry(question, answer, keywords=None):
    entry = KnowledgeBaseEntry(
        questionText=question,
        answerText=answer,
        keywords=keywords or []
    ).save()
    return {"message": "Knowledge base entry added successfully.", "entry_id": str(entry.id)}, 201

# Update knowledge base entry
def update_kb_entry(entry_id, new_answer):
    entry = KnowledgeBaseEntry.objects(id=entry_id).first()
    if not entry:
        return {"error": "Knowledge base entry not found."}, 404
    
    entry.update_answer(new_answer)
    return {"message": "Knowledge base entry updated successfully."}, 200

# Get flagged chat responses
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

# Resolve flagged chat response
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