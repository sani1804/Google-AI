import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface InterviewConfig {
  jobTitle: string;
  jobDescription: string;
  companyName: string;
  jobUrl: string;
  interviewerTone: string;
  languages: string[];
  mode: "simulation" | "feedback";
  candidateProfile: string;
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

  const jobContext = `
Job Title: ${config.jobTitle || "Not specified (infer from URL)"}
Company: ${config.companyName || "Unknown/To be inferred"}
URL: ${config.jobUrl || "None"}
Description: ${config.jobDescription || "Standard role"}
Candidate Profile/Notes: ${config.candidateProfile || "None provided"}
`.trim();

  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: `You are an expert interviewer for a position.
Context of the role:
${jobContext}

Instructions: 
- If a company name or URL is provided, use your internal knowledge about that company's culture, interview style (e.g., Google's focus on GCA, Amazon's Leadership Principles), and technical expectations to tailor the questions.
- If only a URL is provided, try to infer the company and role details from the URL structure or components if possible.

The candidate wants to practice in ${config.languages.join(", ")}.
The current language for this specific question MUST be ${currentLanguage}.

Interviewer Tone/Behavior: ${config.interviewerTone}.
Instructions for your persona: ${toneInstruction}

Rules:
1. Ask one concise, high-quality interview question at a time.
2. If the candidate previously answered a question, acknowledge it briefly (in the current language) before asking the next.
3. Mix technical, behavioral, and industry-specific questions.
4. Provide ONLY the next question or response, no meta-commentary.

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

export interface SummaryReport {
  strengths: string[];
  improvements: string[];
  executiveSummary: string;
  technicalAssessment: string;
  behavioralAssessment: string;
  languageProficiency: string;
  overallScore: number; // 0-100
  scoringReasoning: string;
}

export async function generateSummaryFeedback(
  config: InterviewConfig,
  history: ChatMessage[]
): Promise<SummaryReport | null> {
  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: `The interview session for a candidate at ${config.companyName || "the company"} has ended.
Role Context: ${config.jobTitle || "Position based on URL: " + config.jobUrl}
Hirer Persona: ${config.interviewerTone}
Job Description/Requirements:
${config.jobDescription}

Candidate Background: ${config.candidateProfile || "General applicant"}

Review the following transcript and provide a comprehensive "Deep Form" feedback report.
The evaluation should be strictly based on the provided Job Requirements and the Hirer's Persona.

Transcript:
${history.map(m => `${m.role}: ${m.text}`).join("\n")}

Provide the report in JSON format:
{
  "strengths": ["string"],
  "improvements": ["string"],
  "executiveSummary": "A high-level overview of the candidate's performance",
  "technicalAssessment": "Detailed analysis of technical knowledge shown vs requirements",
  "behavioralAssessment": "Analysis of soft skills and communication style vs hirer persona expectations",
  "languageProficiency": "Assessment of multilingual capabilities used",
  "overallScore": number (0-100),
  "scoringReasoning": "A detailed explanation of why this specific score (out of 100) was awarded, justifying it based on the job requirements and the hirer's expectations."
}` }]
      }
    ],
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    return JSON.parse(result.text) as SummaryReport;
  } catch (e) {
    console.error("Failed to parse summary feedback", e);
    return null;
  }
}

