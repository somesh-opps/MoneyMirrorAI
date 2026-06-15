# 💸 MoneyMirror AI

<div align="center">
  <img src="https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?q=80&w=1200&auto=format&fit=crop" alt="MoneyMirror Banner" width="100%" style="border-radius: 12px; object-fit: cover; max-height: 300px; box-shadow: 0 8px 16px rgba(0,0,0,0.15);"/>
  
  <br/>
  <br/>
  
  <p>
    <b><i>Your intelligent, AI-driven personal financial twin and analytics platform.</i></b>
  </p>

  <p>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React"></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI"></a>
    <a href="https://www.mongodb.com/"><img src="https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS"></a>
  </p>

  <h3>
    <b><a href="https://money-mirror-ai.vercel.app/">🚀 Try the Live Demo 🚀</a></b>
  </h3>
</div>

---

## ✨ Key Features

- 🏥 **Financial Doctor**: Automatically diagnoses your financial health by analyzing your spending habits, savings rate, and expense ratios.
- 👯 **Financial Twin**: Generates a simulated "twin" profile based on your data to project future financial trajectories and provide tailored, actionable advice.
- 📉 **Subscription Detection**: Automatically detects recurring subscriptions from your transaction data, helping you identify hidden costs and optimize cash flow.
- 🎙️ **Voice-to-Text AI Chatbot**: Interact with your financial data naturally using your voice. Powered by `faster-whisper`, our chatbot understands complex financial queries and provides instant, conversational insights.
- 🔐 **Secure Data Persistence**: User-scoped financial data is securely stored in MongoDB with robust authentication and cloud persistence, ensuring your data is always safe and synced.
- 📊 **Dynamic Dashboards**: Beautiful, responsive, and interactive charts built with Recharts and Radix UI to give you a crystal-clear view of your wealth.

---

## 🏗 Architecture

> MoneyMirror utilizes a modern, decoupled microservice-inspired architecture designed for scale, high performance, and rapid iteration.

- 🖥️ **Frontend (`MoneyMirrorweb`)**: A lightning-fast, highly interactive Single Page Application (SPA) built with React 19, Vite, and TanStack Router. It leverages Zustand for state and Tailwind CSS for a premium, responsive UI.
- 🛡️ **Backend Gateway (`MoneyMirrorBackend` - Flask)**: Acts as the robust primary gateway handling user authentication, secure file uploads, and session management.
- ⚡ **Computation Engine (`MoneyMirrorBackend` - FastAPI)**: A high-performance Python backend dedicated to complex data manipulation, machine learning inference (via Whisper), and heavy algorithmic calculations.

---

## 🛠 Tech Stack

| Category | Technologies |
| :--- | :--- |
| **🎨 Frontend** | React 19, Vite, TanStack Router, Tailwind CSS v4, Radix UI, Framer Motion |
| **📊 Data Vis & State** | Recharts, Zustand, React Query |
| **⚙️ Backend Core** | Flask (Gateway API), FastAPI (Computation Engine), Uvicorn |
| **🗄️ Database** | MongoDB (PyMongo) |
| **🧠 ML & Analytics** | NumPy, Pandas, `faster-whisper` |
| **🎙️ Audio Proc** | FFmpeg, PyAV, python-multipart |

---

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- MongoDB Database URI
- `ffmpeg` installed locally (required for voice processing)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/MoneyMirror.git
cd MoneyMirror
```

### 2. Frontend Setup
```bash
cd MoneyMirrorweb
npm install
npm run dev
```
The frontend will spin up at `http://localhost:5173`.

### 3. Backend Setup
It is highly recommended to use a virtual environment.
```bash
cd MoneyMirrorBackend/backend
python -m venv venv

# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

pip install -r requirements.txt
```

Start the backend servers. Depending on your configuration, you may need to start both Flask and FastAPI.
```bash
# Example for running the FastAPI computation engine
uvicorn main:app --reload

# Example for running the Flask gateway
python app.py
```

---

## ⚙️ Environment Variables

Ensure you create `.env` files in both the frontend and backend directories.

### Backend (`MoneyMirrorBackend/backend/.env`)
```env
MONGO_URI=your_mongodb_connection_string
SECRET_KEY=your_flask_secret_key
# Add other necessary API keys or configurations here
```

### Frontend (`MoneyMirrorweb/.env.local`)
```env
VITE_API_URL=http://localhost:5000 # Point this to your local Flask Gateway
```

---

## 🧠 Core Algorithms

At the heart of MoneyMirror is a proprietary computation engine responsible for:
1. **Data Normalization**: Standardizing diverse transaction formats (CSV, JSON) into a unified actionable schema.
2. **Heuristic Rules & Categorization**: Utilizing rule-based logic and NLP to automatically categorize expenses and identify spending patterns.
3. **Recovery Yield Logic**: Calculating potential savings by eliminating unnecessary subscriptions and dynamically optimizing expense ratios.

*(For detailed algorithmic breakdowns, please refer to the internal documentation and knowledge base).*

---

## 📄 License

This project is licensed under the terms of the MIT License. See the [LICENSE](./LICENSE) file for more details.

---

<br/>

<div align="center">
  <p><b>Built to make personal finance intelligent, transparent, and manageable.</b></p>
  <p>⭐ If you like this project, please consider giving it a star! ⭐</p>
</div>
