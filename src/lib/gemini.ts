import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface InterviewConfig {
  jobTitle: string;
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
  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [{ text: `You are an expert technical interviewer for a ${config.jobTitle} position. 
The candidate wants to practice in ${config.languages.join(", ")}.
The current language for this specific question should be ${currentLanguage}.

Rules:
1. Ask one concise, challenging interview question at a time.
2. If the candidate previously answered a question, acknowledge it briefly (in the current language) before asking the next.
3. Mix technical questions, behavioral questions, and industry-specific scenarios.
4. Keep the persona professional yet encouraging.
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
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [{ text: `Evaluate this interview answer for a ${config.jobTitle} role. 
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
