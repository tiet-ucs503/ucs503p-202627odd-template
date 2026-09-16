# Exercise Form Corrector

Real-time webcam squat form analysis system powered by MediaPipe computer vision, React, and FastAPI.

---

## Quick Setup & Run

### 1. Install Node Dependencies
From this `code/` folder:
```bash
npm install
```

### 2. Set Up Python Virtual Environment
```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 3. Configure Environment Files
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

### 4. Start the Application
Run the startup script:
```bash
./start.sh
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://127.0.0.1:8000
- **Swagger Docs:** http://127.0.0.1:8000/docs
