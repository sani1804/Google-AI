import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface InterviewConfig {
  jobTitle: string;
  jobDescription: string;
  interviewerTone: string;
  languages: string[];
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface InterviewFeedback {
  strengths: string[];
  improvements: string[];
  languageProficiency: string;
  overallScore: number; // 1-10
}

export async function generateQuestion(
  config: InterviewConfig,
  history: ChatMessage[],
  currentLanguage: string
) {
  const toneInstruction = config.interviewerTone === "Stressful" 
    ? "Be blunt, ask high-pressure follow-up questions, and challenge the candidate's assumptions."
    : config.interviewerTone === "Conversational" 
    ? "Be friendly, build rapport, and ask questions in a natural, casual professional style."
    : config.interviewerTone === "Encouraging"
    ? "Be supportive, highlight positive aspects, and gently nudge the candidate towards the right answers."
    : "Be strictly professional, formal, and objective.";

  const jobContext = config.jobDescription 
    ? `Job Description/Context: ${config.jobDescription}`
    : "No detailed description provided; rely on the job title.";

  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: `You are an expert interviewer for a ${config.jobTitle} position. 
${jobContext}

The candidate wants to practice in ${config.languages.join(", ")}.
The current language for this specific question MUST be ${currentLanguage}.

Interviewer Tone/Behavior: ${config.interviewerTone}.
Instructions for your persona: ${toneInstruction}

Rules:
1. Ask one concise, high-quality interview question at a time.
2. If the candidate previously answered a question, acknowledge it briefly (in the current language) before asking the next.
3. Tailor the questions strictly to the job title and description provided.
4. If a description is provided, extract specific technical or behavioral requirements from it.
5. Provide ONLY the next question or response, no meta-commentary.

Interview History:
${history.map(m => `${m.role}: ${m.text}`).join("\n")}

Next Question in ${currentLanguage}:` }]
      }
    ]
  });

  return result.text;
}

export async function generateFeedback(
  config: InterviewConfig,
  question: string,
  answer: string,
  language: string
) {
  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: `Evaluate this interview answer for a ${config.jobTitle} role. 
Context: ${config.jobDescription || "Standard interview"}
Question: ${question}
Answer (in ${language}): ${answer}

Provide constructive feedback in JSON format:
{
  "strengths": ["string"],
  "improvements": ["string"],
  "languageProficiency": "short comment on grammar/vocabulary in the used language",
  "overallScore": number (1-10)
}` }]
      }
    ],
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    return JSON.parse(result.text) as InterviewFeedback;
  } catch (e) {
    console.error("Failed to parse feedback", e);
    return null;
  }
}
