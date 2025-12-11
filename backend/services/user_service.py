from models.user import User
from werkzeug.security import generate_password_hash, check_password_hash
from config import JWT_SECRET_KEY
import jwt
import datetime

# Generate JWT token for authenticated user
def generate_token(user):
    payload = {
        "user_id": str(user.id),
        "role": user.role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }
    token = jwt.encode(payload, JWT_SECRET_KEY, algorithm='HS256')
    return token

# Register new customer
def register_customer(data):
    email = data.get("email")
    password = data.get("password")
    name = data.get("name")

    if User.objects(email=email).first():
        raise ValueError("Email already registered")
    
    hashed = generate_password_hash(password)

    user = User(
        email=email,
        password_hash=hashed,
        name=name,
        role="Customer",
        status="PendingApproval"
    ).save()

    return {"message": "Registration successful, pending approval.", "user_id": str(user.id)}

def process_registration_approval(manager_id, user_id, decision, reason=None):
    # Verify manager role
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
        user.rejectionReason = reason
    else:
        return {"error": "Invalid decision. Use 'APPROVE' or 'REJECT'."}, 400
    
    user.save()
    return {"message": f"User {decision.lower()}ed."}, 200
    
def login_user(email, password):
    user = User.objects(email=email).first()
    if not user:
        return {"error": "Invalid email or password."}, 401
        
    if user.status in ["Rejected", "Blacklisted"]:
        return {"error": "Account is not allowed to login."}, 403
        
    if not check_password_hash(user.password_hash, password):
        return {"error": "Invalid email or password."}, 401
        
    token = generate_token(user)
    return {"token": token, "role": user.role, "user_id": str(user.id)}, 200
    
def deposit_money(user_id, amount):
    user = User.objects(id=user_id).first()
    if not user:
        return {"error": "User not found."}, 404
        
    if amount <= 0:
        return {"error": "Deposit amount must be positive."}, 400
        
    user.balance += amount
    user.save()
    return {"message": f"Deposited ${amount:.2f}. New balance: ${user.balance:.2f}."}, 200

def apply_warning(user_id, reason=""):
    """
    UC-01 A3: Warnings
    - Regular Customers: 3 warnings → Deregistered
    - VIPs: 2 warnings → Demoted to Customer (warnings cleared)
    """
    user = User.objects(id=user_id).first()
    if not user:
        return
        
    user.warningCount += 1

    if user.role in ["Customer", "VIP"]:
        if user.role == "VIP": # Warning for VIP customer
            if user.warningCount >= 2:
                user.isVIP = False
                user.role = "Customer"
                user.warningCount = 0
        else: # Regular customer
            if user.warningCount >= 3:
                user.status = "Deregistered"
                user.save()
                return
    
    user.save()

def apply_complaint_effect(employee_id, entity_type, weight):
    """
    Apply complaint effect to employee (Chef or DeliveryPerson)
    Rules:
    - netComplaints += weight
    - If netComplaints >= 3:
      - First time: Demote (role = "Demoted_Chef" or "Demoted_DeliveryPerson")
      - Second time: Terminate (status = "Terminated")
    """
    employee = User.objects(id=employee_id).first()
    if not employee:
        return False
    
    employee.netComplaints += weight
    
    # Only apply demotion/termination to Chef and DeliveryPerson
    if entity_type in ["Chef", "DeliveryPerson"] and employee.netComplaints >= 3:
        if employee.demotionsCount == 0:
            # First demotion
            employee.role = f"Demoted_{entity_type}"
            employee.demotionsCount += 1
            employee.netComplaints = 0  # Reset after demotion
        elif employee.demotionsCount >= 1:
            # Second demotion = termination
            employee.status = "Terminated"
    
    employee.save()
    return True

def update_vip_status(customer_id):
    user = User.objects(id=customer_id).first()
    if not user or user.role not in ["Customer", "VIP"]:
        return False
    
    if user.warningCount > 0:
        return False
    
    if user.totalSpent > 100 or user.orderCount >= 3:
        user.isVIP = True
        user.role = "VIP"
        user.save()
        return True
    return False
    
def blacklist_user(manager_id, user_id):
    manager = User.objects(id=manager_id).first()
    if not manager or manager.role != "Manager":
        return {"error": "Unauthorized. Only managers can blacklist users."}, 403
    
    user = User.objects(id=user_id).first()
    if not user:
        return {"error": "User not found."}, 404
    
    user.status = "Blacklisted"
    user.save()
    return {"message": "User has been blacklisted."}, 200
            
