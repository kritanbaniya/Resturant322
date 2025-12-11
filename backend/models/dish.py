from mongoengine import Document, StringField, IntField, FloatField, BooleanField, ListField

class Dish(Document):
    name = StringField(required=True)
    description = StringField()
    category = StringField(required=True)
    image_url = StringField()
    price = FloatField(required=True)
    is_available = BooleanField(default=True)
    order_count = IntField(default=0)
    average_rating = FloatField(default=0.0)
    rating_count = IntField(default=0)

    tags = ListField(StringField())

    meta = {
        "collection": "dishes",
        "indexes": [
            "name",
            "category",
            "order_count",
            "average_rating",]
            }
    
    def add_rating(self, rating):
        total_rating = self.average_rating * self.rating_count
        total_rating += rating
        self.rating_count += 1
        self.average_rating = total_rating / self.rating_count
        self.save()

    def increment_order_count(self):
        self.order_count += 1
        self.save()