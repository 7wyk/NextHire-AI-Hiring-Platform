# NextHire AI v2 🚀

> **Autonomous Multi-Agent AI Recruitment Platform**
> Resume Screening · Coding IDE · AI Interviews · Candidate Ranking · Agent Dashboard

Built with **Multi-Agent Architecture + MCP + Vectorless AI + Persistent Memory**

---

## ✨ Features

| Module | Description |
|---|---|
| 🧠 **Resume AI** | Upload PDF/DOC → Agent-powered LLM screening & scoring |
| 💻 **Coding IDE** | Monaco Editor + Judge0 execution in 13+ languages + AI code review |
| 🎙️ **AI Interview** | "Alex" AI interviewer generates adaptive questions, evaluates answers |
| 🏆 **Ranking Engine** | Composite score: Resume 30% + Code 40% + Interview 30% |
| 📊 **Dashboard** | Live pipeline analytics, recent activity, quick actions |
| 🤖 **Agent Monitor** | Real-time dashboard showing all AI agent states, MCP tools, metrics |
| 💬 **AI Assistant** | Natural language recruiter assistant — "Find best candidates", "Generate test" |
| 🧬 **AI Memory** | Persistent evaluation history across sessions |
| 🔍 **Vectorless Search** | MongoDB-native candidate matching (no Pinecone required) |

---

## 🏗️ Architecture (v2)

```
Request → Controller → Supervisor Agent → Specialized Agent → MCP Tool → Database/API
                                                                   ↓
                                                            AI Memory (MongoDB)
```

### Multi-Agent System
| Agent | Responsibility |
|---|---|
| **Supervisor** | Routes tasks, coordinates workflows, handles chat |
| **Resume** | Resume screening and analysis |
| **Interview** | Question generation, answer evaluation |
| **Coding** | Code evaluation, question generation |
| **Ranking** | Candidate ranking and comparison |
| **Notification** | Real-time Socket.IO notifications |

### MCP Tool Registry
| Tool | Operations |
|---|---|
| `mongodb.*` | getCandidate, getJob, getApplications, saveScore, getSubmissions, getInterviewSessions |
| `resume.*` | extractResume, analyzeResume |
| `judge0.*` | executeCode, getExecutionResult |
| `cloudinary.*` | uploadResume |
| `notification.*` | sendNotification, broadcast |

---

## 🛠️ Tech Stack

**Frontend:** React 18 · Vite · Tailwind CSS · Framer Motion · Monaco Editor · Zustand · React Router v6

**Backend:** Node.js · Express · MongoDB Atlas · Mongoose · Socket.IO · JWT · Multer

**AI/ML:** Groq (Llama3-8b) · LangChain · Vectorless Search · AI Memory System

**Agent System:** Multi-Agent (Supervisor + 5 Specialists) · MCP Protocol · Persistent Memory

**Code Execution:** Judge0 CE via RapidAPI

**Optional:** Pinecone Vector DB (kept as fallback)

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/nexthire-ai-v2
cd nexthire-ai-v2
npm run install:all
```

### 2. Configure Environment

```bash
cp server/.env.example server/.env
# Edit server/.env with your API keys (see below)
```

**Required API Keys (all free):**

| Service | Sign Up | Key |
|---|---|---|
| MongoDB Atlas | [cloud.mongodb.com](https://cloud.mongodb.com) | `MONGODB_URI` |
| Groq LLM | [console.groq.com](https://console.groq.com) | `GROQ_API_KEY` |
| Judge0 (RapidAPI) | [rapidapi.com/judge0-official](https://rapidapi.com/judge0-official/api/judge0-ce) | `JUDGE0_API_KEY` |
| Pinecone (optional) | [app.pinecone.io](https://app.pinecone.io) | `PINECONE_API_KEY` |

**v2-specific settings:**
```env
USE_VECTORLESS=true    # Use MongoDB-native search instead of Pinecone
```

### 3. Run Dev Servers

```bash
# From project root – runs both client and server concurrently
npm run dev

