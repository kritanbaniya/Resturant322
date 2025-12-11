from mongoengine import Document, StringField, IntField, ReferenceField, BooleanField, DateTimeField
import datetime
from .user import User


class ChatQuestion(Document):
    userId = ReferenceField(User, required=False)
    queryText = StringField(required=True)
    timestamp = DateTimeField(default=datetime.datetime.utcnow)

    meta = {
        "collection": "chat_questions",
        "indexes": ["userId", "timestamp"]
    }

class ChatAnswer(Document):
    questionId = ReferenceField(ChatQuestion, required=True)
    userId = ReferenceField(User, required=False)

    answerText = StringField(required=True)
    source = StringField(required=True, choices=["knowledge_base", "ai_model"])

    rating = IntField(default=None)
    flagged = BooleanField(default=False)

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

    def flag(self):
        self.flagged = True
        self.save()
