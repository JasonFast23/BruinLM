# BruinLM - UCLA Course Assistant

A full-stack web application that provides an AI-powered course assistant for UCLA students. The application allows students to chat with AI about course content and materials.

## Features

- 🤖 AI-powered chat assistant for course materials
- 📚 Document upload and processing
- 🏫 Class room management
- 👥 User authentication and authorization
- 📱 Responsive web interface
- 🌙 Dark/Light theme support

## Tech Stack

### Frontend
- React.js
- CSS3 with modern styling
- Context API for state management

### Backend
- Node.js with Express
- PostgreSQL database
- WebSocket support for real-time chat
- AI service integration
- File upload handling

## Project Structure

```
bruinlm/
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Main application pages
│   │   ├── context/       # React context providers
│   │   └── services/      # API service layer
│   └── public/
├── backend/           # Node.js backend server
│   ├── backend/
│   │   ├── routes/        # API route handlers
│   │   ├── scripts/       # Database scripts and utilities
│   │   └── uploads/       # File upload directory
│   └── package.json
└── ucla_courses.json  # Course data
```

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd bruinlm
```

2. Install backend dependencies
```bash
cd backend
npm install
```

3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

4. Set up the database
```bash
cd backend/backend
node scripts/setup_tables.js
```

**Note:** Before running the setup script, make sure to:
- Create a `.env` file in `backend/backend/` (copy from `.env.example`)
- Set your `DATABASE_URL`, `JWT_SECRET`, and `OPENAI_API_KEY` in the `.env` file
- Ensure PostgreSQL database "bruinlm" exists and pgvector extension is installed

### Running the Application

1. Start the backend server
```bash
cd backend
npm start
```

2. Start the frontend development server
```bash
cd frontend
npm start
```

The application will be available at `http://localhost:3000`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## BruinLM Sequence Diagram - Behavioral View

For real-time character-by-character streaming (using Server-Sent Events):

