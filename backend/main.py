from fastapi import FastAPI, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from backend.routes import pdf_routes, chat_routes, multi_chat_routes, csv_routes, web_routes, agent_routes

from backend.auth.clerk_auth import get_current_user

app = FastAPI(
    title="RAG AI Agent Backend",
    version="1.0.0",
    docs_url="/docs",
)

origins = [
    "http://localhost:3000",
    "http://localhost:3002",
    "http://localhost:3003",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:3003",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.middleware("http")
async def handle_cors_preflight(request: Request, call_next):
    if request.method == "OPTIONS":
        response = Response()
        origin = request.headers.get("origin")
        if origin in ["http://localhost:3000", "http://localhost:3002", "http://localhost:3003", "http://127.0.0.1:3000", "http://127.0.0.1:3002", "http://127.0.0.1:3003"]:
            response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        return response
    
    response = await call_next(request)
    return response

app.include_router(pdf_routes.router, prefix="/api/pdf", tags=["PDF Upload"])
app.include_router(csv_routes.router, prefix="/api/csv", tags=["CSV Upload"])
app.include_router(web_routes.router, prefix="/api/web", tags=["Web Scraping"])
app.include_router(chat_routes.router, prefix="/api/chat", tags=["Chat Sessions"])
app.include_router(multi_chat_routes.router, prefix="/api/multi", tags=["Multi Chat"])
app.include_router(agent_routes.router, prefix="/api/agents", tags=["AutoGen Agents"])

@app.get("/")
def read_root():
    return {"message": "Backend is running 🚀"}

@app.get("/api/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
