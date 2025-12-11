from functools import wraps
from flask import request, jsonify
import jwt
from config import JWT_SECRET_KEY

def token_required(f):
    """
    Decorator to verify JWT token in Authorization header
    Passes current_user dict to the route handler
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({"error": "Invalid authorization header format"}), 401
        
        if not token:
            return jsonify({"error": "Token is missing"}), 401
        
        try:
            # Decode token
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
            current_user = {
                'id': payload.get('user_id'),
                'role': payload.get('role')
            }
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        except Exception as e:
            return jsonify({"error": f"Authentication failed: {str(e)}"}), 401
        
        # Pass current_user as first argument to the route handler
        return f(current_user, *args, **kwargs)
    
    return decorated
