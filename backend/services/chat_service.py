from models.chat import ChatQuestion, ChatAnswer
from models.knowledge_base import KnowledgeBaseEntry
import datetime

# Generate a response using a generative AI model (placeholder function)
def generative_ai_response(prompt: str) -> str:
    # Placeholder for actual AI integration
    return "This is a generated response to your prompt."

# Search the knowledge base for a relevant answer
def search_knowledge_base(query):
    query = query.lower()
    entries = KnowledgeBaseEntry.objects()
    
    for entry in entries:
        if entry.keywords:
            if any(k.lower() in query for k in entry.keywords):
                return entry.answerText
            
        if entry.questionText.lower() in query:
            return entry.answerText
    return None

# Handle user question and generate answer
def ask_ai(user_id, question_text):
    chat_question = ChatQuestion(
        userId=user_id,
        queryText=question_text,
    ).save()

    kb_answer = search_knowledge_base(question_text)
    if kb_answer:
        chat_answer = ChatAnswer(
            questionId=chat_question,
            userId=user_id,
            answerText=kb_answer,
            source="KB"
        ).save()
        return {
            "answer": kb_answer,
            "source": "KB",
            "answer_id": str(chat_answer.id)
        }, 200
    
    ai_response = generative_ai_response(question_text)
    chat_answer = ChatAnswer(
        questionId=chat_question,
        userId=user_id,
        answerText=ai_response,
        source="LLM"
    ).save()

    return {
        "answer": ai_response,
        "source": "LLM",
        "answer_id": str(chat_answer.id)
    }, 200

# Rate a chat answer
def rate_answer(answer_id, rating):
    answer = ChatAnswer.objects(id=answer_id).first()
    if not answer:
        return {"error": "Chat answer not found."}, 404
    
    if rating < 0 or rating > 4:
        return {"error": "Rating must be between 0 and 4."}, 400
    
    answer.rating = rating

    if rating == 0:
        answer.flagged = True
    answer.save()
    return {"message": "Rating submitted successfully."}, 200

# Flag a chat answer for review
def flag_answer(answer_id, reason = None):
    answer = ChatAnswer.objects(id=answer_id).first()
    if not answer:
        return {"error": "Chat answer not found."}, 404
    
    answer.flagged = True
    answer.save()
    return {"message": "Answer flagged for review."}, 200

# Retrieve chat history for a user
def get_chat_history(user_id):
    questions = ChatQuestion.objects(userId=user_id).order_by("-timestamp")
    
    history = []
    for q in questions:
        answer = ChatAnswer.objects(questionId=q.id).first()

        history.append({
            "question": q.queryText,
            "timestamp": q.timestamp,
            "answer": answer.answerText if answer else None,
            "source": answer.source if answer else None,
            "rating": answer.rating if answer else None,
            "flagged": answer.flagged if answer else None
        })
    return history, 200