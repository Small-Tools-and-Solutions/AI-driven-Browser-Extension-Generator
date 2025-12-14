import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import JSZip from 'https://esm.sh/jszip@3.10.1';
import Markdown from 'https://esm.sh/react-markdown@9.0.1';

// --- System Instruction ---
const SYSTEM_INSTRUCTION = `
You are a secure browser extension generator that turns a human description into a complete, minimal‑permission Chrome Manifest V3 extension.
Return pure JSON with no markdown formatting.

Format:
{
  "files": [
    { "path": "string", "type": "text" | "binary-description", "content": "string" }
  ],
  "testing_guide": "markdown string",
  "security_review": "markdown string"
}

Rules:
1. Manifest V3 only.
2. Minimal permissions (avoid <all_urls> unless absolutely necessary).
3. No eval, no remote code.
4. "binary-description" for icons MUST follow this format: 'PNG icon, SIZE x SIZE, style [flat|gradient], background HEX [HEX...], foreground HEX, text "INITIALS" centered.' 
   Example 1: 'PNG icon, 48x48, style gradient, background #4F46E5 #9333EA, foreground #FFFFFF, text "EX" centered.'
   Example 2: 'PNG icon, 16x16, style flat, background #3C78DC, foreground #FFFFFF, text "E" centered.'
   Always generate icons for sizes 16, 48, and 128.
`;

const EXAMPLE_PROMPTS = [
  "Highlight 'secure' in yellow on every page.",
  "Popup showing current tab title & URL.",
  "Hide all images on click.",
  "Red border on all paragraphs."
];

// --- Icons ---
const CodeIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>;
const ShieldIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
const PlayIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const DownloadIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
const SparklesIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>;
const CopyIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>;
const CheckIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const ChevronDownIcon = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
const ChevronRightIcon = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>;
const EyeIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
const AlertTriangleIcon = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
const ShareIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>;
const HeartIcon = () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>;
const SunIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const MoonIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>;
const DownloadFileIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>;
const SmileIcon = () => <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const SadIcon = () => <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;


// File Types Icons
const JsIcon = () => <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></svg>;
const HtmlIcon = () => <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>; 
const CssIcon = () => <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z"/><path d="M12 4v16"/></svg>;
const JsonIcon = () => <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1-1v-1a1 1 0 0 0-1-1"/></svg>;
const ImageIcon = () => <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const MarkdownIcon = () => <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 8h-2v8h2"/><path d="M11 8H9v8h2"/><path d="M4 6h16v12H4z"/></svg>;
const DefaultFileIcon = () => <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;

// --- Components ---

