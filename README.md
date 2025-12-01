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
- SQLite database
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

## License

This project is licensed under the MIT License - see the LICENSE file for details.