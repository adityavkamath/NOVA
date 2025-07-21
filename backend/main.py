from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from routes import pdf_routes, chat_routes, multi_chat_routes

from auth.clerk_auth import get_current_user

app = FastAPI(
    title="RAG AI Agent Backend",
    version="1.0.0",
    docs_url="/docs",
)

origins = [
    "http://localhost:3000", 
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pdf_routes.router, prefix="/api/pdf", tags=["PDF Upload"])
app.include_router(chat_routes.router, prefix="/api/chat", tags=["Chat Sessions"])
app.include_router(multi_chat_routes.router, prefix="/api/multi", tags=["Multi Chat"])

@app.get("/")
def read_root():
    return {"message": "Backend is running 🚀"}


# TESTING: this is just a test route
@app.get("/api/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
