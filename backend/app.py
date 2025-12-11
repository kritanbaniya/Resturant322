from flask import Flask, jsonify
from flask_cors import CORS
from mongoengine import connect
from mongoengine.errors import ValidationError, DoesNotExist
from config import MONGO_URI, DEBUG, JWT_SECRET_KEY
from werkzeug.exceptions import HTTPException


def create_app():
    app = Flask(__name__)
    CORS(app)
    connect(host=MONGO_URI)

    @app.get("/")
    def home():
        return jsonify({"message": "API is running."}), 200

    from routes.auth_routes import auth_bp
    from routes.user_routes import user_bp
    from routes.order_routes import order_bp
    from routes.chef_routes import chef_bp
    from routes.delivery_routes import delivery_bp
    from routes.manager_routes import manager_bp
    from routes.menu_routes import menu_bp
    from routes.chat_routes import chat_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(user_bp, url_prefix='/api/users')
    app.register_blueprint(order_bp, url_prefix='/api/orders')
    app.register_blueprint(chef_bp, url_prefix='/api/chefs')
    app.register_blueprint(delivery_bp, url_prefix='/api/delivery')
    app.register_blueprint(manager_bp, url_prefix='/api/manager')
    app.register_blueprint(menu_bp, url_prefix='/api/menu')
    app.register_blueprint(chat_bp, url_prefix='/api/chat')

    @app.errorhandler(ValidationError)
    def handle_validation_error(e):
        return {"error": "Validation Error", "details": str(e)}, 400
    
    @app.errorhandler(DoesNotExist)
    def handle_not_found(e):
        return jsonify({"error": "Resource not found"}), 404
    
    @app.errorhandler(Exception)
    def handle_general_error(e):
        if isinstance(e, HTTPException):
            return jsonify({
                "error": e.name,
                "details": e.description
            }), e.code

        print("Unhandled Error:", e)
        return jsonify({
            "error": "An unexpected error occurred",
            "details": str(e)
        }), 500

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=DEBUG, port=5001)