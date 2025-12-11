from mongoengine import Document, StringField, FloatField, IntField, ReferenceField, BooleanField, DateTimeField
import datetime
from .user import User
from .order import Order

class Complaint(Document):
    fromUser = ReferenceField(User, required=True)
    toUser = ReferenceField(User)
    targetId = StringField()
    entityType = StringField(required=True)
    
    # is complaint or compliment
    isComplaint = BooleanField(required=True)
    message = StringField()
    
    # Star rating (0-5, 0 means no rating)
    rating = IntField(default=0, min_value=0, max_value=5)

    weight = IntField(default=1)  # vip: 2, regular: 1

    status = StringField(
        choices=["PendingReview", "Valid", "Invalid"],
        default="PendingReview"
    )

    order = ReferenceField(Order)
    created_at = DateTimeField(default=datetime.datetime.utcnow)
    resolved_at = DateTimeField()

    meta = {
        "collection": "complaints",
        "indexes": [
            "toUser",
            "fromUser",
            "status",
            "isComplaint"]
    }

    def mark_valid(self):
        self.status = "Valid"
        self.resolved_at = datetime.datetime.utcnow()
        self.resolved_at = datetime.datetime.utcnow()
        self.save()

    def mark_invalid(self):
        self.status = "Invalid"
        self.resolved_at = datetime.datetime.utcnow()
        self.save()