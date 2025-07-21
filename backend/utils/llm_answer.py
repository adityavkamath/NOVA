import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# Initialize OpenAI client
try:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    print("✅ OpenAI client initialized")
except Exception as e:
    print(f"❌ Error initializing OpenAI client: {e}")
    client = None

def is_python_question(question: str) -> bool:
    """Check if the question is related to Python programming"""
    if not client:
        print("❌ OpenAI client not initialized, defaulting to allow question")
        return True
        
    python_keywords = [
        'python', 'django', 'flask', 'fastapi', 'pandas', 'numpy', 'pip', 'conda',
        'virtualenv', 'pytest', 'jupyter', 'anaconda', 'pypi', 'tkinter', 'pygame',
        'matplotlib', 'scikit-learn', 'tensorflow', 'pytorch', 'scipy', 'requests',
        'beautifulsoup', 'selenium', 'sqlalchemy', 'pydantic', 'asyncio', 'multiprocessing',
        'opencv', 'pillow', 'kivy', 'pyqt', 'streamlit', 'gradio', 'pyspark'
    ]
    
    question_lower = question.lower()
    if any(keyword in question_lower for keyword in python_keywords):
        print(f"✅ Python keyword detected in: {question}")
        return True

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": """You are a binary classifier. Answer with only 'yes' or 'no'. 
                    
    Classify as 'yes' if the question is about:
    - Python programming language
    - Python libraries/frameworks (Django, Flask, Pandas, NumPy, etc.)
    - Python tools (pip, conda, virtualenv, etc.)
    - Python development practices
    - Python syntax, features, or concepts

    Classify as 'no' only if the question is clearly about:
    - Other programming languages (JavaScript, Java, C++, etc.)
    - Non-programming topics (sports, politics, general knowledge, etc.)

    Question:"""
                },
                {
                    "role": "user",
                    "content": question
                }
            ],
            temperature=0,
            max_tokens=5,
        )
        reply = response.choices[0].message.content.strip().lower()
        result = reply.startswith("yes")
        print(f"🤖 LLM classification for '{question}': {reply} -> {result}")
        return result
    except Exception as e:
        print(f"❌ Error in LLM classification: {e}")
        # Default to allowing the question if LLM fails
        return True

def generate_answer(question: str, context: str, source: str) -> str:
    """Generate an answer using OpenAI with the provided context"""
    if not client:
        return "❌ Sorry, the AI service is not available right now. Please try again later."
        
    system_prompt = f"""
    You are a technical assistant specialized **only in Python**. You strictly answer questions **related to Python programming**.

    ✅ If it is Python-related, provide a clear and concise answer, optionally with code if helpful.

    Use the following relevant context extracted from platforms like Reddit, StackOverflow, GitHub, DevTo, HackerNews etc.
    Source: {source}
    """

    user_prompt = f"""Relevant Context:\n{context}\n\nUser Question:\n{question}"""

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt.strip()},
                {"role": "user", "content": user_prompt.strip()},
            ],
            temperature=0.2,
            max_tokens=512,
        )

        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"❌ Error generating answer: {e}")
        return f"I apologize, but I encountered an error while generating the answer: {str(e)}"
