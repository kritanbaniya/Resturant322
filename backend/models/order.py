from mongoengine import Document, StringField, FloatField, IntField, ListField, EmbeddedDocument, EmbeddedDocumentField, ReferenceField, DateTimeField
import datetime
from .user import User
from .dish import Dish

class OrderItem(EmbeddedDocument):
    dish = ReferenceField(Dish, required=True)
    quantity = IntField(required=True, min_value=1)
    price = FloatField(required=True)

class Order(Document):
    customer = ReferenceField(User, required=True)
    items = ListField(EmbeddedDocumentField(OrderItem), default=[])

    original_price = FloatField(default=0.0) # total before discounts for VIP users
    discount_applied = FloatField(default=0.0) # discount amount for VIP users
    final_price = FloatField(default=0.0) # total after discounts

    status = StringField(
        required=True,
        choices=["PendingPayment",
                 "Paid",
                 "Rejected_Insufficient_Funds",
                 "Queued_For_Preparation",
                 "In_Preparation",
                 "On_Hold",
                 "Ready_For_Delivery",
                 "Awaiting_Pickup",
                 "Out_For_Delivery",
                 "Completed",
                 "Delivery_Failed"
                 ],
        default="PendingPayment"
    )
    notes = StringField(default="")
    created_at = DateTimeField(default=datetime.datetime.utcnow)
    updated_at = DateTimeField(default=datetime.datetime.utcnow)

    meta = {
        "collection": "orders",
        "indexes": [
            "customer",
            "status",
            "created_at",
        ]
    }
    def calculate_total_price(self):
        total = sum(item.price * item.quantity for item in self.items)
        self.original_price = total
        if self.customer.isVIP:
            self.discount_applied = round(total * 0.1, 2)  # 10% discount for VIPs
        else:
            self.discount_applied = 0.0

        self.final_price = total - self.discount_applied
        self.save()
    
    def set_status(self, new_status):
        self.status = new_status
        self.updated_at = datetime.datetime.utcnow()
        self.save()
    
    def add_note(self, text):
        self.notes = text
        self.save()
    
    def increment_dish_order_counts(self):
        for item in self.items:
            item.dish.increment_order_count()