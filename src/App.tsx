import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Languages, 
  Briefcase, 
  Send, 
  RefreshCcw, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft,
  MessageSquare,
  Sparkles,
  Trophy,
  Smile,
  Zap,
  Coffee,
  ShieldCheck,
  ChevronRight,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Download
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { jsPDF } from "jspdf";
import { 
  InterviewConfig, 
  ChatMessage, 
  InterviewFeedback, 
  SummaryReport,
  generateQuestion, 
  generateFeedback,
  generateSummaryFeedback
} from "./lib/gemini";

const SUPPORTED_LANGUAGES = [
  "English", "Hindi", "Malayalam", "German", "Spanish", "French", "Japanese", "Mandarin"
];

const LANG_CODES: Record<string, string> = {
  "English": "en-US",
  "Hindi": "hi-IN",
  "Malayalam": "ml-IN",
  "German": "de-DE",
  "Spanish": "es-ES",
  "French": "fr-FR",
  "Japanese": "ja-JP",
  "Mandarin": "zh-CN"
};

const DEFAULT_LANGUAGES = ["English"];

// Speech Recognition Type Definitions
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [step, setStep] = useState<"setup" | "interview">("setup");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<InterviewConfig>({
    jobTitle: "",
    jobDescription: "",
    companyName: "",
    jobUrl: "",
    interviewerTone: "Professional",
    languages: DEFAULT_LANGUAGES,
    mode: "feedback",
    candidateProfile: "",
  });
  const [currentLang, setCurrentLang] = useState("English");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [lastFeedback, setLastFeedback] = useState<InterviewFeedback | null>(null);
  const [summaryReport, setSummaryReport] = useState<SummaryReport | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Speech Recognition Setup
  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const recognition = new window.webkitSpeechRecognition() as SpeechRecognition;
      recognition.continuous = true; 
      recognition.interimResults = true;
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInputValue(prev => prev + (prev ? " " : "") + finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== "no-speech") {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Text-to-Speech (TTS)
  const speak = (text: string, lang: string) => {
    if (!isAudioEnabled || typeof window === "undefined" || !window.speechSynthesis) return;

    // Clean markdown for speech
    const cleanText = text.replace(/[*#_`~]/g, "").replace(/\[.*?\]\(.*?\)/g, "");
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = LANG_CODES[lang] || "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    window.speechSynthesis.cancel(); 
    window.speechSynthesis.speak(utterance);
  };

  // Speak Aria's latest message
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "model") {
      setTimeout(() => speak(lastMsg.text, currentLang), 100);
    }
  }, [messages]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.lang = LANG_CODES[currentLang] || "en-US";
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const askQuestion = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const nextQuestion = await generateQuestion(config, messages, currentLang);
      setMessages(prev => [...prev, { role: "model", text: nextQuestion }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: "model", text: "Something went wrong while generating the question." }]);
    } finally {
      setLoading(false);
    }
  };

  const startInterview = async () => {
    if (!config.jobTitle && !config.jobUrl) return;
    setLoading(true);
    
    let currentConfig = { ...config };

    // Implicit Job URL Analysis
    if (config.jobUrl && (!config.jobTitle || !config.jobDescription)) {
      try {
        const response = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: config.jobUrl }),
        });
        const data = await response.json();
        if (data.success) {
          let inferredCompany = currentConfig.companyName;
          if (!inferredCompany) {
            const titleParts = data.title.split(/ - | \| | at /);
            if (titleParts.length > 1) inferredCompany = titleParts[titleParts.length - 1].trim();
          }
          currentConfig = {
            ...currentConfig,
            jobDescription: currentConfig.jobDescription || data.content.substring(0, 2000),
            jobTitle: currentConfig.jobTitle || data.title.split(/ - | \| | at /)[0].trim(),
            companyName: inferredCompany
          };
        }
      } catch (err) {
        console.error("Implicit Job analysis failed", err);
      }
    }

    // Implicit Profile URL Analysis
    const profileUrlMatch = currentConfig.candidateProfile.match(/(https?:\/\/[^\s]+)/g);
    if (profileUrlMatch && profileUrlMatch[0]) {
      try {
        const response = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: profileUrlMatch[0] }),
        });
        const data = await response.json();
        if (data.success) {
          currentConfig = {
            ...currentConfig,
            candidateProfile: `Profile summary extracted from ${profileUrlMatch[0]}:\n\n${data.content.substring(0, 1500)}...\n\nOriginal Text: ${currentConfig.candidateProfile}`
          };
        }
      } catch (err) {
        console.error("Implicit Profile analysis failed", err);
      }
    }

    setConfig(currentConfig);
    setStep("interview");

    try {
      const displayTitle = currentConfig.jobTitle || (currentConfig.jobUrl ? "URL-based Role" : "General Position");
      const intro = `Hello! I'm your interviewer today for the **${displayTitle}** position at **${currentConfig.companyName || "your target organization"}**. We'll be conducting this session in multiple languages: ${currentConfig.languages.join(", ")}. 

I'll start with a question in **${currentLang}**. Let's begin.`;
      
      const firstQuestion = await generateQuestion(currentConfig, [], currentLang);
      setMessages([
        { role: "model", text: intro },
        { role: "model", text: firstQuestion }
      ]);
    } catch (error) {
      console.error(error);
      setMessages([{ role: "model", text: "Sorry, I encountered an error starting the session. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", text: inputValue };
    const history = [...messages, userMsg];
    setMessages(history);
    setInputValue("");
    setLoading(true);

    try {
      if (config.mode === "feedback") {
        const [feedback] = await Promise.all([
          generateFeedback(config, messages[messages.length - 1].text, inputValue, currentLang)
        ]);
        if (feedback) {
          setLastFeedback(feedback);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = (lang: string) => {
    setConfig(prev => {
      const exists = prev.languages.includes(lang);
      if (exists) {
        if (prev.languages.length === 1) return prev;
        return { ...prev, languages: prev.languages.filter(l => l !== lang) };
      }
      return { ...prev, languages: [...prev.languages, lang] };
    });
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const report = await generateSummaryFeedback(config, messages);
      setSummaryReport(report);
      setShowFeedback(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    window.speechSynthesis.cancel();
    setStep("setup");
    setMessages([]);
    setLastFeedback(null);
    setSummaryReport(null);
    setShowFeedback(false);
  };

  const downloadPDF = () => {
    if (!summaryReport) return;

    const doc = new jsPDF();
    const margin = 20;
    let y = 20;

    const addText = (text: string, fontSize: number, isBold: boolean = false) => {
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      const splitText = doc.splitTextToSize(text, 170);
      doc.text(splitText, margin, y);
      y += (splitText.length * fontSize * 0.5) + 5;
      
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Interview Performance Report", margin, y);
    y += 15;

    addText(`Position: ${config.jobTitle}`, 12, true);
    addText(`Company: ${config.companyName}`, 12, true);
    addText(`Date: ${new Date().toLocaleDateString()}`, 10);
    y += 5;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, 190, y);
    y += 10;

    addText("OVERALL SCORE", 14, true);
    addText(`${summaryReport.overallScore} / 100`, 24, true);
    y += 5;

    addText("REASONING", 12, true);
    addText(summaryReport.scoringReasoning, 10);
    y += 5;

    addText("EXECUTIVE SUMMARY", 12, true);
    addText(summaryReport.executiveSummary, 10);
    y += 5;

    addText("TECHNICAL ASSESSMENT", 12, true);
    addText(summaryReport.technicalAssessment, 10);
    y += 5;

    addText("BEHAVIORAL ASSESSMENT", 12, true);
    addText(summaryReport.behavioralAssessment, 10);
    y += 5;

    addText("STRENGTHS", 12, true);
    summaryReport.strengths.forEach(s => addText(`• ${s}`, 10));
    y += 5;

    addText("IMPROVEMENTS", 12, true);
    summaryReport.improvements.forEach(im => addText(`• ${im}`, 10));
    y += 5;

    addText("LANGUAGE PROFICIENCY", 12, true);
    addText(summaryReport.languageProficiency, 10);

    doc.save(`Interview_Report_${config.jobTitle.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#f9f6f1] text-[#1d2433] font-sans">
      <header className="bg-white px-8 py-6 flex items-center justify-between z-20 relative border-b border-[#1d2433]/10">
        <div className="flex items-center gap-4">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/5/59/SAP_2011_logo.svg" 
            alt="SAP Logo" 
            className="h-8 w-auto"
          />
          <div className="h-6 w-[1px] bg-[#1d2433]/10 mx-2 hidden md:block" />
          <h1 className="text-2xl font-serif font-semibold tracking-tight text-[#1d2433]">
            Prep<span className="text-[#cb855a]">AI</span>
          </h1>
          <div className="h-6 w-[1px] bg-[#1d2433]/10 mx-2 hidden md:block" />
          <div className="hidden md:flex items-center gap-2">
            <span className="w-2 h-2 bg-[#cb855a] rounded-full" />
            <span className="text-[10px] font-bold text-[#cb855a] uppercase tracking-[0.2em]">SMART PREP. ELITE HIRES.</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {step === "interview" && (
            <button 
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className={`p-2 rounded-full transition-all ${isAudioEnabled ? "text-[#1d2433] bg-[#1d2433]/5" : "text-[#1d2433]/30 bg-[#1d2433]/5"}`}
              title={isAudioEnabled ? "Mute Audio" : "Unmute Audio"}
            >
              {isAudioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          )}
          {step === "interview" && (
            <button 
              onClick={reset}
              className="px-5 py-2 border border-[#1d2433]/20 text-[#1d2433] text-[10px] font-bold uppercase tracking-widest hover:bg-[#1d2433] hover:text-white transition-all flex items-center gap-2 rounded-full"
            >
              <ArrowLeft size={14} /> End Session
            </button>
          )}
        </div>
      </header>

      <main className="h-[calc(100vh-88px)] p-6">
        <AnimatePresence mode="wait">
          {step === "setup" ? (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-6xl mx-auto h-full flex flex-col justify-center gap-6"
            >
              <div className="glass-card !bg-white/80 backdrop-blur-sm p-12 space-y-10 overflow-y-auto max-h-[85vh]">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-[#1d2433]/40 uppercase tracking-[0.15em]">
                      <Briefcase size={14} />
                      Position
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Strategist..."
                      className="w-full px-5 py-4 border border-[#1d2433]/10 bg-transparent text-[#1d2433] placeholder-gray-400 focus:outline-none focus:border-[#cb855a] transition-all text-sm rounded-lg"
                      value={config.jobTitle}
                      onChange={(e) => setConfig({ ...config, jobTitle: e.target.value })}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-[#1d2433]/40 uppercase tracking-[0.15em]">
                      <Sparkles size={14} />
                      Organization
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Anthropic, OpenAI..."
                      className="w-full px-5 py-4 border border-[#1d2433]/10 bg-transparent text-[#1d2433] placeholder-gray-400 focus:outline-none focus:border-[#cb855a] transition-all text-sm rounded-lg"
                      value={config.companyName}
                      onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                   <div className="space-y-3">
                      <label className="flex items-center gap-2 text-[10px] font-bold text-[#1d2433]/40 uppercase tracking-[0.15em]">
                        <MessageSquare size={14} />
                        Job Description / Context
                      </label>
                      <textarea
                        placeholder="Paste requirements..."
                        className="w-full px-5 py-3 border border-[#1d2433]/10 bg-transparent text-[#1d2433] placeholder-gray-400 focus:outline-none focus:border-[#cb855a] transition-all min-h-[80px] text-sm resize-none rounded-lg"
                        value={config.jobDescription}
                        onChange={(e) => setConfig({ ...config, jobDescription: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-[10px] font-bold text-[#1d2433]/40 uppercase tracking-[0.15em]">
                        <ChevronRight size={14} />
                        Job URL (Optional)
                      </label>
                      <input
                      type="url"
                      placeholder="e.g. https://careers.company.com/..."
                      className="w-full px-5 py-4 border border-[#1d2433]/10 bg-transparent text-[#1d2433] placeholder-gray-400 focus:outline-none focus:border-[#cb855a] transition-all text-sm rounded-lg"
                      value={config.jobUrl}
                      onChange={(e) => setConfig({ ...config, jobUrl: e.target.value })}
                    />
                    </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-[#1d2433]/40 uppercase tracking-[0.15em]">
                    <Sparkles size={14} />
                    Candidate Profile / Additional Input
                  </label>
                  <textarea
                    placeholder="Describe your background or paste a LinkedIn profile URL to analyze..."
                    className="w-full px-5 py-4 border border-[#1d2433]/10 bg-transparent text-[#1d2433] placeholder-gray-400 focus:outline-none focus:border-[#cb855a] transition-all min-h-[100px] text-sm resize-none rounded-lg"
                    value={config.candidateProfile}
                    onChange={(e) => setConfig({ ...config, candidateProfile: e.target.value })}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-8 border-t border-[#1d2433]/10 pt-8">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-[#1d2433]/40 uppercase tracking-[0.15em]">
                      <Sparkles size={14} />
                      Interviewer Tone
                    </label>
                    <div className="flex gap-2">
                       {[
                         { id: "Professional", icon: <ShieldCheck size={14} /> },
                         { id: "Conversational", icon: <Coffee size={14} /> },
                         { id: "Stressful", icon: <Zap size={14} /> }
                       ].map(tone => (
                         <button
                           key={tone.id}
                           onClick={() => setConfig({ ...config, interviewerTone: tone.id })}
                           className={`p-3 transition-all border ${
                             config.interviewerTone === tone.id
                               ? "bg-[#1d2433] text-white border-[#1d2433]"
                               : "bg-transparent text-[#1d2433]/50 border-[#1d2433]/10 hover:border-[#1d2433]/30"
                           } rounded-lg`}
                         >
                           {tone.icon}
                         </button>
                       ))}
                       <span className="flex items-center text-[10px] font-bold text-[#1d2433] uppercase ml-2 tracking-widest">{config.interviewerTone}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-[#1d2433]/40 uppercase tracking-[0.15em]">
                      <Send size={14} />
                      Experience Mode
                    </label>
                    <div className="flex gap-1 p-1 bg-[#1d2433]/5 rounded-lg border border-[#1d2433]/10 w-full">
                       <button
                         onClick={() => setConfig({ ...config, mode: "simulation" })}
                         className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all ${
                           config.mode === "simulation" ? "bg-white text-[#1d2433] shadow-sm" : "text-[#1d2433]/40 hover:text-[#1d2433]/60"
                         }`}
                       >
                         INTERVIEW
                       </button>
                       <button
                         onClick={() => setConfig({ ...config, mode: "feedback" })}
                         className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all ${
                           config.mode === "feedback" ? "bg-white text-[#1d2433] shadow-sm" : "text-[#1d2433]/40 hover:text-[#1d2433]/60"
                         }`}
                       >
                         FEEDBACK
                       </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[10px] font-bold text-[#1d2433]/40 uppercase tracking-[0.15em]">
                    <Languages size={14} />
                    Interview Languages
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SUPPORTED_LANGUAGES.map((lang) => {
                      const isActive = config.languages.includes(lang);
                      return (
                        <button
                          key={lang}
                          onClick={() => toggleLanguage(lang)}
                          className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${
                            isActive
                              ? "bg-[#cb855a] text-white border-[#cb855a]"
                              : "bg-transparent text-[#1d2433]/50 border-[#1d2433]/10 hover:border-[#1d2433]/30"
                          }`}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={startInterview}
                  disabled={(!config.jobTitle && !config.jobUrl) || loading}
                  className="w-full bg-[#1d2433] text-white py-4 rounded-lg font-bold text-xs uppercase tracking-[0.2em] hover:bg-black transition-all shadow-lg flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <RefreshCcw size={16} className="animate-spin" />
                  ) : (
                    <>Start Session <ChevronRight size={16} /></>
                  )}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="interview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col lg:grid lg:grid-cols-[250px_1fr_280px] gap-6 h-full p-2 max-w-[1600px] mx-auto overflow-hidden"
            >
              {/* Sidebar Left: Session Info - Hidden on mobile/tablet sidebar unless toggled, but here we stack them */}
              <div className="glass-card !bg-white/80 rounded-2xl overflow-hidden flex flex-col p-6 gap-6 border border-[#1d2433]/10 lg:h-full">
                <div>
                  <h3 className="text-[10px] font-bold text-[#1d2433]/40 uppercase tracking-[0.15em] mb-4">Job Focus</h3>
                  <div className="bg-[#1d2433]/5 rounded-xl p-5 border border-[#1d2433]/5 space-y-4">
                    <div>
                      <span className="text-[8px] font-bold text-[#cb855a] uppercase tracking-widest block mb-1">Organization</span>
                      <div className="font-serif text-lg text-[#1d2433] leading-tight">{config.companyName || "Confidential Co."}</div>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold text-[#cb855a] uppercase tracking-widest block mb-1">Designation</span>
                      <div className="text-sm text-[#1d2433]/80 font-bold uppercase tracking-tight leading-tight">{config.jobTitle || "Undisclosed Role"}</div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                       {config.languages.map(l => (
                         <span key={l} className="text-[9px] font-bold px-2 py-1 bg-white border border-[#1d2433]/10 rounded-md text-[#1d2433]/60">{l}</span>
                       ))}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-bold text-[#1d2433]/40 uppercase tracking-[0.15em] mb-4">Interviewer</h3>
                  <div className="flex items-center gap-3 p-3 bg-white border border-[#1d2433]/5 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-[#1d2433] flex items-center justify-center text-white shrink-0">
                       <Zap size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#1d2433]">Aria</div>
                      <div className="text-[9px] text-[#cb855a] font-bold uppercase tracking-tight">{config.interviewerTone} Persona</div>
                    </div>
                  </div>
                  <button 
                    onClick={askQuestion}
                    className="w-full mt-6 flex items-center justify-center gap-2 py-3 bg-[#1d2433] hover:bg-black text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 shadow-md"
                    disabled={loading}
                  >
                    <Volume2 size={14} /> Next Question
                  </button>
                  <button 
                    onClick={handleFinish}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-3 bg-transparent hover:bg-[#1d2433]/5 border border-[#1d2433]/20 text-[#1d2433] rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                    disabled={loading || messages.length < 3}
                  >
                    <CheckCircle size={14} /> Finish & Review
                  </button>
                </div>

                <div className="mt-auto pt-6 border-t border-[#1d2433]/10 space-y-4">
                   <div className="text-[10px] font-bold text-[#1d2433]/40 uppercase tracking-[0.15em]">Status</div>
                   <div className="text-[10px] font-medium text-[#1d2433]/60 leading-relaxed italic">
                     {config.mode === "simulation" ? "Simulation mode enabled. Real-time feedback is hidden until the end." : "Analysis mode active. Instant feedback available on the right."}
                   </div>
                </div>
              </div>

              {/* Main Stage: Chat */}
              <div className="flex-1 glass-card !bg-white/80 rounded-2xl relative flex flex-col overflow-hidden border border-[#1d2433]/10 min-h-[500px] lg:h-full">
                {/* Visualizer Header */}
                <div className="p-8 pb-6 flex items-center gap-6 border-b border-[#1d2433]/5">
                   <div className={`avatar-circle !w-16 !h-16 transition-all duration-500 rounded-full bg-[#1d2433]/5 flex items-center justify-center border border-[#cb855a]/30 ${isListening ? "ring-8 ring-[#cb855a]/10" : ""}`}>
                      <Mic size={24} className={isListening ? "text-[#cb855a]" : "text-[#1d2433]/40"} />
                   </div>
                   <div className="flex-1">
                     <h2 className="text-2xl font-serif font-medium text-[#1d2433]">Session in progress</h2>
                     <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#cb855a] uppercase tracking-widest">
                          <span className={`w-2 h-2 bg-[#cb855a] rounded-full ${isListening ? "animate-ping" : ""}`} /> 
                          {isListening ? "Listening" : "Ready"}
                        </span>
                        <span className="text-[#1d2433]/30 text-[10px] font-bold uppercase tracking-[0.1em]">
                          {messages.length} exchanges
                        </span>
                     </div>
                   </div>
                </div>

                {/* Messages Area */}
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-8 space-y-10 scroll-smooth"
                >
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                    >
                      <div className={`text-[10px] font-bold uppercase tracking-[0.1em] mb-2 mx-1 ${msg.role === "user" ? "text-[#cb855a]" : "text-[#1d2433]/40"}`}>
                        {msg.role === "user" ? "Candidate" : "Interviewer"}
                      </div>
                      <div className={`max-w-[85%] rounded-2xl px-6 py-5 shadow-sm ${
                        msg.role === "user" 
                          ? "bg-[#1d2433] text-white" 
                          : "bg-[#1d2433]/5 text-[#1d2433] border border-[#1d2433]/5"
                      }`}>
                        <div className={`prose prose-sm max-w-none ${msg.role === "user" ? "prose-invert" : "prose-p:text-[#1d2433]/80"} prose-strong:text-[#cb855a]`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-[#1d2433]/5 border border-[#1d2433]/5 px-6 py-4 rounded-xl flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <span className="w-1.5 h-1.5 bg-[#cb855a] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-[#cb855a] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-[#cb855a] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-8 bg-[#1d2433]/5 border-t border-[#1d2433]/5 flex flex-col gap-4">
                  <div className="flex items-center gap-5">
                    <div className="bg-white border border-[#1d2433]/10 rounded-lg px-4 py-2 flex flex-col min-w-[150px] shadow-sm">
                       <span className="text-[8px] font-bold text-[#1d2433]/40 uppercase tracking-[0.1em]">Active Language</span>
                       <select 
                        value={currentLang}
                        onChange={(e) => setCurrentLang(e.target.value)}
                        className="bg-transparent border-none text-[11px] font-bold text-[#cb855a] focus:ring-0 cursor-pointer p-0 uppercase"
                      >
                        {config.languages.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <input
                      type="text"
                      placeholder={isListening ? "Listening..." : `Type your response...`}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-[#1d2433] placeholder-gray-400 font-medium text-lg"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      disabled={loading}
                    />
                    <button
                      onClick={toggleListening}
                      className={`p-4 rounded-full transition-all border ${isListening ? "bg-[#cb855a] text-white animate-pulse border-[#cb855a]" : "bg-white text-[#1d2433]/60 hover:text-[#1d2433] border-[#1d2433]/10 shadow-sm"}`}
                    >
                      {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim() || loading}
                      className="bg-[#1d2433] text-white px-8 py-4 rounded-xl hover:bg-black transition-all disabled:opacity-30 font-bold text-sm uppercase tracking-[0.1em] shadow-lg flex items-center gap-2"
                    >
                      <Send size={16} /> Send
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar Right: Live Feedback */}
              <div className="glass-card !bg-white/80 rounded-2xl overflow-hidden flex flex-col p-6 gap-6 border border-[#1d2433]/10">
                 <div className="flex items-center justify-between border-b border-[#1d2433]/5 pb-4">
                   <h3 className="text-[10px] font-bold text-[#1d2433] uppercase tracking-[0.15em] flex items-center gap-2">
                      <Sparkles size={14} className="text-[#cb855a]" /> 
                      {config.mode === "feedback" ? "Instant Analysis" : "Session Stats"}
                   </h3>
                 </div>

                 <div className="space-y-6 overflow-y-auto pr-2">
                    {config.mode === "feedback" ? (
                      lastFeedback ? (
                        <>
                          <div className="space-y-4">
                             <div className="text-[9px] font-bold text-[#1d2433]/40 uppercase tracking-[0.1em]">Strengths</div>
                             <div className="space-y-3">
                                {lastFeedback.strengths.slice(0, 2).map((s, i) => (
                                  <div key={i} className="bg-green-50/50 border-l-2 border-green-500/50 p-4 rounded-r-xl text-[11px] text-[#1d2433] leading-relaxed">
                                    {s}
                                  </div>
                                ))}
                             </div>
                          </div>

                          <div className="space-y-4">
                             <div className="text-[9px] font-bold text-[#1d2433]/40 uppercase tracking-[0.1em]">Areas for refinement</div>
                             <div className="space-y-3">
                                {lastFeedback.improvements.slice(0, 2).map((im, i) => (
                                  <div key={i} className="bg-[#cb855a]/5 border-l-2 border-[#cb855a]/50 p-4 rounded-r-xl text-[11px] text-[#1d2433] leading-relaxed">
                                    {im}
                                  </div>
                                ))}
                             </div>
                          </div>
                          
                          <div className="p-5 bg-[#1d2433] rounded-xl text-center mt-6 shadow-xl">
                             <div className="text-3xl font-serif font-black text-white leading-none">
                               {lastFeedback.overallScore}<span className="text-[10px] text-white/30 font-bold uppercase ml-2 tracking-widest">Score</span>
                             </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-center space-y-4">
                           <RefreshCcw size={20} className="animate-spin-slow text-[#1d2433]/10" />
                           <p className="text-[10px] text-[#1d2433]/40 font-bold uppercase tracking-widest">Awaiting input...</p>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                        <div className="p-8 bg-[#1d2433]/5 rounded-full border border-dashed border-[#1d2433]/10">
                          <ShieldCheck size={32} className="text-[#1d2433]/20" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-[#1d2433] uppercase tracking-widest">Simulation Mode</p>
                          <p className="text-[11px] text-[#1d2433]/40 leading-relaxed font-medium">Feedback is synthesized after completion.</p>
                        </div>
                        <div className="w-full bg-white border border-[#1d2433]/10 rounded-xl p-4 text-[10px] text-[#1d2433] font-bold uppercase tracking-widest">
                           {messages.filter(m => m.role === "user").length} Exchanges
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Detailed Feedback Modal / Summary Report Overlay */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#1d2433]/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
              onClick={() => setShowFeedback(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="glass-card !bg-[#f9f6f1] p-12 max-w-4xl w-full shadow-2xl space-y-12 overflow-y-auto max-h-[90vh] relative rounded-3xl border border-[#1d2433]/10"
                onClick={(e) => e.stopPropagation()}
              >
                {summaryReport ? (
                  <>
                    <div className="flex items-center justify-between border-b border-[#1d2433]/10 pb-10">
                      <div className="flex items-center gap-8">
                        <div className="p-5 bg-[#1d2433] text-white rounded-2xl shadow-xl">
                          <Trophy size={40} />
                        </div>
                        <div>
                          <h3 className="text-4xl font-serif font-medium text-[#1d2433] leading-none">The Final Report</h3>
                          <p className="text-[#1d2433]/40 text-[10px] font-bold uppercase tracking-[0.2em] mt-3">Synthesized by Prep AI Intelligence</p>
                        </div>
                      </div>
                      <div className="bg-white border border-[#1d2433]/10 p-8 rounded-2xl text-center min-w-[160px] shadow-lg">
                        <div className="text-6xl font-serif font-bold text-[#cb855a] leading-none">{summaryReport.overallScore}<span className="text-[#1d2433]/10 text-2xl">/100</span></div>
                        <div className="text-[10px] font-bold text-[#1d2433]/40 uppercase tracking-widest mt-4">Performance Score</div>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12">
                      <div className="col-span-2 space-y-10">
                        <div className="space-y-4">
                           <h4 className="text-[10px] font-bold text-[#1d2433] uppercase tracking-[0.15em] flex items-center gap-2">
                             <Trophy size={14} className="text-[#cb855a]" /> Scoring Reasoning
                           </h4>
                           <p className="text-[#1d2433]/70 text-sm leading-relaxed bg-white p-6 rounded-2xl border border-[#1d2433]/5 shadow-sm">
                             {summaryReport.scoringReasoning}
                           </p>
                        </div>

                        <div className="space-y-4">
                          <h4 className="text-[10px] font-bold text-[#1d2433] uppercase tracking-[0.15em] flex items-center gap-2">
                             <Sparkles size={14} className="text-[#cb855a]" /> Executive Summary
                          </h4>
                          <p className="text-[#1d2433]/80 text-lg font-serif leading-relaxed italic bg-white p-8 rounded-2xl border border-[#1d2433]/5 shadow-sm">
                            "{summaryReport.executiveSummary}"
                          </p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                          <div className="bg-white p-8 border border-[#1d2433]/5 rounded-2xl space-y-4 shadow-sm">
                             <h4 className="text-[9px] font-bold text-[#1d2433]/40 uppercase tracking-widest border-b border-[#1d2433]/5 pb-3">Technical Perspective</h4>
                             <p className="text-xs text-[#1d2433]/70 leading-relaxed font-medium">{summaryReport.technicalAssessment}</p>
                          </div>
                          <div className="bg-white p-8 border border-[#1d2433]/5 rounded-2xl space-y-4 shadow-sm">
                             <h4 className="text-[9px] font-bold text-[#1d2433]/40 uppercase tracking-widest border-b border-[#1d2433]/5 pb-3">Persona & Behavioral</h4>
                             <p className="text-xs text-[#1d2433]/70 leading-relaxed font-medium">{summaryReport.behavioralAssessment}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                         <div className="bg-green-50 border-l-4 border-green-500 p-6 space-y-4">
                            <h4 className="text-[10px] font-black text-green-700 uppercase tracking-widest">Key Merits</h4>
                            <ul className="space-y-3">
                              {summaryReport.strengths.map((s, i) => (
                                <li key={i} className="text-[11px] text-green-800 font-bold flex gap-2">
                                  <span className="text-green-500">◆</span> {s}
                                </li>
                              ))}
                            </ul>
                         </div>
                         <div className="bg-amber-50 border-l-4 border-amber-500 p-6 space-y-4">
                            <h4 className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Growth Markers</h4>
                            <ul className="space-y-3">
                              {summaryReport.improvements.map((im, i) => (
                                <li key={i} className="text-[11px] text-amber-800 font-bold flex gap-2">
                                  <span className="text-amber-500">◆</span> {im}
                                </li>
                              ))}
                            </ul>
                         </div>
                      </div>
                    </div>

                    <div className="bg-[#1d2433] p-10 rounded-2xl text-white shadow-inner">
                       <div className="text-[10px] font-bold text-[#cb855a] uppercase tracking-[0.2em] mb-3">Communication Analysis</div>
                       <p className="text-sm text-white/70 italic font-medium leading-relaxed font-serif">{summaryReport.languageProficiency}</p>
                    </div>

                    <div className="flex gap-6">
                      <button
                        onClick={reset}
                        className="flex-1 py-5 bg-[#1d2433] text-white font-bold uppercase tracking-[0.2em] hover:bg-black transition-all shadow-xl rounded-xl"
                      >
                        New Session
                      </button>
                      <button
                        onClick={downloadPDF}
                        className="flex-1 py-5 bg-[#cb855a] text-white font-bold uppercase tracking-[0.2em] hover:bg-[#b0734d] transition-all shadow-xl rounded-xl flex items-center justify-center gap-2"
                      >
                        <Download size={18} /> Download Report
                      </button>
                      <button
                        onClick={() => setShowFeedback(false)}
                        className="px-10 py-5 border border-[#1d2433]/20 text-[#1d2433] font-bold uppercase tracking-[0.1em] hover:bg-[#1d2433]/5 transition-all rounded-xl"
                      >
                        Close
                      </button>
                    </div>
                  </>
                ) : (
                  lastFeedback && (
                    <>
                      <div className="flex items-center justify-between border-b border-[#1d2433]/10 pb-8">
                        <div className="flex items-center gap-6">
                          <div className="p-4 bg-[#cb855a]/10 text-[#cb855a] rounded-xl">
                            <Sparkles size={28} />
                          </div>
                          <div>
                            <h3 className="text-3xl font-serif font-medium text-[#1d2433]">Instant Review</h3>
                            <p className="text-[#1d2433]/40 text-[10px] font-bold uppercase tracking-widest mt-1">Real-time analysis snippet</p>
                          </div>
                        </div>
                        <div className="flex bg-[#1d2433] p-5 rounded-2xl text-white shadow-xl items-baseline gap-2">
                          <span className="text-4xl font-serif font-black text-white">{lastFeedback.overallScore}</span>
                          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Points</span>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <h4 className="flex items-center gap-2 text-[10px] font-bold text-green-600 uppercase tracking-[0.15em]">
                            <CheckCircle size={14} /> Strengths
                          </h4>
                          <div className="space-y-3">
                            {lastFeedback.strengths.map((s, idx) => (
                              <div key={idx} className="flex gap-3 text-sm text-[#1d2433]/80 bg-green-50/50 p-5 rounded-xl border border-green-100 font-medium leading-relaxed">
                                {s}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <h4 className="flex items-center gap-2 text-[10px] font-bold text-[#cb855a] uppercase tracking-[0.15em]">
                            <RefreshCcw size={14} /> Improvements
                          </h4>
                          <div className="space-y-3">
                            {lastFeedback.improvements.map((im, idx) => (
                              <div key={idx} className="flex gap-3 text-sm text-[#1d2433]/80 bg-[#cb855a]/5 p-5 rounded-xl border border-[#cb855a]/10 font-medium leading-relaxed">
                                {im}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-8 border border-[#1d2433]/5 rounded-2xl space-y-4 shadow-sm">
                        <h4 className="text-[10px] font-bold text-[#1d2433]/40 uppercase tracking-[0.15em] flex items-center gap-2 border-b border-[#1d2433]/5 pb-3">
                          <Languages size={14} className="text-[#cb855a]" /> Language Proficiency
                        </h4>
                        <p className="text-[#1d2433]/70 text-sm leading-relaxed italic font-serif">{lastFeedback.languageProficiency}</p>
                      </div>

                      <button
                        onClick={() => setShowFeedback(false)}
                        className="w-full py-5 bg-[#1d2433] text-white font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl rounded-xl"
                      >
                        Continue Session
                      </button>
                    </>
                  )
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}