```
┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│user: User   │   │frontend:React│   │backend:      │   │db:PostgreSQL │   │openai:OpenAI │
│             │   │              │   │Express       │   │              │   │              │
└──────┬──────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                 │                  │                  │                  │
       │  1. User enters │                  │                  │                  │
       │  question and   │                  │                  │                  │
       │  clicks send    │                  │                  │                  │
       ├────────────────>│                  │                  │                  │
       │                 │                  │                  │                  │
       │                 │ 2. GET /api/chat/ai-stream/:classId                   │
       │                 │    ?question=... │                  │                  │
       │                 ├─────────────────>│                  │                  │
       │                 │                  │                  │                  │
       │                 │                  │ 3. Verify user authentication       │
       │                 │                  │ (JWT middleware) │                  │
       │                 │                  ├──────────────────┤                  │
       │                 │                  │                  │                  │
       │                 │ ┌────────────────┴────────────┐     │                  │
       │                 │ │ Set SSE headers:            │     │                  │
       │                 │ │ Content-Type: text/event-   │     │                  │
       │                 │ │ stream                      │     │                  │
       │                 │ └────────────────┬────────────┘     │                  │
       │                 │                  │                  │                  │
       │                 │                  │ 4. SELECT ai_name FROM classes      │
       │                 │                  │    WHERE id = classId               │
       │                 │                  ├─────────────────>│                  │
       │                 │                  │                  │                  │
       │                 │                  │ 5. Return class info (ai_name)      │
       │                 │                  │<─────────────────┤                  │
       │                 │                  │                  │                  │
       │                 │                  │ 6. INSERT placeholder message       │
       │                 │                  │    status='generating'              │
       │                 │                  ├─────────────────>│                  │
       │                 │                  │                  │                  │
       │                 │                  │ 7. Return messageId                 │
       │                 │                  │<─────────────────┤                  │
       │                 │                  │                  │                  │
       │                 │                  │ ┌────────────────────────────┐      │
       │                 │                  │ │ RAG Pipeline (aiService.js)│      │
       │                 │                  │ └────────────────────────────┘      │
       │                 │                  │                  │                  │
       │                 │                  │ 8. Get course name                  │
       │                 │                  ├─────────────────>│                  │
       │                 │                  │<─────────────────┤                  │
       │                 │                  │                  │                  │
       │                 │                  │ 9. Generate embedding for question  │
       │                 │                  ├─────────────────────────────────────>│
       │                 │                  │                  │                  │
       │                 │                  │ 10. Return question embedding       │
       │                 │                  │<─────────────────────────────────────┤
       │                 │                  │                  │                  │
       │                 │                  │ 11. SELECT document_chunks          │
       │                 │                  │     ORDER BY cosine similarity      │
       │                 │                  │     LIMIT 5                         │
       │                 │                  ├─────────────────>│                  │
       │                 │                  │                  │                  │
       │                 │                  │ 12. Return top 5 relevant chunks    │
       │                 │                  │<─────────────────┤                  │
       │                 │                  │                  │                  │
       │                 │                  │ 13. Build context prompt with:      │
       │                 │                  │     - Course name                   │
       │                 │                  │     - AI name                       │
       │                 │                  │     - Retrieved chunks              │
       │                 │                  │     - User question                 │
       │                 │                  ├──────────────────┤                  │
       │                 │                  │                  │                  │
       │                 │                  │ 14. POST to ChatCompletion API      │
       │                 │                  │     (stream=true)                   │
       │                 │                  ├─────────────────────────────────────>│
       │                 │                  │                  │                  │
       │                 │ data: {"messageId":123, "type":"start"}                │
       │                 │<─────────────────┤                  │                  │
       │                 │                  │                  │                  │
       │                 │                  │ 15. Stream chunk 1                  │
       │                 │                  │<─────────────────────────────────────┤
       │                 │                  │                  │                  │
       │                 │ data: {"content":"Hello", "type":"chunk"}              │
       │                 │<─────────────────┤                  │                  │
       │                 │                  │                  │                  │
       │  Update UI with │                  │                  │                  │
       │  partial response                  │                  │                  │
       │<────────────────┤                  │                  │                  │
       │                 │                  │                  │                  │
       │                 │                  │ 16. Stream chunk 2                  │
       │                 │                  │<─────────────────────────────────────┤
       │                 │                  │                  │                  │
       │                 │ data: {"content":" there!", "type":"chunk"}            │
       │                 │<─────────────────┤                  │                  │
       │                 │                  │                  │                  │
       │  Update UI...   │                  │                  │                  │
       │<────────────────┤                  │                  │                  │
       │                 │                  │                  │                  │
       │              ┌──┴──────────────────┴──────────────────┴──────────────────┴──┐
       │              │  Loop [for each chunk from OpenAI stream]                     │
       │              │     Backend receives chunk → Forwards to Frontend →           │
       │              │     Frontend updates UI                                       │
       │              └──┬──────────────────┬──────────────────┬──────────────────┬──┘
       │                 │                  │                  │                  │
       │                 │                  │ 17. Stream finished (done=true)     │
       │                 │                  │<─────────────────────────────────────┤
       │                 │                  │                  │                  │
       │                 │                  │ 18. UPDATE chat_messages            │
       │                 │                  │     SET message = fullResponse,     │
       │                 │                  │         status = 'active'           │
       │                 │                  ├─────────────────>│                  │
       │                 │                  │                  │                  │
       │                 │                  │ 19. Confirm update                  │
       │                 │                  │<─────────────────┤                  │
       │                 │                  │                  │                  │
       │                 │ data: {"type":"complete", "messageId":123,              │
       │                 │       "documentsUsed":[...]}                            │
       │                 │<─────────────────┤                  │                  │
       │                 │                  │                  │                  │
       │  20. Final UI   │                  │                  │                  │
       │  update, show   │                  │                  │                  │
       │  complete msg   │                  │                  │                  │
       │<────────────────┤                  │                  │                  │
       │                 │                  │                  │                  │
       │                 │ 21. Close SSE connection            │                  │
       │                 │<─────────────────┤                  │                  │
       │                 │                  │                  │                  │
┌──────┬──────┐   ┌──────┬───────┐   ┌──────┬───────┐   ┌──────┬───────┐   ┌──────┬───────┐
│user: User   │   │frontend:React│   │backend:      │   │db:PostgreSQL │   │openai:OpenAI │
│             │   │              │   │Express       │   │              │   │              │
└─────────────┘   └──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

## Notes

- All synchronous calls shown with solid arrows and execution bars
- Asynchronous streaming shown with repeated message flows
- Database operations use prepared statements to prevent SQL injection
- Vector similarity uses cosine distance for semantic search
- The diagram represents the actual implementation in `chat.js` and `aiService.js`

## License

This project is licensed under the MIT License - see the LICENSE file for details.
