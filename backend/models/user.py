from mongoengine import Document, StringField, IntField, FloatField, BooleanField, EmailField, DateTimeField
import datetime

class User(Document):

    #personal info
    email = EmailField(required=True, unique=True)
    password_hash = StringField(required=True)
    name = StringField(required=True)
    phone = StringField()
    address = StringField()

    #role
    role = StringField(
        required=True,
        choices=["Customer", "VIP", "Chef", "DeliveryPerson", "Manager"],
        default="Customer"
    )

    #status
    status = StringField(
        required=True,
        choices=["Active", "PendingApproval", "Rejected", "Blacklisted"],
        default="PendingApproval"
    )

    #financial
    balance = FloatField(default=0.0)
    totalSpent = FloatField(default=0.0)
    orderCount = IntField(default=0)
    isVIP = BooleanField(default=False)

    warningCount = IntField(default=0)
    netComplaints = IntField(default=0)
    demotionsCount = IntField(default=0)

    created_at = DateTimeField(default=datetime.datetime.utcnow)
    updated_at = DateTimeField(default=datetime.datetime.utcnow)

    meta = {
        "collection": "users",
        "indexes": [
            "email"
        ]
    }

    def increment_warning(self):
        self.warningCount += 1
        self.save()

    def add_spent(self, amount):
        self.totalSpent += amount
        self.orderCount += 1
        self.save()
    
    def upgrade_to_vip(self):
        if not self.isVIP and self.warningCount == 0:
            if self.totalSpent > 100 or self.orderCount >=3:
                self.isVIP = True
                self.save()
                self.role = "VIP"
                return True
        return False