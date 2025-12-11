from mongoengine import Document, StringField, FloatField, IntField, DateTimeField, ReferenceField
import datetime
from .user import User
from .order import Order

class DeliveryBid(Document):
    deliveryPerson = ReferenceField(User, required=True)
    order = ReferenceField(Order, required=True)

    bid_amount = FloatField(required=True) # proposed bid amount
    status = StringField(
        choices = ["Pending", "Accepted", "Rejected"],
        default="Pending"
    )

    created_at = DateTimeField(default=datetime.datetime.utcnow)

    meta = {
        'collection': 'delivery_bids',
        'indexes': [
            "order",
            "deliveryPerson",
            "status"]
    }

class Delivery(Document):
    order = ReferenceField(Order, required=True)
    deliveryPerson = ReferenceField(User, required=True)

    bidAmount = FloatField(required=True)

    status = StringField(
        choices=["Assigned", "Out_For_Delivery", "Delivered", "Delivery_Failed"],
        default="Assigned"
    )
    note = StringField(default="")

    created_at = DateTimeField(default=datetime.datetime.utcnow)
    updated_at = DateTimeField(default=datetime.datetime.utcnow)

    meta = {
        "collection": "deliveries",
        "indexes": [
            "order",
            "deliveryPerson",
            "status"]
        }

    def set_status(self, new_status, note=None):
        self.status = new_status
        self.updated_at = datetime.datetime.utcnow()
        if note:
            self.note = note
        self.save()

    def attach_note(self, text):
        self.note = text
        self.save()