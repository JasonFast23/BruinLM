# Detailed BruinLM Setup Guide

This guide provides comprehensive instructions for setting up BruinLM from scratch on a new computer.

## Complete Environment Setup

### 1. Required Software Installation

#### Visual Studio Code
1. Download VS Code from https://code.visualstudio.com/
2. Install for your operating system
3. Recommended extensions:
   - ESLint
   - Prettier
   - PostgreSQL

#### Node.js
1. Download LTS version from https://nodejs.org/
2. Install for your operating system
3. Verify installation:
   ```bash
   node --version
   npm --version
   ```

#### PostgreSQL (Critical Setup)
1. Download from https://www.postgresql.org/download/
2. During installation, select these components:
   - PostgreSQL Server
   - pgAdmin 4 (GUI tool)
   - Command Line Tools
3. Keep default port: 5432
4. Remember your password!

### 2. Project Setup

#### Get the Code
1. Download ZIP from GitHub
2. Extract to your preferred location

#### Database Setup
1. Using pgAdmin 4:
   - Open pgAdmin 4
   - Enter master password
   - Right-click Databases → Create → Database
   - Name it "bruinlm"
   
2. Initialize Database Structure:
   ```bash
   psql -U postgres -d bruinlm -f backend/init.sql
   psql -U postgres -d bruinlm -f backend/scripts/setup_chat.sql
   psql -U postgres -d bruinlm -f backend/scripts/add_message_status.sql
   ```

3. Verify tables:
   ```bash
   psql -U postgres -d bruinlm
   \dt
   ```
   You should see all the required tables listed.

#### Environment Configuration

1. In `backend/backend/.env`:
   ```
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   DB_HOST=localhost
   DB_PORT=5432
   DB_DATABASE=bruinlm
   PORT=5001
   OPENAI_API_KEY=your_openai_api_key
   ```
   Replace:
   - `your_postgres_password` with your PostgreSQL password
   - `your_openai_api_key` with key from https://platform.openai.com/api-keys

### 3. Installing Dependencies

1. Frontend Dependencies:
   ```bash
   cd frontend
   npm install
   ```

### 4. Starting the Application

1. Start Backend Server (in one terminal):
   ```bash
   cd backend/backend
   PORT=5001 node server.js
   ```

2. Start Frontend (in another terminal):
   ```bash
   cd frontend
   npm start
   ```

The application should now be running at:
- Frontend: http://localhost:3000
- Backend: http://localhost:5001

## Common Issues & Solutions

### Database Connection Problems
1. Check if PostgreSQL is running
2. Verify password in .env matches your PostgreSQL password
3. Confirm database exists:
   ```sql
   psql -U postgres
   \l
   ```
4. Check table existence:
   ```sql
   \c bruinlm
   \dt
   ```

### Node/NPM Issues
- Clear cache: `npm cache clean --force`
- Delete node_modules and reinstall:
  ```bash
  rm -rf node_modules
  npm install
  ```

### OpenAI API Setup
1. Create account: https://platform.openai.com/
2. Navigate to API keys
3. Create new secret key
4. Add to .env file

## Additional Notes

### Port Configuration
- Backend runs on port 5001
- Frontend runs on port 3000
- If ports are in use, backend port can be changed in the command line

### Important Paths
- Backend server: `backend/backend/server.js`
- Database scripts: `backend/backend/scripts/`
- Frontend entry: `frontend/src/index.js`

For any additional help or issues, please create a GitHub issue in the repository.