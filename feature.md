# PrepAI - Comprehensive Features Documentation

PrepAI is a mission-critical AI platform for interview engineering. It leverages state-of-the-art Large Language Models (LLMs) to provide an immersive, high-fidelity practice environment that bridges the gap between preparation and performance.

## 🚀 Experience Pillars

### 1. Unified Setup Engine (The "Intelligence" Gate)
*   **Omni-Selector Input:** A robust, single-gate input field that intelligently detects URLs from raw text. Whether you paste a LinkedIn job link, a corporate career page, or manual requirements, PrepAI parses it on-the-fly.
*   **Asset Liquidity (Drag & Drop):** Support for direct document injection. Drag a PDF Resume or a Text-based Job Description directly onto the input fields for immediate extraction.
*   **Dynamic Scraper (LinkedIn/Career Page Ready):** Backend integration using Cheerio and Axios to penetrate public job listings, extracting critical metadata:
    *   Target Company Persona.
    *   Core Competencies & Stack Requirements.
    *   Job Title & Department context.
*   **PDF Extraction Service:** Enterprise-grade PDF parsing to ingest complex Resume layouts and convert them into structured AI context.

### 2. Multi-Dimensional Interview Modes
*   **Phase 1: Real-Time Simulation:**
    *   Strict adherence to the "Candidate Experience."
    *   Back-and-forth dialogue using Gemini 1.5/2.0/3.0 capabilities.
    *   Adaptive follow-up logic: The AI identifies "shallow" answers and probes deeper for metrics (STAR method enforcement).
*   **Phase 2: Live Feedback (The Mentor Overlay):**
    *   Real-time analytical sidecar.
    *   Instant scoring and "Linguistics Check" after every response.
    *   Helps candidates correct posture, tone, and technical inaccuracies during the session.
*   **Phase 3: Agentic Simulation (The "Perfect Play" Mirror):**
    *   Fully autonomous mode where two AI agents compete.
    *   Shows the user what a high-quality response looks like for their specific resume and the target job.
    *   Generates a full 45-60 minute transcript in seconds.

### 3. Deep-Dive Analytical Engine
*   **Multilingual Fluency:** Support for 8 global languages (English, Hindi, German, etc.), allowing candidates to mirror the actual language of the regional role.
*   **Sentiment & Tone Control:** Configure the interviewer's disposition (Stressful, Conversational, Encouraging, Professional) to practice under different pressure levels.
*   **Technical vs. Behavioral Balance:** Categorization of questions into technical aptitude and soft-skill alignment.

### 4. Post-Interview Intelligence (The Synthesis)
*   **Executive Feedback Report:** A comprehensive summary of the candidate's "Market Readiness."
*   **Strengths vs. Improvements:** Categorized bullet points for quick wins.
*   **Scoring Logic:** Transparent 0-100 scoring based on:
    *   Technical accuracy.
    *   Culture fit.
    *   Communication clarity.
*   **The "Ideal Answer" Reference:** For every question asked during the interview, PrepAI generates a "Gold Standard" response that the candidate can study.

## 🛠️ Technical Architecture

### Frontend Layer
- **Framework:** React 18 with TypeScript.
- **Styling:** Tailwind CSS (Modern Brutalist Aesthetic).
- **Animations:** Motion (Framer Motion) for staggered entrances and route transitions.
- **PDF Generation:** `jsPDF` and `jsPDF-AutoTable` for professional report generation.

### Backend Layer (Express Sidecar)
- **Scraper:** Axios + Cheerio with sophisticated header rotation to handle modern web obstacles.
- **File Parsing:** `multer` for memory-safe uploads and `pdf-parse` for document ingestion.
- **Server:** Node.js with TypeScript (`tsx`) integration.

### AI & LLM Integration
- **Model:** Google Gemini 3 Flash Preview (Optimized for reasoning and simulation speed).
- **Context Management:** Dynamic history tracking to prevent "Model Amnesia" during long sessions.
- **Safety:** Content filtering to ensure professional and inclusive interview environments.

---
*Document Version: 1.2.0*
*Last Infrastructure Update: April 26, 2026*
