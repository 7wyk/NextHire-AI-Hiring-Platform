# NextHire AI v2 — Progress Report

> Generated: 2026-06-16
> Architecture: Multi-Agent + MCP + Vectorless + AI Memory

---

## Current Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                   │
│  App.jsx → AgentMonitor, RecruiterAssistant,         │
│            CandidateAIProfile, agentStore             │
└────────────────────┬────────────────────────────────┘
                     │ Axios / Socket.IO
                     ▼
┌─────────────────────────────────────────────────────┐
│                  Express API Server                  │
│                                                      │
│  Controllers (resume, interview, codingTest,          │
│               candidate, auth, dashboard, etc.)       │
│         │                                            │
│         ▼                                            │
│  ┌─────────────────────────────────────────┐         │
│  │        Supervisor Agent                  │         │
│  │  Routes tasks by type → child agents     │         │
│  │  Handles chat (natural language)          │         │
│  │  Coordinates multi-step workflows         │         │
│  └────┬────┬────┬────┬────┬────────────────┘         │
│       │    │    │    │    │                           │
│       ▼    ▼    ▼    ▼    ▼                           │
│  Resume  Interview  Coding  Ranking  Notification    │
│  Agent   Agent      Agent   Agent    Agent           │
│       │    │    │    │    │                           │
│       ▼    ▼    ▼    ▼    ▼                           │
│  ┌─────────────────────────────────────────┐         │
│  │        MCP Tool Registry                 │         │
│  │  mongodb.*  │ resume.*  │ judge0.*       │         │
│  │  cloudinary.* │ notification.*           │         │
│  └────┬────────────────────────────────────┘         │
│       │                                              │
│       ▼                                              │
│  ┌────────────┐  ┌───────────┐  ┌──────────┐        │
│  │  MongoDB   │  │  Judge0   │  │Cloudinary│        │
│  │  + Memory  │  │  (Code)   │  │ (Files)  │        │
│  └────────────┘  └───────────┘  └──────────┘        │
│                                                      │
│  Vectorless Service (MongoDB-native search)          │
│  AI Memory System (candidate, interview, recruiter)  │
└─────────────────────────────────────────────────────┘
```

---

## Completed

### Backend — Agent System (7 files)
| File | Role |
|------|------|
| `server/agents/base.agent.js` | Base class with status tracking, metrics, history |
| `server/agents/supervisor.agent.js` | Central orchestrator, task routing, chat, workflows |
| `server/agents/resume.agent.js` | Resume screening and analysis |
| `server/agents/interview.agent.js` | Interview question generation and evaluation |
| `server/agents/coding.agent.js` | Code evaluation and question generation |
| `server/agents/ranking.agent.js` | Candidate ranking and comparison |
| `server/agents/notification.agent.js` | Real-time notifications via Socket.IO |

### Backend — MCP Tools (6 files)
| File | Tools Provided |
|------|---------------|
| `server/mcp/base.mcp.js` | MCPTool base class, MCPRegistry singleton |
| `server/mcp/mongodb.mcp.js` | getCandidate, getJob, getApplications, saveScore, getSubmissions, getInterviewSessions |
| `server/mcp/resume.mcp.js` | extractResume, analyzeResume |
| `server/mcp/judge0.mcp.js` | executeCode, getExecutionResult |
| `server/mcp/cloudinary.mcp.js` | uploadResume |
| `server/mcp/notification.mcp.js` | sendNotification, broadcast |

### Backend — AI Memory (4 files)
| File | Purpose |
|------|---------|
| `server/models/AgentMemory.js` | Mongoose schema with TTL, text index, compound indexes |
| `server/memory/candidate.memory.js` | Resume evals, coding results, interview results, history |
| `server/memory/interview.memory.js` | Conversation turns, session summaries, question history |
| `server/memory/recruiter.memory.js` | Hiring decisions, search queries, preferences, actions |

### Backend — Vectorless Service
| File | Purpose |
|------|---------|
| `server/services/vectorless.service.js` | MongoDB-native candidate search replacing Pinecone vectors |

### Backend — Controller Refactoring (4 controllers wired)
| Controller | Agent Integration |
|-----------|------------------|
| `resume.controller.js` | supervisorAgent → resume-screening + memory storage |
| `interview.controller.js` | supervisorAgent → interview generation/evaluation + memory |
| `codingTest.controller.js` | supervisorAgent → question gen + code eval + memory + notifications |
| `candidate.controller.js` | supervisorAgent → rankings + hiring decisions + AI history |

### Backend — Integration
| File | Changes |
|------|---------|
| `server/index.js` | MCP tool registration, agent routes, socket injection |
| `server/routes/agent.routes.js` | /status, /tools, /chat, /execute, /search-candidates |

### Frontend — v2 Components (4 new files)
| File | Purpose |
|------|---------|
| `client/src/store/agentStore.js` | Zustand store: agent status, chat, vectorless search |
| `client/src/pages/agents/AgentMonitor.jsx` | Real-time agent dashboard with auto-refresh |
| `client/src/components/RecruiterAssistant.jsx` | Floating AI chat widget for recruiters |
| `client/src/components/CandidateAIProfile.jsx` | AI insights card: scores, skills, strengths, weaknesses |

### Frontend — Updated Files (2 files)
| File | Changes |
|------|---------|
| `client/src/App.jsx` | Added /agent-monitor route, RecruiterAssistant overlay |
| `client/src/components/Sidebar.jsx` | Added Agent Monitor link with Brain icon |

---

## Preserved Existing Features

All original v1 features remain fully operational:

- ✅ Authentication (JWT, role-based)
- ✅ Recruiter dashboard
- ✅ Candidate dashboard
- ✅ Job management (CRUD)
- ✅ Application system
- ✅ Resume upload (Cloudinary)
- ✅ AI resume screening (Groq LLM)
- ✅ AI interview system ("Alex")
- ✅ Coding IDE (Monaco Editor)
- ✅ Judge0 code execution
- ✅ AI code review
- ✅ Candidate ranking
- ✅ Real-time notifications (Socket.IO)
- ✅ Pinecone (kept as optional fallback)

---

## Remaining / Future Improvements

### Nice-to-Have Enhancements
- [ ] End-to-end automated tests for the agent pipeline
- [ ] Agent execution history persistence to MongoDB
- [ ] Agent analytics dashboard (task durations, error rates over time)
- [ ] LLM-powered intent parsing (replace keyword-based `_parseIntent`)
- [ ] Streaming chat responses in RecruiterAssistant
- [ ] Role-based access to specific agent tools
- [ ] Agent workflow templates (multi-step pipelines)
- [ ] Memory TTL configuration via admin panel
- [ ] WebSocket-based live agent status updates (instead of polling)

### Production Hardening
- [ ] Rate limiting on agent chat endpoint
- [ ] Input validation/sanitization on agent execute endpoint
- [ ] Agent health checks and circuit breakers
- [ ] Monitoring/alerting integration (Datadog, Sentry)

---

## How to Run

### Backend
```bash
cd server
npm install
npm run dev          # Starts on PORT 5000
```

### Frontend
```bash
cd client
npm install
npm run dev          # Starts on PORT 5173
```

### Environment Variables (server/.env)
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
GROQ_API_KEY=...
JUDGE0_API_KEY=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLIENT_URL=http://localhost:5173
USE_VECTORLESS=true
```
