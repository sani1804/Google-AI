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
  Play
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  InterviewConfig, 
  ChatMessage, 
  InterviewFeedback, 
  generateQuestion, 
  generateFeedback 
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
    interviewerTone: "Professional",
    languages: DEFAULT_LANGUAGES,
  });
  const [currentLang, setCurrentLang] = useState("English");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [lastFeedback, setLastFeedback] = useState<InterviewFeedback | null>(null);
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
    if (!config.jobTitle) return;
    setLoading(true);
    setStep("interview");
    try {
      const intro = `Hello! I'm your interviewer today for the **${config.jobTitle}** position. We'll be conducting this session in multiple languages: ${config.languages.join(", ")}. 

I'll start with a question in **${currentLang}**. Feel free to answer in that language, and we can switch whenever you're ready. Let's begin.`;
      
      const firstQuestion = await generateQuestion(config, [], currentLang);
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
      const [feedback] = await Promise.all([
        generateFeedback(config, messages[messages.length - 1].text, inputValue, currentLang)
      ]);

      if (feedback) {
        setLastFeedback(feedback);
      }
      
      // We don't automatically generate the next question anymore,
      // as the user wants an explicit "Ask" button for the interviewer.
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

  const reset = () => {
    window.speechSynthesis.cancel();
    setStep("setup");
    setMessages([]);
    setLastFeedback(null);
    setShowFeedback(false);
  };

  return (
    <div className="min-h-screen text-white font-sans overflow-hidden">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between z-20 relative">
        <div className="flex items-center gap-3">
          <div className="bg-accent-glow p-2 rounded-lg text-[#1a1c2c]">
            <Languages size={22} />
          </div>
          <h1 className="text-2xl font-bold tracking-wider uppercase">
            Lingo<span className="text-accent-glow">Hire</span> AI
          </h1>
        </div>
        <div className="flex items-center gap-6">
          {step === "interview" && (
            <button 
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              className={`p-2 rounded-lg transition-all ${isAudioEnabled ? "text-accent-glow bg-accent-glow/10" : "text-white/30 bg-white/5"}`}
              title={isAudioEnabled ? "Mute Audio" : "Unmute Audio"}
            >
              {isAudioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          )}
          {step === "interview" && (
            <button 
              onClick={reset}
              className="flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white transition-colors uppercase tracking-widest"
            >
              <ArrowLeft size={16} /> End Session
            </button>
          )}
        </div>
      </header>

      <main className="h-[calc(100vh-88px)] p-6">
        <AnimatePresence mode="wait">
          {step === "setup" ? (
            <motion.div
              key="setup"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="max-w-2xl mx-auto h-full flex flex-col justify-center gap-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-5xl font-black text-white leading-tight">
                  Master the Art of <br />
                  <span className="text-accent-glow">Global Interviews.</span>
                </h2>
                <p className="text-white/60 text-lg max-w-lg mx-auto leading-relaxed">
                  Real-time practice for elite multilingual roles. Powered by Aria, your AI Interview Specialist.
                </p>
              </div>

              <div className="glass-card rounded-[32px] p-10 space-y-8 overflow-y-auto max-h-[70vh]">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-xs font-black text-white/40 uppercase tracking-[0.2em]">
                      <Briefcase size={14} />
                      Target Job Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lead UI Architect..."
                      className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-accent-glow transition-all"
                      value={config.jobTitle}
                      onChange={(e) => setConfig({ ...config, jobTitle: e.target.value })}
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-xs font-black text-white/40 uppercase tracking-[0.2em]">
                      <Sparkles size={14} />
                      Interviewer Persona
                    </label>
                    <div className="flex gap-2">
                       {[
                         { id: "Professional", icon: <ShieldCheck size={14} /> },
                         { id: "Conversational", icon: <Coffee size={14} /> },
                         { id: "Stressful", icon: <Zap size={14} /> },
                         { id: "Encouraging", icon: <Smile size={14} /> }
                       ].map(tone => (
                         <button
                           key={tone.id}
                           onClick={() => setConfig({ ...config, interviewerTone: tone.id })}
                           title={tone.id}
                           className={`p-3 rounded-xl transition-all border ${
                             config.interviewerTone === tone.id
                               ? "bg-accent-glow text-[#1a1c2c] border-accent-glow"
                               : "bg-white/5 text-white/60 border-white/10 hover:border-white/30"
                           }`}
                         >
                           {tone.icon}
                         </button>
                       ))}
                       <span className="ml-2 flex items-center text-[10px] font-bold text-accent-glow uppercase tracking-wider">{config.interviewerTone}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-xs font-black text-white/40 uppercase tracking-[0.2em]">
                    <MessageSquare size={14} />
                    Job Description / Context (Optional)
                  </label>
                  <textarea
                    placeholder="Paste job requirements or project details here for more targeted questions..."
                    className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-accent-glow transition-all min-h-[100px] resize-none"
                    value={config.jobDescription}
                    onChange={(e) => setConfig({ ...config, jobDescription: e.target.value })}
                  />
                </div>

                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-xs font-black text-white/40 uppercase tracking-[0.2em]">
                    <Languages size={14} />
                    Interview Languages
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {SUPPORTED_LANGUAGES.map((lang) => {
                      const isActive = config.languages.includes(lang);
                      return (
                        <button
                          key={lang}
                          onClick={() => toggleLanguage(lang)}
                          className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                            isActive
                              ? "bg-accent-glow text-[#1a1c2c] border-accent-glow"
                              : "bg-white/5 text-white/60 border-white/10 hover:border-white/30"
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
                  disabled={!config.jobTitle}
                  className="w-full bg-white text-[#1a1c2c] py-5 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-accent-glow transition-all disabled:opacity-30 active:scale-[0.98] shadow-2xl shadow-accent-glow/20"
                >
                  INITIALIZE SESSION <ChevronRight size={20} />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="interview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-[280px_1fr_300px] gap-6 h-full"
            >
              {/* Sidebar Left: Session Info */}
              <div className="glass-card rounded-[24px] overflow-hidden flex flex-col p-6 gap-8">
                <div>
                  <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Active Session</h3>
                  <div className="bg-accent-glow/10 border border-accent-glow/20 p-4 rounded-xl">
                    <div className="font-bold text-sm text-accent-glow mb-1">{config.jobTitle}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                       {config.languages.map(l => (
                         <span key={l} className="text-[9px] font-bold px-2 py-0.5 bg-white/10 rounded-md text-white/60">{l}</span>
                       ))}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">Interviewer</h3>
                  <div className="flex items-center gap-3 p-2">
                    <div className="w-10 h-10 rounded-full bg-conic from-accent-glow to-purple-500 p-[1px]">
                       <div className="w-full h-full rounded-full bg-[#1a1c2c]" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">Aria</div>
                      <div className="text-[10px] text-accent-glow font-bold uppercase tracking-tighter">{config.interviewerTone} Persona</div>
                    </div>
                  </div>
                  <button 
                    onClick={askQuestion}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    disabled={loading}
                  >
                    <Volume2 size={16} className="text-accent-glow" /> Next Question
                  </button>
                </div>

                <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
                   <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Live Audio</div>
                   <div className="text-xs text-white/60 leading-relaxed italic">
                      {isAudioEnabled ? "\"Aria will speak the questions automatically.\"" : "\"Speaker is currently muted.\""}
                   </div>
                </div>
              </div>

              {/* Main Stage: Chat */}
              <div className="glass-card rounded-[24px] relative flex flex-col overflow-hidden">
                {/* Visualizer Header */}
                <div className="p-8 pb-4 flex flex-col items-center border-b border-white/5">
                   <div className={`avatar-circle mb-6 transition-all duration-500 ${isListening ? "scale-110 shadow-[0_0_30px_rgba(0,210,255,0.4)]" : ""}`} />
                   <div className="text-center">
                     <h2 className="text-xl font-bold tracking-tight">Active Interview Phase</h2>
                     <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">
                       {isListening ? "Listening for your response..." : "Aria is ready for you"}
                     </p>
                   </div>
                </div>

                {/* Messages Area */}
                <div 
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth"
                >
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                    >
                      <div className={`text-[10px] font-black uppercase tracking-widest mb-1 mx-2 ${msg.role === "user" ? "text-accent-glow" : "text-white/30"}`}>
                        {msg.role === "user" ? "You" : "Aria"}
                      </div>
                      <div className={`max-w-[85%] rounded-[20px] px-6 py-4 relative group ${
                        msg.role === "user" 
                          ? "bg-white/10 text-white rounded-tr-none border border-white/10" 
                          : "bg-white/5 text-white/90 rounded-tl-none border border-white/5"
                      }`}>
                        <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-strong:text-accent-glow">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 rounded-2xl rounded-tl-none px-6 py-4 flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <span className="w-1.5 h-1.5 bg-accent-glow rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-accent-glow rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-accent-glow rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-6 bg-black/20 border-t border-white/5 flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/5 rounded-xl px-4 py-2 border border-white/10 flex flex-col min-w-[120px]">
                       <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Speak In</span>
                       <select 
                        value={currentLang}
                        onChange={(e) => setCurrentLang(e.target.value)}
                        className="bg-transparent border-none text-xs font-bold text-accent-glow focus:ring-0 cursor-pointer p-0"
                      >
                        {config.languages.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <input
                      type="text"
                      placeholder={isListening ? "Listening... continue speaking" : `Answer in any language...`}
                      className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-white/20 font-medium"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                      disabled={loading}
                    />
                    <button
                      onClick={toggleListening}
                      title={isListening ? "Stop Listening" : "Start Speaking"}
                      className={`p-3 rounded-xl transition-all ${isListening ? "bg-red-500/20 text-red-500 animate-pulse border-red-500/20" : "bg-white/5 text-white/60 hover:text-white border border-white/10"}`}
                    >
                      {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim() || loading}
                      className="bg-accent-glow text-[#1a1c2c] px-6 py-3 rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-20 font-black text-xs uppercase tracking-widest shadow-lg shadow-accent-glow/20 flex items-center gap-2"
                    >
                      <Play size={16} /> Respond
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar Right: Live Feedback */}
              <div className="glass-card rounded-[24px] overflow-hidden flex flex-col p-6 gap-6">
                 <div className="flex items-center justify-between border-b border-white/5 pb-4">
                   <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                      <Sparkles size={14} className="text-accent-glow" /> 
                      Live Feedback
                   </h3>
                   {lastFeedback && (
                     <div className="text-xl font-black text-accent-glow">
                       {lastFeedback.overallScore}<span className="text-white/20 text-[10px]">/10</span>
                     </div>
                   )}
                 </div>

                 <div className="space-y-6 overflow-y-auto pr-2">
                    {lastFeedback ? (
                      <>
                        <div className="space-y-3">
                           <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Strengths</div>
                           <div className="space-y-2">
                              {lastFeedback.strengths.slice(0, 2).map((s, i) => (
                                <div key={i} className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-[11px] text-green-100 leading-relaxed shadow-sm">
                                  {s}
                                </div>
                              ))}
                           </div>
                        </div>

                        <div className="space-y-3">
                           <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Improvements</div>
                           <div className="space-y-2">
                              {lastFeedback.improvements.slice(0, 2).map((im, i) => (
                                <div key={i} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-100 leading-relaxed shadow-sm">
                                  {im}
                                </div>
                              ))}
                           </div>
                        </div>

                        <div className="p-4 bg-accent-glow/5 rounded-2xl border border-accent-glow/10 space-y-2">
                           <div className="text-[9px] font-black text-accent-glow uppercase tracking-widest">Language Check</div>
                           <p className="text-[11px] text-white/70 leading-relaxed italic">
                             {lastFeedback.languageProficiency}
                           </p>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-40 text-center space-y-4">
                         <div className="w-12 h-12 rounded-full border border-dashed border-white/20 flex items-center justify-center text-white/20">
                            <RefreshCcw size={20} className="animate-spin-slow" />
                         </div>
                         <p className="text-xs text-white/30 font-medium">Awaiting your first <br />response to evaluate...</p>
                      </div>
                    )}
                 </div>

                 {lastFeedback && (
                    <button 
                      onClick={() => setShowFeedback(true)}
                      className="mt-auto w-full py-3 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                    >
                      View Detailed Analysis
                    </button>
                 )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Detailed Feedback Modal Overlay */}
        <AnimatePresence>
          {showFeedback && lastFeedback && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#0f0c29]/80 backdrop-blur-xl z-50 flex items-center justify-center px-6"
              onClick={() => setShowFeedback(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="glass-card rounded-[40px] p-10 max-w-2xl w-full shadow-2xl space-y-10 overflow-y-auto max-h-[85vh] relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-accent-glow/20 text-accent-glow rounded-[24px]">
                      <Sparkles size={28} />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black text-white tracking-tight">Session Analysis</h3>
                      <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-1">Detailed performance breakdown</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center bg-white/5 p-4 rounded-3xl border border-white/10 min-w-[80px]">
                    <span className="text-4xl font-black text-accent-glow">{lastFeedback.overallScore}<span className="text-white/20 text-lg">/10</span></span>
                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-1">Score</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-black text-green-400 uppercase tracking-[0.2em]">
                      <CheckCircle size={14} /> Key Strengths
                    </h4>
                    <div className="space-y-2">
                      {lastFeedback.strengths.map((s, idx) => (
                        <div key={idx} className="flex gap-3 text-sm text-white/80 bg-green-400/5 p-4 rounded-2xl border border-green-400/10">
                          <span className="text-green-400 font-bold tracking-tighter">✓</span>
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">
                      <RefreshCcw size={14} /> Areas for Growth
                    </h4>
                    <div className="space-y-2">
                      {lastFeedback.improvements.map((im, idx) => (
                        <div key={idx} className="flex gap-3 text-sm text-white/80 bg-amber-400/5 p-4 rounded-2xl border border-amber-400/10">
                          <span className="text-amber-400 font-bold tracking-tighter">!</span>
                          {im}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-accent-glow/5 p-8 rounded-[32px] border border-accent-glow/10 space-y-3">
                  <h4 className="text-[10px] font-black text-accent-glow uppercase tracking-[0.2em] flex items-center gap-2">
                    <Languages size={14} /> Language Evaluation
                  </h4>
                  <p className="text-white/90 text-sm leading-relaxed italic">{lastFeedback.languageProficiency}</p>
                </div>

                <button
                  onClick={() => setShowFeedback(false)}
                  className="w-full py-5 bg-white text-[#1a1c2c] rounded-2xl font-black uppercase tracking-widest hover:bg-accent-glow transition-all shadow-xl shadow-accent-glow/20"
                >
                  Continue Interview
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}



