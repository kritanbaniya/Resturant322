import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/ai_eats")

JWT_SECRET_KEY = os.getenv("JWT_SECRET", "supersecretkey")

DEBUG = os.getenv("DEBUG", "True") == "True"