# Or run separately:
# Terminal 1 (backend):  cd server && npm run dev  → http://localhost:5000
# Terminal 2 (frontend): cd client && npm run dev  → http://localhost:5173
```

---

## 📁 Project Structure

```
nexthire-ai-v2/
├── client/                         # React + Vite frontend
│   └── src/
│       ├── pages/
│       │   ├── agents/AgentMonitor.jsx      # ★ v2: Agent dashboard
│       │   ├── auth/                        # Login, Register
│       │   ├── dashboard/                   # Analytics dashboard
│       │   ├── jobs/                        # Job management
│       │   ├── candidates/                  # Pipeline table
│       │   ├── resume/                      # AI resume screener
│       │   ├── coding/                      # Monaco IDE + Judge0
│       │   ├── interview/                   # AI chat interview
│       │   └── ranking/                     # Candidate rankings
│       ├── components/
│       │   ├── RecruiterAssistant.jsx        # ★ v2: Floating AI chat
│       │   ├── CandidateAIProfile.jsx       # ★ v2: AI insights card
│       │   ├── Sidebar.jsx                  # Navigation (updated)
│       │   └── Navbar.jsx
│       └── store/
│           ├── authStore.js
│           └── agentStore.js                # ★ v2: Agent Zustand store
│
└── server/
    ├── agents/                              # ★ v2: Multi-Agent System
    │   ├── base.agent.js                    # Base class
    │   ├── supervisor.agent.js              # Central orchestrator
    │   ├── resume.agent.js
    │   ├── interview.agent.js
    │   ├── coding.agent.js
    │   ├── ranking.agent.js
    │   └── notification.agent.js
    ├── mcp/                                 # ★ v2: MCP Tool Layer
    │   ├── base.mcp.js                      # MCPTool + MCPRegistry
    │   ├── mongodb.mcp.js
    │   ├── resume.mcp.js
    │   ├── judge0.mcp.js
    │   ├── cloudinary.mcp.js
    │   └── notification.mcp.js
    ├── memory/                              # ★ v2: AI Memory System
    │   ├── candidate.memory.js
    │   ├── interview.memory.js
    │   └── recruiter.memory.js
    ├── models/
    │   ├── AgentMemory.js                   # ★ v2: Memory schema
    │   ├── User.js, Job.js, Candidate.js
    │   ├── Application.js, Submission.js
    │   ├── CodingTest.js, InterviewSession.js
    │   └── Problem.js
    ├── services/
    │   ├── vectorless.service.js             # ★ v2: MongoDB-native search
    │   ├── ai.service.js                     # Groq LLM
    │   ├── interview.service.js
    │   ├── judge0.service.js
    │   ├── ranking.service.js
    │   ├── cloudinary.service.js
    │   └── vector.service.js                 # Pinecone (fallback)
    ├── controllers/                          # All refactored for agents
    ├── routes/
    │   ├── agent.routes.js                   # ★ v2: Agent API routes
    │   └── (auth, job, candidate, resume, code, interview, etc.)
    └── index.js                              # Express + MCP registration
```

---

## 🔑 API Endpoints

### Original APIs (preserved)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET/POST | `/api/jobs` | List / create jobs |
| GET | `/api/candidates` | List candidates |
| PATCH | `/api/candidates/:id/status` | Update pipeline stage |
| POST | `/api/resume/screen` | AI resume screening |
| POST | `/api/code/run` | Execute code (Judge0) |
| POST | `/api/coding-test/generate` | Generate coding test |
| POST | `/api/interview/sessions` | Start AI interview |

### v2 Agent APIs (new)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/agents/status` | All agent statuses + metrics |
| GET | `/api/agents/tools` | List registered MCP tools |
| POST | `/api/agents/chat` | Natural language AI assistant |
| POST | `/api/agents/execute` | Execute a specific agent task |
| POST | `/api/agents/search-candidates` | Vectorless candidate search |

---

## 🌐 Deployment (Free Tier)

### Backend → Render.com

1. Push the `server/` folder to GitHub
2. New Web Service → connect repo
3. Build: `npm install` · Start: `node index.js`
4. Add environment variables from `.env.example`

### Frontend → Vercel

```bash
cd client
npm run build
npx vercel --prod
```

Set `VITE_API_URL` = your Render backend URL in Vercel environment settings.

---

## 🤝 License

MIT — Free to use, fork, and build upon.
