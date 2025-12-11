from mongoengine import Document, StringField, ListField, DateTimeField
import datetime

class KnowledgeBaseEntry(Document):
    questionText = StringField(required=True)
    answerText = StringField(required=True)

    keywords = ListField(StringField())

    created_at = DateTimeField(default=datetime.datetime.utcnow)
    updated_at = DateTimeField(default=datetime.datetime.utcnow)
    meta = {
        "collection": "knowledge_base",
        "indexes": [
            "questionText",
            "keywords"
        ]
    }

    def update_answer(self, new_answer):
        self.answerText = new_answer
        self.updated_at = datetime.datetime.utcnow()
        self.save()