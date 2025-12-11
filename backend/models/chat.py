from mongoengine import Document, StringField, IntField, ReferenceField, BooleanField, DateTimeField
import datetime
from .user import User

# ChatQuestion model to store user queries
class ChatQuestion(Document):
    userId = ReferenceField(User, required=False)
    queryText = StringField(required=True)
    timestamp = DateTimeField(default=datetime.datetime.utcnow)

    meta = {
        "collection": "chat_questions",
        "indexes": ["userId", "timestamp"]
    }

# ChatAnswer model to store AI responses
class ChatAnswer(Document):
    questionId = ReferenceField(ChatQuestion, required=True)
    userId = ReferenceField(User, required=False)
    
    queryText = StringField()  # Store question text for quick access

    answerText = StringField(required=True)
    source = StringField(required=True, choices=["knowledge_base", "ai_model"])

    rating = IntField(default=None)
    flagged = BooleanField(default=False)
    flagReason = StringField()  # Reason for flagging (UC-04 A3)

    created_at = DateTimeField(default=datetime.datetime.utcnow)

    meta = {
        "collection": "chat_answers",
        "indexes": [
            "questionId",
            "userId",
            "source",
            "flagged",
            "created_at"
        ]
    }

    def set_rating(self, rating):
        self.rating = rating
        if rating == 0:
            self.flagged = True
        self.save()

    def flag(self, reason=None):
        self.flagged = True
        self.flagReason = reason or "Flagged for review"
        self.save()
