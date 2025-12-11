from models.chat import ChatQuestion, ChatAnswer
from models.knowledge_base import KnowledgeBaseEntry
import datetime

"""
UC-05: View Menu (Visitor)
Actor: Visitor (unauthenticated user)

Preconditions: Visitor has access to system interface

Main Flow:
1. Visitor enters AI System (possibly for first time)
2. Visitor can browse menus
3. Visitor can use AI chatbot for questions
4. Visitor can choose to register (A1)

Alternate Flows:
A1: Registration Attempt - redirect to registration form
A2: AI Unavailable - display "AI assistance temporarily unavailable"

Postconditions: Visitor actions logged (chat interactions, ratings)
"""

# Track AI service availability
ai_service_available = True

# Generate a response using a generative AI model (placeholder function)
def generative_ai_response(prompt: str) -> str:
    """UC-05 A2: Check if AI is available before responding"""
    global ai_service_available
    
    if not ai_service_available:
        return None  # AI is offline
    
    # Placeholder for actual AI integration
    return "This is a generated response to your prompt."

# Search the knowledge base for a relevant answer
def search_knowledge_base(query):
    """UC-05 Step 3: Search KB for answers to visitor questions"""
    query = query.lower()
    entries = KnowledgeBaseEntry.objects()
    
    for entry in entries:
        if entry.keywords:
            if any(k.lower() in query for k in entry.keywords):
                return entry.answerText
            
        if entry.questionText.lower() in query:
            return entry.answerText
    return None

# Handle user question and generate answer (UC-05 Step 3)
def ask_ai(user_id, question_text):
    """UC-05 Step 3: Ask AI chatbot for general inquiries
    
    Args:
        user_id: Optional user ID (None for visitors)
        question_text: The question from visitor/customer
        
    Returns:
        Dict with answer, source, and answer_id
    """
    global ai_service_available
    
    # UC-05 A2: Check if AI service is available
    if not ai_service_available:
        return {
            "error": "AI assistance temporarily unavailable.",
            "message": "The AI chat service is currently offline. Please try again later."
        }, 503
    
    chat_question = ChatQuestion(
        userId=user_id,
        queryText=question_text,
    ).save()

    # Try KB first
    kb_answer = search_knowledge_base(question_text)
    if kb_answer:
        chat_answer = ChatAnswer(
            questionId=chat_question,
            userId=user_id,
            queryText=question_text,
            answerText=kb_answer,
            source="knowledge_base"
        ).save()
        return {
            "answer": kb_answer,
            "source": "knowledge_base",
            "answer_id": str(chat_answer.id)
        }, 200
    
    # Fall back to LLM
    ai_response = generative_ai_response(question_text)
    if not ai_response:
        # UC-05 A2: AI is offline
        return {
            "error": "AI assistance temporarily unavailable.",
            "message": "The LLM service is currently offline. Please try again later."
        }, 503
    
    chat_answer = ChatAnswer(
        questionId=chat_question,
        userId=user_id,
        queryText=question_text,
        answerText=ai_response,
        source="ai_model"
    ).save()

    return {
        "answer": ai_response,
        "source": "ai_model",
        "answer_id": str(chat_answer.id)
    }, 200

# Rate a chat answer (UC-05: Visitor interactions are logged)
def rate_answer(answer_id, rating):
    """UC-05 Postcondition: Log visitor rating of AI responses"""
    answer = ChatAnswer.objects(id=answer_id).first()
    if not answer:
        return {"error": "Chat answer not found."}, 404
    
    if rating < 0 or rating > 5:
        return {"error": "Rating must be between 0 and 5."}, 400
    
    answer.rating = rating

    # Flag if rating is 0 (very poor)
    if rating == 0:
        answer.flagged = True
    answer.save()
    return {"message": "Rating submitted successfully."}, 200

# Flag a chat answer for review (UC-05: Visitor interactions logged)
def flag_answer(answer_id, reason=None):
    """UC-05 Postcondition: Log visitor flagging outrageous responses"""
    answer = ChatAnswer.objects(id=answer_id).first()
    if not answer:
        return {"error": "Chat answer not found."}, 404
    
    answer.flagged = True
    answer.flagReason = reason or "Flagged by user"
    answer.save()
    return {
        "message": "Answer flagged for review.",
        "note": "Thank you for your feedback. Our management team will review this response."
    }, 200

# Retrieve chat history for a user/visitor
def get_chat_history(user_id):
    """Get chat history (for logged-in users only, not visitors)"""
    if not user_id:
        return None  # Visitors don't have persistent history
    
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
    
    return history

# Set AI service availability (for admin use)
def set_ai_availability(available: bool):
    """UC-05 A2: Set whether AI service is available"""
    global ai_service_available
    ai_service_available = available
    return {
        "message": f"AI service {'enabled' if available else 'disabled'}",
        "available": ai_service_available
    }, 200

# Get AI service status
def get_ai_status():
    """UC-05 A2: Check if AI service is currently available"""
    global ai_service_available
    return {
        "available": ai_service_available,
        "status": "online" if ai_service_available else "offline"
    }, 200
    return history, 200