function App() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [result, setResult] = useState<any>(null);
  const [errorDetails, setErrorDetails] = useState<{title: string, message: string, tip: string} | null>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'code' | 'testing' | 'security'>('code');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(false);
  const [isDark, setIsDark] = useState(true);
  
  // Feedback State
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSentiment, setFeedbackSentiment] = useState<'happy' | 'sad' | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  // Local content state for editing (both text and icon description strings)
  const [localContent, setLocalContent] = useState("");

  // File explorer collapsing state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Sync local content when file selection changes
  useEffect(() => {
    if (selectedFile) {
        setLocalContent(selectedFile.content);
    }
  }, [selectedFile]);

  const generateExtension = async () => {
    if (!prompt.trim()) return;
    
    // Check if result exists and confirm with user before proceeding
    if (result) {
        const confirmed = window.confirm("Generating new code will discard current files. Continue?");
        if (!confirmed) return;
    }
    
    setLoading(true);
    setLoadingStep("Initializing builder...");
    setErrorDetails(null);
    setResult(null);
    setSelectedFile(null);
    setCollapsedGroups({}); // Reset collapse state
    setLocalContent("");

    // Simulation of progress steps
    const steps = [
        "Analyzing requirements...",
        "Structuring Manifest V3...",
        "Baking security in...",
        "Checking security gaps...",
        "Generating minimal permissions...",
        "Creating assets and icons...",
        "Finalizing extension bundle..."
    ];
    let stepIndex = 0;
    
    // Update step text every 1.5 seconds
    const intervalId = setInterval(() => {
        setLoadingStep(steps[stepIndex]);
        stepIndex = (stepIndex + 1) % steps.length;
    }, 1500);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
        contents: prompt
      });

      const text = response.text || "{}";
      const jsonStr = text.replace(/^```json/, '').replace(/```$/, '');
      
      let data;
      try {
        data = JSON.parse(jsonStr);
      } catch (parseError) {
        throw new Error("Received malformed JSON from the AI.");
      }

      if (!data.files || !Array.isArray(data.files)) {
         throw new Error("Incomplete data received. Files array is missing.");
      }

      setResult(data);
      if (data.files && data.files.length > 0) {
        setSelectedFile(data.files[0]);
        setActiveTab('code');
      }
    } catch (err: any) {
      console.error("Generation Error:", err);
      const msg = err.message || "Unknown error";
      let errorObj = { title: "Unexpected Error", message: msg, tip: "Check your internet connection or try again." };

      if (msg.includes('400')) errorObj = { title: "Invalid Request", message: "The AI could not process this prompt.", tip: "Check if your prompt is too long or contains prohibited content." };
      else if (msg.includes('429')) errorObj = { title: "Rate Limit Exceeded", message: "You are generating too fast.", tip: "Please wait a minute before trying again." };
      else if (msg.includes('503') || msg.includes('500')) errorObj = { title: "AI Service Unavailable", message: "The AI service is temporarily down.", tip: "Please try again in a few minutes." };
      else if (msg.includes('JSON')) errorObj = { title: "Generation Glitch", message: "The AI returned malformed code.", tip: "Try again. If it persists, simplify your prompt." };
      else if (msg.includes('SAFETY')) errorObj = { title: "Safety Block", message: "The request violated safety policies.", tip: "Modify your prompt to avoid sensitive topics." };

      setErrorDetails(errorObj);
    } finally {
      clearInterval(intervalId);
      setLoading(false);
      setLoadingStep("");
    }
  };

  const handleDownloadZip = async () => {
    if (!result) return;
    const zip = new JSZip();

    for (const file of result.files) {
      if (file.type === 'text') {
        zip.file(file.path, file.content);
      } else if (file.type === 'binary-description') {
        const blob = await generateIconBlob(file.content);
        if (blob) {
          zip.file(file.path, blob);
        }
      }
    }

    zip.file("TESTING_GUIDE.md", result.testing_guide);
    zip.file("SECURITY_REVIEW.md", result.security_review);

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chrome-extension.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSingleFile = async () => {
      if (!selectedFile) return;
      let blob;
      if (selectedFile.type === 'text') {
          blob = new Blob([localContent], { type: 'text/plain' });
      } else if (selectedFile.type === 'binary-description') {
          blob = await generateIconBlob(localContent);
      }
      
      if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = selectedFile.path.split('/').pop() || "download";
          a.click();
          URL.revokeObjectURL(url);
      }
  };

  const handleCopyCode = () => {
    // Allows copying content of text or binary-description (the desc string)
    if (selectedFile) {
      navigator.clipboard.writeText(localContent); 
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const handleShareProject = () => {
    // Share current URL for now
    navigator.clipboard.writeText("Check out this AI Chrome Extension Generator: " + window.location.href);
    setShareFeedback(true);
    setTimeout(() => setShareFeedback(false), 2000);
  };

  const handleClearPrompt = () => {
    setPrompt("");
  };

  const handleContentChange = (newContent: string) => {
    setLocalContent(newContent);
    // Update the file in the result structure so previews and download use new content
    if (result && selectedFile) {
        const updatedFiles = result.files.map((f: any) => 
            f.path === selectedFile.path ? { ...f, content: newContent } : f
        );
        setResult({ ...result, files: updatedFiles });
    }
  };
  
  const handleSendFeedback = () => {
     if (!feedbackEmail || !feedbackText || !feedbackSentiment) {
         alert("Please complete all feedback fields.");
         return;
     }
     setFeedbackStatus('sending');
     
     // Construct Mailto
     const subject = `ExtensionGen Feedback (${feedbackSentiment === 'happy' ? 'Positive' : 'Negative'})`;
     const body = `From: ${feedbackEmail}\n\n${feedbackText}`;
     const mailtoLink = `mailto:pam33na@yahoo.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
     
     // Trigger simulated send and actual mailto
     setTimeout(() => {
        window.location.href = mailtoLink;
        setFeedbackStatus('sent');
        setTimeout(() => {
            setFeedbackStatus('idle');
            setFeedbackEmail("");
            setFeedbackText("");
            setFeedbackSentiment(null);
        }, 3000);
     }, 800);
  };

  const getFileIcon = (filename: string) => {
    if (filename.endsWith('.js') || filename.endsWith('.ts') || filename.endsWith('.jsx') || filename.endsWith('.tsx')) return <JsIcon />;
    if (filename.endsWith('.html')) return <HtmlIcon />;
    if (filename.endsWith('.css')) return <CssIcon />;
    if (filename.endsWith('.json')) return <JsonIcon />;
    if (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.ico')) return <ImageIcon />;
    if (filename.endsWith('.md')) return <MarkdownIcon />;
    return <DefaultFileIcon />;
  };

  // Group files logic
  const groupedFiles = useMemo<Record<string, any[]>>(() => {
    if (!result?.files) return {} as Record<string, any[]>;
    
    const groups: Record<string, any[]> = {
      'Config': [],
      'Scripts': [],
      'Views': [],
      'Styles': [],
      'Images': [],
      'Misc': []
    };

    result.files.forEach((file: any) => {
      const path = file.path.toLowerCase();
      if (path.includes('manifest.json') || path.endsWith('.json')) groups['Config'].push(file);
      else if (path.endsWith('.js') || path.endsWith('.ts') || path.endsWith('.jsx')) groups['Scripts'].push(file);
      else if (path.endsWith('.html')) groups['Views'].push(file);
      else if (path.endsWith('.css')) groups['Styles'].push(file);
      else if (path.endsWith('.png') || path.endsWith('.ico') || path.endsWith('.jpg')) groups['Images'].push(file);
      else groups['Misc'].push(file);
    });

    // Remove empty groups
    return Object.entries(groups).reduce((acc, [key, value]) => {
      if (value.length > 0) acc[key] = value;
      return acc;
    }, {} as Record<string, any[]>);

  }, [result]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  // Prompt Analysis
  const promptLength = prompt.length;
  const complexityPercent = Math.min(100, (promptLength / 200) * 100);
  let complexityColor = "bg-emerald-500";
  let complexityText = "Simple";
  if (promptLength > 50) { complexityColor = "bg-blue-500"; complexityText = "Detailed"; }
  if (promptLength > 150) { complexityColor = "bg-purple-500"; complexityText = "Complex"; }

  // Prompt Warning Logic
  const PROMPT_WARN_LIMIT = 1000;
  const PROMPT_CRITICAL_LIMIT = 2000;
  let promptStatusColor = "text-slate-500";
  let promptWarning = null;

  if (promptLength > PROMPT_CRITICAL_LIMIT) {
    promptStatusColor = "text-red-400";
    promptWarning = "Prompt is very long. Results may be truncated or less accurate.";
  } else if (promptLength > PROMPT_WARN_LIMIT) {
    promptStatusColor = "text-yellow-400";
    promptWarning = "Prompt is long. Consider simplifying for better results.";
  }

  // Check if preview is available
  const isHtml = selectedFile?.path.endsWith('.html');
  const isCss = selectedFile?.path.endsWith('.css');
  const showPreview = (isHtml || isCss) && selectedFile?.type === 'text';
  const isImage = selectedFile?.type === 'binary-description';
  
  // Check for edits
  const isEdited = selectedFile && localContent !== selectedFile.content;

  return (
    <div className={`h-screen w-full transition-colors duration-300 flex overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-indigo-200 
        dark:bg-[#111827] dark:text-slate-300 bg-gray-50 text-slate-700`}>
      
      {/* LEFT SIDEBAR: Controls & Input */}
      <div className={`w-[400px] flex-shrink-0 flex flex-col border-r transition-colors duration-300
         dark:border-white/5 dark:bg-[#1f2937] border-gray-200 bg-white`}>
        
        {/* Header */}
        <div className={`p-6 border-b flex-shrink-0 transition-colors duration-300
            dark:border-white/5 dark:bg-[#1a202c] border-gray-100 bg-gray-50`}>
          <div className="flex items-center justify-between mb-1">
             <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-white dark:to-slate-400">
                    ExtensionGen
                </h1>
            </div>
            <button 
                onClick={() => setIsDark(!isDark)}
                className="p-2 rounded-lg transition-colors dark:text-slate-400 dark:hover:bg-white/10 text-slate-500 hover:bg-gray-100"
                title="Toggle Theme"
            >
                {isDark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
          <p className="text-xs dark:text-slate-400 text-slate-500 pl-10">AI-Powered Chrome Extension Builder</p>
        </div>

        {/* INPUT SECTION - Scrollable (Takes available space) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          
          {/* Section: Examples */}
          <div>
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">
              <SparklesIcon /> 
              <span>Quick Start</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(ex)}
                  className={`group relative flex items-center gap-3 p-3 text-left rounded-lg border transition-all duration-200 shadow-sm
                    dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 dark:hover:border-indigo-500/30
                    bg-gray-50 hover:bg-white border-gray-200 hover:border-indigo-300`}
                >
                  <div className="w-1.5 h-1.5 rounded-full dark:bg-slate-500 bg-slate-400 group-hover:bg-indigo-400 transition-colors"></div>
                  <span className="text-xs dark:text-slate-300 text-slate-600 group-hover:dark:text-white group-hover:text-slate-900 line-clamp-1 font-medium">{ex}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section: Prompt Input */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-2 text-xs font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  <span>Specification</span>
               </div>
               {promptLength > 0 && (
                 <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${complexityColor.replace('bg-', 'bg-opacity-20 text-').replace('500', '300')} border border-white/10`}>
                   {complexityText}
                 </span>
               )}
            </div>
            
            <div className={`relative group flex flex-col rounded-xl border overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all shadow-inner
                dark:bg-[#111827] dark:border-white/10 dark:focus-within:border-indigo-500/50
                bg-white border-gray-200 focus-within:border-indigo-500/50
                ${promptLength > PROMPT_WARN_LIMIT ? 'dark:border-yellow-500/30 border-yellow-500/50' : ''}`}>
              <textarea
                className="w-full h-40 bg-transparent text-sm p-4 resize-none font-mono leading-relaxed outline-none
                    dark:text-slate-200 dark:placeholder-slate-600
                    text-slate-800 placeholder-slate-400"
                placeholder="// Describe your extension logic here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
                spellCheck={false}
              />
              
              {/* Clear Button */}
              {prompt.length > 0 && (
                <button 
                    onClick={handleClearPrompt}
                    className="absolute top-2 right-2 p-1.5 rounded-md transition-colors
                        dark:text-slate-500 dark:hover:text-white dark:hover:bg-white/10
                        text-slate-400 hover:text-slate-700 hover:bg-gray-100"
                    title="Clear Prompt"
                >
                    <TrashIcon />
                </button>
              )}

              {/* Status Bar for Input */}
              <div className="h-auto min-h-[24px] border-t flex flex-col justify-center px-3 py-1
                dark:bg-[#0f1523] dark:border-white/5
                bg-gray-50 border-gray-200">
                 <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 w-full mr-4">
                        <div className="h-1 flex-grow dark:bg-gray-800 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${complexityColor} transition-all duration-300`} style={{ width: `${complexityPercent}%` }}></div>
                        </div>
                    </div>
                    <span className={`text-[10px] font-mono whitespace-nowrap ${promptStatusColor}`}>{promptLength} chars</span>
                 </div>
                 {promptWarning && (
                     <div className="flex items-center gap-1.5 mt-1 text-[10px] text-yellow-500 font-medium">
                         <AlertTriangleIcon />
                         <span>{promptWarning}</span>
                     </div>
                 )}
              </div>
            </div>

            <button
              onClick={generateExtension}
              disabled={loading || !prompt.trim()}
              className={`mt-4 w-full py-3 px-4 rounded-lg font-semibold text-sm shadow-lg transition-all duration-200 flex items-center justify-center gap-2 border border-transparent ${
                loading 
                ? 'bg-indigo-900/20 text-indigo-400 border-indigo-500/20 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/20 active:scale-[0.98]'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>Building...</span>
                </>
              ) : (
                <>
                  <span>Generate Code</span>
                  <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </>
              )}
            </button>

             {/* LOADING STEPS FEEDBACK */}
            {loading && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs font-mono text-indigo-300 animate-pulse">
                 <ShieldIcon />
                 <span>{loadingStep}</span>
              </div>
            )}

            {errorDetails && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-lg flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 font-medium text-red-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>{errorDetails.title}</span>
                  </div>
                  <p className="opacity-80 text-xs leading-relaxed">{errorDetails.message}</p>
                  <div className="text-xs opacity-50 mt-1 border-t border-red-500/20 pt-2 flex items-start gap-1.5">
                      <span className="font-semibold text-red-300">Tip:</span> {errorDetails.tip}
                  </div>
              </div>
            )}
          </div>
        </div>
          
        {/* FILE EXPLORER SECTION - Docked at bottom when active */}
        {result && (
            <div className={`flex-shrink-0 h-[45%] border-t flex flex-col animate-in slide-in-from-bottom-6 duration-500
               dark:border-white/10 dark:bg-[#111827] border-gray-200 bg-white`}>
               <div className={`p-4 border-b flex items-center justify-between text-xs font-semibold uppercase tracking-wider flex-shrink-0
                   dark:border-white/5 dark:bg-[#1a202c] dark:text-indigo-400
                   border-gray-200 bg-gray-50 text-indigo-600`}>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    <span>Project Files</span>
                  </div>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-500 dark:text-indigo-300 px-2 py-0.5 rounded-full">{result.files.length} files</span>
               </div>
               
               <div className={`flex-1 overflow-y-auto custom-scrollbar dark:bg-[#111827] bg-white`}>
                  {Object.entries(groupedFiles).map(([groupName, files]) => (
                    <div key={groupName}>
                        <button 
                            onClick={() => toggleGroup(groupName)}
                            className={`w-full flex items-center justify-between px-4 py-1.5 border-b text-[10px] font-bold uppercase tracking-wider transition-colors
                                dark:bg-[#1a202c]/50 dark:hover:bg-[#1a202c] dark:border-white/5 dark:text-slate-500
                                bg-gray-50 hover:bg-gray-100 border-gray-100 text-slate-500`}
                        >
                            <span>{groupName}</span>
                            <span className="text-slate-600">
                                {collapsedGroups[groupName] ? <ChevronRightIcon /> : <ChevronDownIcon />}
                            </span>
                        </button>
                        
                        {!collapsedGroups[groupName] && (
                            <div>
                                {(files as any[]).map((file: any) => (
                                <button
                                    key={file.path}
                                    onClick={() => {
                                    setSelectedFile(file);
                                    setActiveTab('code');
                                    }}
                                    className={`w-full text-left px-4 py-2.5 text-xs font-mono border-b last:border-0 transition-colors flex items-center gap-3
                                    dark:border-white/5 border-gray-100
                                    ${
                                    selectedFile?.path === file.path 
                                    ? 'dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-l-indigo-500 bg-indigo-50 text-indigo-700 border-l-indigo-500 border-l-2' 
                                    : 'dark:text-slate-400 dark:hover:bg-white/5 text-slate-600 hover:bg-gray-50 border-l-2 border-l-transparent'
                                    }`}
                                >
                                    {getFileIcon(file.path)}
                                    <span className="truncate">{file.path}</span>
                                </button>
                                ))}
                            </div>
                        )}
                    </div>
                  ))}
               </div>

               <div className={`p-4 border-t flex-shrink-0 grid grid-cols-[auto_1fr] gap-2
                    dark:border-white/5 dark:bg-[#1a202c] border-gray-200 bg-gray-50`}>
                   <button
                      onClick={handleShareProject}
                      className={`px-3 border rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]
                        dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 dark:border-white/10
                        bg-white hover:bg-gray-100 text-slate-600 border-gray-300`}
                      title="Share Generator Link"
                   >
                      {shareFeedback ? <CheckIcon /> : <ShareIcon />}
                   </button>
                   <button
                      onClick={handleDownloadZip}
                      className="w-full py-2.5 px-4 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-600/20 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                   >
                      <DownloadIcon />
                      Download Bundle
                   </button>
               </div>
            </div>
        )}
        
        {/* Footer Group */}
        <div className="flex-shrink-0 flex flex-col">
            {/* Disclaimer */}
            <div className="p-3 bg-orange-500/10 border-t border-b border-orange-500/20 text-orange-600 dark:text-orange-200 text-xs font-bold text-center">
                ⚠️ Generated code requires review before publishing.
            </div>
            
            {/* Credits */}
            <div className={`p-4 flex flex-col items-center gap-2 text-[10px] border-t
                dark:bg-[#111827] dark:text-slate-300 dark:border-white/5 
                bg-white text-slate-800 border-gray-200 font-medium`}>
                <span>Created December 2025 | E.O. | V1.0 (14122025)</span>
                <div className="flex items-center gap-3">
                    <a href="https://ko-fi.com/secreq" target="_blank" rel="noopener noreferrer" className="hover:text-pink-500 transition-colors" title="Ko-fi"><HeartIcon /></a>
                </div>
            </div>
        </div>
      </div>

      {/* RIGHT MAIN PANEL: Editor View */}
      <div className={`flex-grow flex flex-col relative
          dark:bg-[#111827] bg-gray-50`}>
        {!result ? (
          // Empty State
          <div className="absolute inset-0 flex flex-col items-center justify-center dark:text-slate-500 text-slate-400">
            <div className="w-24 h-24 rounded-full dark:bg-white/5 bg-gray-200 flex items-center justify-center mb-6 animate-pulse">
               <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            </div>
            <h2 className="text-xl font-medium dark:text-slate-400 text-slate-600 mb-2">Ready to Build</h2>
            <p className="text-sm max-w-sm text-center px-4">Enter a prompt on the left to generate your custom Chrome Extension with Manifest V3 support.</p>
          </div>
        ) : (
          <>
            {/* Top Tabs Bar */}
            <div className={`h-12 flex items-center border-b px-4 gap-1
                dark:border-white/5 dark:bg-[#1a202c] border-gray-200 bg-white`}>
              <TabButton 
                active={activeTab === 'code'} 
                onClick={() => setActiveTab('code')} 
                label="Code Editor" 
                icon={<CodeIcon />}
                isDark={isDark}
              />
              <TabButton 
                active={activeTab === 'testing'} 
                onClick={() => setActiveTab('testing')} 
                label="Testing Guide" 
                icon={<PlayIcon />}
                isDark={isDark}
              />
              <TabButton 
                active={activeTab === 'security'} 
                onClick={() => setActiveTab('security')} 
                label="Security Review" 
                icon={<ShieldIcon />}
                isDark={isDark}
              />
              
              <div className="ml-auto flex items-center gap-3 text-xs dark:text-slate-500 text-slate-400">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>Ready</span>
                <span className="hidden md:inline">Manifest V3</span>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-hidden relative">
              <div className="absolute inset-0 overflow-auto custom-scrollbar">
                
                {/* CODE VIEW */}
                {activeTab === 'code' && selectedFile && (
                   <div className="min-h-full flex flex-col h-full">
                      {/* Breadcrumb / File Info */}
                      <div className={`sticky top-0 z-10 backdrop-blur border-b px-6 py-3 flex items-center justify-between shadow-sm flex-shrink-0
                          dark:bg-[#111827]/95 dark:border-white/5 
                          bg-white/95 border-gray-100`}>
                        <div className="flex items-center gap-2 text-sm font-mono">
                          <span className="dark:text-slate-600 text-slate-400">extension/</span>
                          <span className="dark:text-indigo-400 text-indigo-600">{selectedFile.path}</span>
                          {isEdited && (
                             <span className="ml-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border 
                                bg-amber-500/10 text-amber-500 border-amber-500/50 animate-pulse">
                                Unsaved Edits
                             </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {showPreview && (
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border
                                    dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20
                                    bg-emerald-50 text-emerald-600 border-emerald-200">
                                    <EyeIcon /> Live Preview
                                </span>
                            )}
                            <button 
                                onClick={handleDownloadSingleFile}
                                className={`p-1.5 rounded-md border transition-all
                                    dark:bg-white/5 dark:text-slate-400 dark:border-white/10 dark:hover:bg-white/10 dark:hover:text-slate-200
                                    bg-gray-100 text-slate-500 border-gray-200 hover:bg-gray-200 hover:text-slate-700`}
                                title="Download File"
                            >
                                <DownloadFileIcon />
                            </button>
                            <button
                                onClick={handleCopyCode}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                                    copyFeedback 
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                                    : 'dark:bg-white/5 dark:text-slate-400 dark:border-white/10 dark:hover:bg-white/10 dark:hover:text-slate-200 bg-gray-100 text-slate-500 border-gray-200 hover:bg-gray-200 hover:text-slate-700'
                                }`}
                            >
                                {copyFeedback ? <CheckIcon /> : <CopyIcon />}
                                {copyFeedback ? 'Copied' : 'Copy'}
                            </button>
                            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded
                                dark:bg-white/5 dark:text-slate-500 
                                bg-gray-100 text-slate-400">{selectedFile.language || (isImage ? 'IMG' : 'TEXT')}</span>
                        </div>
                      </div>
                      
                      {/* Editor Content + Preview Split */}
                      <div className="flex-grow flex overflow-hidden">
                        {isImage ? (
                           // IMAGE / ICON EDITOR VIEW
                           <div className="w-full flex flex-col items-center justify-start py-10 gap-8 overflow-auto">
                              
                              <div className="flex flex-col items-center gap-4">
                                <p className="text-sm font-medium dark:text-slate-300 text-slate-600 uppercase tracking-widest">Icon Preview</p>
                                <div className="relative group">
                                    <div className="absolute -inset-4 bg-indigo-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition duration-700"></div>
                                    <div className={`relative p-8 border rounded-xl
                                        dark:bg-white/5 dark:border-white/10 
                                        bg-white border-gray-200 shadow-sm`}>
                                        {/* Use localContent so it updates on edit */}
                                        <IconPreview description={localContent} />
                                    </div>
                                </div>
                              </div>

                              <div className="w-full max-w-2xl px-6">
                                 <IconEditor 
                                    description={localContent} 
                                    onUpdate={handleContentChange} 
                                 />
                              </div>

                              <div className="w-full max-w-2xl px-6 mt-4">
                                  <label className="text-xs font-semibold dark:text-slate-500 text-slate-400 uppercase tracking-wider mb-2 block">Raw Description</label>
                                  <textarea 
                                      value={localContent}
                                      onChange={(e) => handleContentChange(e.target.value)}
                                      className={`w-full h-24 border rounded-lg p-4 font-mono text-xs focus:outline-none resize-none
                                          dark:bg-[#0b0f19] dark:border-white/10 dark:text-slate-400 dark:focus:border-indigo-500/50
                                          bg-gray-50 border-gray-200 text-slate-600 focus:border-indigo-500/50`}
                                  />
                              </div>
                           </div>
                        ) : (
                           // TEXT / CODE EDITOR VIEW
                           <>
                             {/* Code Editor */}
                             <div className={`${showPreview ? 'w-1/2 border-r dark:border-white/10 border-gray-200' : 'w-full'} h-full flex flex-col`}>
                                 <textarea 
                                    value={localContent}
                                    onChange={(e) => handleContentChange(e.target.value)}
                                    className={`flex-grow w-full h-full p-6 font-mono text-[13px] leading-relaxed resize-none focus:outline-none custom-scrollbar
                                        dark:bg-[#111827] dark:text-slate-300 
                                        bg-white text-slate-700`}
                                    spellCheck={false}
                                 />
                             </div>

                             {/* Live Preview Pane */}
                             {showPreview && (
                                 <div className="w-1/2 h-full bg-[#ffffff] relative">
                                    <div className="absolute top-0 left-0 bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-br z-10 border-b border-r border-slate-200">
                                        Browser Preview
                                    </div>
                                    <iframe 
                                        className="w-full h-full border-none"
                                        title="Preview"
                                        sandbox="allow-same-origin"
                                        srcDoc={constructPreview(selectedFile, localContent, result.files)}
                                    />
                                 </div>
                             )}
                           </>
                        )}
                      </div>
                   </div>
                )}

                {/* GUIDES VIEW */}
                {(activeTab === 'testing' || activeTab === 'security') && (
                  <div className="max-w-3xl mx-auto p-12">
                     <div className={`prose prose-slate 
                        dark:prose-invert
                        dark:[&_h1]:text-indigo-100 [&_h1]:text-indigo-900
                        dark:[&_h2]:text-indigo-200 [&_h2]:text-indigo-800
                        dark:[&_h3]:text-indigo-300 [&_h3]:text-indigo-700
                        dark:[&_code]:bg-[#1f2937] [&_code]:bg-gray-100 dark:[&_code]:text-indigo-300 [&_code]:text-indigo-600
                        dark:[&_pre]:bg-[#1f2937] [&_pre]:bg-gray-800 dark:[&_pre]:border-white/10
                     `}>
                        <Markdown>{activeTab === 'testing' ? result.testing_guide : result.security_review}</Markdown>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* FEEDBACK PANEL */}
      <div className={`w-80 flex-shrink-0 border-l transition-colors duration-300 flex flex-col
         dark:border-white/5 dark:bg-[#111827] bg-white border-gray-200`}>
         <div className="p-6 border-b dark:border-white/5 border-gray-100">
             <div className="flex items-center gap-2 mb-2">
                <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg></span>
                <h2 className="text-lg font-bold dark:text-white text-slate-800">Feedback</h2>
             </div>
             <p className="text-xs text-slate-500 leading-relaxed">We value your input! Help us improve the Extension Generator.</p>
         </div>
         
         <div className="p-6 flex flex-col gap-6 flex-1 overflow-y-auto custom-scrollbar">
            {/* Email Input */}
            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider dark:text-slate-400 text-slate-500">Your Email</label>
                <input 
                    type="email"
                    value={feedbackEmail}
                    onChange={(e) => setFeedbackEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-4 py-3 rounded-lg text-sm transition-all outline-none border focus:ring-2 focus:ring-indigo-500/20
                    dark:bg-[#1a202c] dark:border-white/10 dark:text-slate-200 dark:focus:border-indigo-500/50 dark:placeholder-slate-600
                    bg-gray-50 border-gray-200 text-slate-800 focus:border-indigo-500 placeholder-slate-400"
                />
            </div>

            {/* Message Input */}
            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider dark:text-slate-400 text-slate-500">Message</label>
                <textarea 
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Tell us what you think..."
                    className="w-full h-32 px-4 py-3 rounded-lg text-sm resize-none transition-all outline-none border focus:ring-2 focus:ring-indigo-500/20
                    dark:bg-[#1a202c] dark:border-white/10 dark:text-slate-200 dark:focus:border-indigo-500/50 dark:placeholder-slate-600
                    bg-gray-50 border-gray-200 text-slate-800 focus:border-indigo-500 placeholder-slate-400"
                />
            </div>

            {/* Sentiment */}
            <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider dark:text-slate-400 text-slate-500">Experience</label>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setFeedbackSentiment('happy')}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all duration-200 ${
                            feedbackSentiment === 'happy'
                            ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500 ring-1 ring-emerald-500/50'
                            : 'dark:bg-[#1a202c] dark:border-white/5 dark:text-slate-500 dark:hover:bg-white/5 bg-gray-50 border-gray-200 text-slate-400 hover:bg-gray-100 hover:text-slate-600'
                        }`}
                    >
                        <SmileIcon />
                        <span className="text-xs font-bold">Good</span>
                    </button>
                    <button 
                        onClick={() => setFeedbackSentiment('sad')}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all duration-200 ${
                            feedbackSentiment === 'sad'
                            ? 'bg-rose-500/10 border-rose-500/50 text-rose-500 ring-1 ring-rose-500/50'
                            : 'dark:bg-[#1a202c] dark:border-white/5 dark:text-slate-500 dark:hover:bg-white/5 bg-gray-50 border-gray-200 text-slate-400 hover:bg-gray-100 hover:text-slate-600'
                        }`}
                    >
                        <SadIcon />
                        <span className="text-xs font-bold">Bad</span>
                    </button>
                </div>
            </div>

            {/* Submit */}
            <button
                onClick={handleSendFeedback}
                disabled={feedbackStatus !== 'idle'}
                className={`w-full py-3.5 rounded-lg font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all
                    ${feedbackStatus === 'sent' 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white hover:shadow-indigo-500/25 active:scale-[0.98]'
                    }
                    ${feedbackStatus === 'sending' ? 'opacity-70 cursor-wait' : ''}
                `}
            >
                {feedbackStatus === 'idle' && (
                    <>Send Feedback <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></>
                )}
                {feedbackStatus === 'sending' && (
                    <>Sending...</>
                )}
                {feedbackStatus === 'sent' && (
                    <>Sent! <CheckIcon /></>
                )}
            </button>
         </div>
      </div>
    </div>
  );
}

// --- Helper Components & Functions ---

function TabButton({ active, onClick, label, icon, isDark }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode, isDark: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 text-xs font-medium transition-all duration-200 rounded-md flex items-center gap-2 ${
        active 
        ? 'dark:text-white dark:bg-white/10 dark:shadow-sm text-indigo-600 bg-indigo-50 shadow-sm' 
        : 'dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-white/5 text-slate-500 hover:text-slate-800 hover:bg-gray-100'
      }`}
    >
      {icon}
      {label}
      {active && <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>}
    </button>
  );
}

function IconEditor({ description, onUpdate }: { description: string, onUpdate: (s: string) => void }) {
    // Helper to parse existing colors
    const getColors = (desc: string) => {
        const bgMatch = desc.match(/background\s+((?:#[0-9a-fA-F]{3,6}\s*)+)/i);
        const bgColors = bgMatch ? bgMatch[1].trim().split(/\s+/) : ['#3C78DC'];
        
        const fgMatch = desc.match(/foreground\s+(#[0-9a-fA-F]{3,6})/i);
        const fgColor = fgMatch ? fgMatch[1] : '#FFFFFF';
        
        return { bgColors, fgColor };
    };

    const { bgColors, fgColor } = getColors(description);

    const updateColor = (type: 'bg' | 'fg', index: number, newColor: string) => {
        let newDesc = description;
        if (type === 'bg') {
            const newBgColors = [...bgColors];
            newBgColors[index] = newColor;
            // Replace the entire background segment regex
            newDesc = newDesc.replace(/background\s+((?:#[0-9a-fA-F]{3,6}\s*)+)/i, `background ${newBgColors.join(' ')} `);
        } else {
            newDesc = newDesc.replace(/foreground\s+(#[0-9a-fA-F]{3,6})/i, `foreground ${newColor}`);
        }
        onUpdate(newDesc);
    };

    const addBgColor = () => {
         const newBgColors = [...bgColors, '#888888'];
         const newDesc = description.replace(/background\s+((?:#[0-9a-fA-F]{3,6}\s*)+)/i, `background ${newBgColors.join(' ')} `);
         onUpdate(newDesc);
    }
    
    const removeBgColor = (index: number) => {
         if (bgColors.length <= 1) return;
         const newBgColors = bgColors.filter((_, i) => i !== index);
         const newDesc = description.replace(/background\s+((?:#[0-9a-fA-F]{3,6}\s*)+)/i, `background ${newBgColors.join(' ')} `);
         onUpdate(newDesc);
    }

    return (
        <div className={`rounded-lg border p-4 flex flex-col gap-4
            dark:bg-[#1a202c] dark:border-white/5 
            bg-white border-gray-200 shadow-sm`}>
            <h3 className="text-xs font-semibold dark:text-indigo-400 text-indigo-600 uppercase tracking-wider">Theme Colors</h3>
            
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs dark:text-slate-400 text-slate-500">Background Gradient</span>
                    <button onClick={addBgColor} className="text-[10px] dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 bg-gray-100 hover:bg-gray-200 text-slate-600 px-2 py-0.5 rounded">+ Add Stop</button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {bgColors.map((color, i) => (
                        <div key={i} className="flex flex-col items-center gap-1 group relative">
                             <input 
                                type="color" 
                                value={color} 
                                onChange={(e) => updateColor('bg', i, e.target.value)}
                                className="w-10 h-10 rounded cursor-pointer border-0 p-0 bg-transparent" 
                             />
                             <span className="text-[10px] font-mono dark:text-slate-500 text-slate-400">{color}</span>
                             {bgColors.length > 1 && (
                                <button onClick={() => removeBgColor(i)} className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                             )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="h-px dark:bg-white/5 bg-gray-200 w-full"></div>

            <div className="flex flex-col gap-3">
                <span className="text-xs dark:text-slate-400 text-slate-500">Foreground (Text/Symbol)</span>
                <div className="flex flex-col items-start gap-1">
                        <input 
                        type="color" 
                        value={fgColor} 
                        onChange={(e) => updateColor('fg', 0, e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border-0 p-0 bg-transparent" 
                        />
                        <span className="text-[10px] font-mono dark:text-slate-500 text-slate-400">{fgColor}</span>
                </div>
            </div>
        </div>
    );
}

// Logic to construct preview HTML with injected CSS
function constructPreview(currentFile: any, currentContent: string, allFiles: any[]) {
    if (!currentFile) return "";
    
    let htmlContent = "";
    let cssContentToInject = "";

    // Case 1: Previewing HTML
    if (currentFile.path.endsWith('.html')) {
        htmlContent = currentContent;
    } 
    // Case 2: Previewing CSS - find a relevant HTML file
    else if (currentFile.path.endsWith('.css')) {
        // Find popup.html or options.html or just the first html file
        const htmlFile = allFiles.find(f => f.path.endsWith('popup.html')) 
                      || allFiles.find(f => f.path.endsWith('.html'));
        
        if (htmlFile) {
            htmlContent = htmlFile.content;
            cssContentToInject = currentContent; // The CSS we are currently editing
        } else {
            return "<html><body><p style='padding: 20px; font-family: sans-serif;'>No HTML file found to preview this CSS.</p></body></html>";
        }
    } else {
        return "";
    }

    // Inject styles
    // 1. If we are editing CSS, we want to replace the link tag that points to THIS css file with our live content.
    // 2. For other link tags, we want to find their content in allFiles and inject it.

    // Regex to find <link rel="stylesheet" href="...">
    const linkTagRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;

    const replacedHtml = htmlContent.replace(linkTagRegex, (match, href) => {
        // Clean up href (remove ./ etc) to match file paths if needed, though usually simple in this generator
        const cssFileName = href.split('/').pop(); 
        
        // If we are currently editing this CSS file
        if (currentFile.path.endsWith(cssFileName) || (currentFile.path.endsWith('.css') && currentFile.path.includes(cssFileName))) {
             return `<style>${currentContent}</style>`;
        }
        
        // Otherwise look it up in files
        const linkedFile = allFiles.find(f => f.path.endsWith(cssFileName));
        if (linkedFile) {
            return `<style>${linkedFile.content}</style>`;
        }
        
        return match; // Keep original if not found (though it won't load in iframe usually)
    });

    return replacedHtml;
}

async function generateIconBlob(description: string): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  // Size (e.g., 48x48)
  const sizeMatch = description.match(/(\d+)\s*x\s*(\d+)/i);
  const width = sizeMatch ? parseInt(sizeMatch[1]) : 48;
  const height = sizeMatch ? parseInt(sizeMatch[2]) : 48;
  
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // --- New Background Parsing Logic (supports gradients) ---
  const bgMatch = description.match(/background\s+((?:#[0-9a-fA-F]{3,6}\s*)+)/i);
  let bgColors = ['#3C78DC']; // Default blue
  if (bgMatch) {
    // Extract one or more hex codes
    bgColors = bgMatch[1].trim().split(/\s+/);
  } else {
     // Fallback for old style "solid blue background" or "solid #HEX background"
     const solidHex = description.match(/solid\s+(#[0-9a-fA-F]{3,6})\s+background/i);
     if (solidHex) bgColors = [solidHex[1]];
     else {
        const solidName = description.match(/solid\s+([a-zA-Z]+)\s+background/i);
        if (solidName) bgColors = [solidName[1]]; // Browser named color
     }
  }

  // Draw Background
  if (bgColors.length > 1) {
    // Linear Gradient top-left to bottom-right
    const grad = ctx.createLinearGradient(0, 0, width, height);
    // Distribute colors evenly
    bgColors.forEach((col, i) => {
        grad.addColorStop(i / (bgColors.length - 1), col);
    });
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = bgColors[0];
  }
  ctx.fillRect(0, 0, width, height);


  // --- New Foreground Parsing Logic ---
  const fgMatch = description.match(/foreground\s+(#[0-9a-fA-F]{3,6})/i);
  const fgColor = fgMatch ? fgMatch[1] : '#FFFFFF';

  // Text / Initials
  const textMatch = description.match(/"([^"]+)"/) || description.match(/'([^']+)'/);
  if (textMatch) {
    const text = textMatch[1];
    ctx.fillStyle = fgColor;
    ctx.font = `bold ${Math.floor(width / 2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);
  }

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function IconPreview({ description }: { description: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    // Logic mirrors generateIconBlob
    const sizeMatch = description.match(/(\d+)\s*x\s*(\d+)/i);
    const width = sizeMatch ? parseInt(sizeMatch[1]) : 48;
    const height = sizeMatch ? parseInt(sizeMatch[2]) : 48;
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    const bgMatch = description.match(/background\s+((?:#[0-9a-fA-F]{3,6}\s*)+)/i);
    let bgColors = ['#3C78DC'];
    if (bgMatch) {
      bgColors = bgMatch[1].trim().split(/\s+/);
    } else {
       const solidHex = description.match(/solid\s+(#[0-9a-fA-F]{3,6})\s+background/i);
       if (solidHex) bgColors = [solidHex[1]];
       else {
          const solidName = description.match(/solid\s+([a-zA-Z]+)\s+background/i);
          if (solidName) bgColors = [solidName[1]];
       }
    }

    if (bgColors.length > 1) {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      bgColors.forEach((col, i) => {
          grad.addColorStop(i / (bgColors.length - 1), col);
      });
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = bgColors[0];
    }
    ctx.fillRect(0, 0, width, height);

    // Foreground
    const fgMatch = description.match(/foreground\s+(#[0-9a-fA-F]{3,6})/i);
    const fgColor = fgMatch ? fgMatch[1] : '#FFFFFF';

    // Text
    const textMatch = description.match(/"([^"]+)"/) || description.match(/'([^']+)'/);
    if (textMatch) {
      ctx.fillStyle = fgColor;
      ctx.font = `bold ${Math.floor(width / 2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(textMatch[1], width / 2, height / 2);
    }
  }, [description]);

  return <canvas ref={canvasRef} className="shadow-lg rounded-lg" />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);