# NOVA

NOVA is a full-stack AI-powered chat and data ingestion platform. It enables users to interact with various data sources (CSV, PDF, web, etc.), manage chat sessions, and orchestrate specialized AI agents for different tasks. The project is built with Next.js (frontend) and Python FastAPI (backend), supporting extensible data ingestion, semantic search, and agent-based workflows.

---

## Table of Contents
- [NOVA](#nova)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Architecture](#architecture)
  - [Folder Structure](#folder-structure)
  - [Setup Instructions](#setup-instructions)
    - [Prerequisites](#prerequisites)
    - [1. Clone the Repository](#1-clone-the-repository)
    - [2. Install Frontend Dependencies](#2-install-frontend-dependencies)
    - [3. Install Backend Dependencies](#3-install-backend-dependencies)
    - [4. Set Up Environment Variables](#4-set-up-environment-variables)
    - [5. Run the Backend Server](#5-run-the-backend-server)
    - [6. Run the Frontend](#6-run-the-frontend)
  - [Frontend Usage](#frontend-usage)
  - [Backend Usage](#backend-usage)
  - [Development Commands](#development-commands)
    - [Frontend](#frontend)
    - [Backend](#backend)
  - [Extending the Platform](#extending-the-platform)
  - [Troubleshooting](#troubleshooting)
  - [Contributors](#contributors)
  - [Acknowledgements](#acknowledgements)

---

## Features
- **Chat Sessions**: Multi-agent chat with session management
- **Data Ingestion**: Import from CSV, PDF, Dev.to, GitHub, HackerNews, Reddit, StackOverflow, and web
- **Semantic Search**: Vector-based search using ChromaDB
- **Agent Orchestration**: Specialized agents for different tasks
- **Authentication**: Clerk-based authentication (backend)
- **Modern UI**: Built with Next.js, React, and Tailwind CSS

---

## Architecture
- **Frontend**: Next.js (React, TypeScript)
- **Backend**: FastAPI (Python 3.12+)
- **Database**: ChromaDB (vector store), SQLite (default)
- **Authentication**: Clerk (backend)
- **State Management**: React hooks

---

## Folder Structure
```
NOVA/
├── actions/                # Next.js server actions
├── app/                    # Next.js app directory (pages, layouts, dashboard)
├── backend/                # FastAPI backend (main.py, routes, agents, ingestion, models, utils)
│   ├── agents/             # Agent orchestration and config
│   ├── auth/               # Authentication logic
│   ├── ingestion/          # Data ingestion scripts
│   ├── models/             # Database models
│   ├── routes/             # API endpoints
│   ├── utils/              # Utility functions
│   └── vectorstore/        # ChromaDB vector store
├── components/             # React UI components
├── hooks/                  # Custom React hooks
├── lib/                    # Frontend utilities
├── public/                 # Static assets
├── vectorstore/            # ChromaDB data
├── package.json            # Frontend dependencies
├── requirements.txt        # Backend dependencies
├── README.md               # Project documentation
└── ...
```

---

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- Python (3.12+)
- [ChromaDB](https://www.trychroma.com/) (installed via pip)
- (Optional) Docker for containerized deployment

### 1. Clone the Repository
```bash
git clone https://github.com/adityavkamath/NOVA.git
cd NOVA
```

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Install Backend Dependencies
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. Set Up Environment Variables
- Create a `.env` file in `backend/` for backend secrets (e.g., Clerk, database URLs)
- (Optional) Set up environment variables for Next.js frontend if needed

### 5. Run the Backend Server
```bash
cd backend
uvicorn main:app --reload
```
- The backend will be available at `http://localhost:8000`

### 6. Run the Frontend
```bash
cd .. # from backend/
npm run dev
```
- The frontend will be available at `http://localhost:3000`

---

## Frontend Usage
- Access the dashboard at `/dashboard`
- Upload CSV/PDF files, view and chat with data
- Use sidebar to navigate between chat sessions, agents, and data sources
- Web scraping and web viewer tools available

---

## Backend Usage
- API endpoints are defined in `backend/routes/`
- Ingestion scripts in `backend/ingestion/` can be run directly for batch data import
- Agent orchestration logic in `backend/agents/`
- Vector search and embedding logic in `backend/utils/`

---

## Development Commands

### Frontend
- `npm run dev` — Start Next.js in development mode
- `npm run build` — Build for production
- `npm run lint` — Lint code with ESLint

### Backend
- `uvicorn main:app --reload` — Start FastAPI server (dev mode)
- `alembic upgrade head` — Run database migrations
- `python -m backend.ingestion.ingest_csv <file.csv>` — Ingest a CSV file

---

## Extending the Platform
- **Add a new data source**: Create a new script in `backend/ingestion/` and register its route in `backend/routes/`
- **Add a new agent**: Implement in `backend/agents/specialized_agents.py` and update orchestrator logic
- **Add a new UI component**: Place in `components/` and import in the relevant page/layout

---

## Troubleshooting
- **CORS errors**: Ensure frontend and backend are running on correct ports and CORS is enabled in FastAPI
- **Database issues**: Check ChromaDB and SQLite files in `vectorstore/`
- **Authentication errors**: Verify Clerk credentials and environment variables
- **Dependency issues**: Reinstall with `npm install` or `pip install -r requirements.txt`

---

## Contributors
- [Aditya V Kamath](https://github.com/adityavkamath)
- [Harshith Raju](https://github.com/raharsh)


---

## Acknowledgements
- [Next.js](https://nextjs.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [ChromaDB](https://www.trychroma.com/)
- [Clerk](https://clerk.com/)

---

For questions or support, open an issue on GitHub.
