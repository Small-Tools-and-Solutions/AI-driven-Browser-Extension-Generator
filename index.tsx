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
4. "binary-description" for icons MUST follow this format: 'PNG icon, SIZE x SIZE, style [flat|gradient], background HEX [HEX], foreground HEX, text "INITIALS" centered.' 
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
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'code' | 'testing' | 'security'>('code');
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  // File explorer collapsing state
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const generateExtension = async () => {
    if (!prompt.trim()) return;
    
    // Check if result exists and confirm with user before proceeding
    if (result) {
        const confirmed = window.confirm("Generating a new extension will discard your current files. Are you sure you want to proceed?");
        if (!confirmed) return;
    }
    
    setLoading(true);
    setLoadingStep("Initializing builder...");
    setError(null);
    setResult(null);
    setSelectedFile(null);
    setCollapsedGroups({}); // Reset collapse state

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
        throw new Error("Received malformed JSON from the AI. Please try again.");
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
      let userMessage = "An unexpected error occurred.";
      
      if (typeof err.message === 'string') {
          if (err.message.includes('400')) userMessage = "Request invalid. Please check your prompt.";
          else if (err.message.includes('429')) userMessage = "Too many requests. Please wait a moment.";
          else if (err.message.includes('503') || err.message.includes('500')) userMessage = "AI service unavailable. Please try again later.";
          else userMessage = err.message;
      }
      
      setError(userMessage);
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

  const handleCopyCode = () => {
    if (selectedFile?.content) {
      navigator.clipboard.writeText(selectedFile.content);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const handleClearPrompt = () => {
    setPrompt("");
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

  // Calculate "complexity" for visual feedback
  const promptLength = prompt.length;
  const complexityPercent = Math.min(100, (promptLength / 200) * 100);
  let complexityColor = "bg-emerald-500";
  let complexityText = "Simple";
  if (promptLength > 50) { complexityColor = "bg-blue-500"; complexityText = "Detailed"; }
  if (promptLength > 150) { complexityColor = "bg-purple-500"; complexityText = "Complex"; }

  return (
    <div className="h-screen w-full bg-[#111827] text-slate-300 flex overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* LEFT SIDEBAR: Controls & Input */}
      <div className="w-[400px] flex-shrink-0 flex flex-col border-r border-white/5 bg-[#1f2937]">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-[#1a202c] flex-shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              ExtensionGen
            </h1>
          </div>
          <p className="text-xs text-slate-400 pl-10">AI-Powered Chrome Extension Builder</p>
        </div>

        {/* INPUT SECTION - Scrollable (Takes available space) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          
          {/* Section: Examples */}
          <div>
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
              <SparklesIcon /> 
              <span>Quick Start</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(ex)}
                  className="group relative flex items-center gap-3 p-3 text-left rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-indigo-500/30 transition-all duration-200 shadow-sm"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500 group-hover:bg-indigo-400 transition-colors"></div>
                  <span className="text-xs text-slate-300 group-hover:text-white line-clamp-1 font-medium">{ex}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section: Prompt Input */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-3">
               <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  <span>Specification</span>
               </div>
               {promptLength > 0 && (
                 <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${complexityColor.replace('bg-', 'bg-opacity-20 text-').replace('500', '300')} border border-white/10`}>
                   {complexityText}
                 </span>
               )}
            </div>
            
            <div className="relative group flex flex-col bg-[#111827] rounded-xl border border-white/10 overflow-hidden focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all shadow-inner">
              <textarea
                className="w-full h-40 bg-transparent text-sm text-slate-200 p-4 resize-none placeholder-slate-600 font-mono leading-relaxed outline-none"
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
                    className="absolute top-2 right-2 p-1.5 text-slate-500 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                    title="Clear Prompt"
                >
                    <TrashIcon />
                </button>
              )}

              {/* Status Bar for Input */}
              <div className="h-6 bg-[#0f1523] border-t border-white/5 flex items-center px-3 justify-between">
                 <div className="flex items-center gap-2 w-full mr-4">
                    <div className="h-1 flex-grow bg-gray-800 rounded-full overflow-hidden">
                       <div className={`h-full ${complexityColor} transition-all duration-300`} style={{ width: `${complexityPercent}%` }}></div>
                    </div>
                 </div>
                 <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">{promptLength} chars</span>
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

            {error && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-lg flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 font-medium text-red-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span>Generation Failed</span>
                  </div>
                  <p className="opacity-80">{error}</p>
                  <div className="text-xs opacity-50 mt-1 border-t border-red-500/20 pt-2">
                      Tip: Try simplifying your request or checking your connection.
                  </div>
              </div>
            )}
          </div>
        </div>
          
        {/* FILE EXPLORER SECTION - Docked at bottom when active */}
        {result && (
            <div className="flex-shrink-0 h-[45%] border-t border-white/10 bg-[#111827] flex flex-col animate-in slide-in-from-bottom-6 duration-500">
               <div className="p-4 border-b border-white/5 bg-[#1a202c] flex items-center justify-between text-xs font-semibold text-indigo-400 uppercase tracking-wider flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                    <span>Project Files</span>
                  </div>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full">{result.files.length} files</span>
               </div>
               
               <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#111827]">
                  {Object.entries(groupedFiles).map(([groupName, files]) => (
                    <div key={groupName}>
                        <button 
                            onClick={() => toggleGroup(groupName)}
                            className="w-full flex items-center justify-between px-4 py-1.5 bg-[#1a202c]/50 hover:bg-[#1a202c] border-b border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-wider transition-colors"
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
                                    className={`w-full text-left px-4 py-2.5 text-xs font-mono border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors flex items-center gap-3 ${
                                    selectedFile?.path === file.path 
                                    ? 'bg-indigo-500/10 text-indigo-300 border-l-2 border-l-indigo-500' 
                                    : 'text-slate-400 border-l-2 border-l-transparent'
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

               <div className="p-4 border-t border-white/5 bg-[#1a202c] flex-shrink-0">
                   <button
                      onClick={handleDownloadZip}
                      className="w-full py-2.5 px-4 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-600/20 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                   >
                      <DownloadIcon />
                      Download Bundle
                   </button>
               </div>
            </div>
        )}
        
        {/* Footer */}
        <div className="p-4 border-t border-white/5 text-[10px] text-slate-500 text-center bg-[#1f2937] flex-shrink-0">
          Generated code requires review before publishing.
        </div>
      </div>

      {/* RIGHT MAIN PANEL: Editor View */}
      <div className="flex-grow flex flex-col bg-[#111827] relative">
        {!result ? (
          // Empty State
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 animate-pulse">
               <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            </div>
            <h2 className="text-xl font-medium text-slate-400 mb-2">Ready to Build</h2>
            <p className="text-sm max-w-sm text-center px-4">Enter a prompt on the left to generate your custom Chrome Extension with Manifest V3 support.</p>
          </div>
        ) : (
          <>
            {/* Top Tabs Bar */}
            <div className="h-12 flex items-center border-b border-white/5 bg-[#1a202c] px-4 gap-1">
              <TabButton 
                active={activeTab === 'code'} 
                onClick={() => setActiveTab('code')} 
                label="Code Editor" 
                icon={<CodeIcon />}
              />
              <TabButton 
                active={activeTab === 'testing'} 
                onClick={() => setActiveTab('testing')} 
                label="Testing Guide" 
                icon={<PlayIcon />}
              />
              <TabButton 
                active={activeTab === 'security'} 
                onClick={() => setActiveTab('security')} 
                label="Security Review" 
                icon={<ShieldIcon />}
              />
              
              <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div>Ready</span>
                <span className="hidden md:inline">Manifest V3</span>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-hidden relative">
              <div className="absolute inset-0 overflow-auto custom-scrollbar">
                
                {/* CODE VIEW */}
                {activeTab === 'code' && selectedFile && (
                   <div className="min-h-full flex flex-col">
                      {/* Breadcrumb / File Info */}
                      <div className="sticky top-0 z-10 bg-[#111827]/95 backdrop-blur border-b border-white/5 px-6 py-3 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2 text-sm text-slate-300 font-mono">
                          <span className="text-slate-600">extension/</span>
                          <span className="text-indigo-400">{selectedFile.path}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            {selectedFile.type === 'text' && (
                                <button
                                    onClick={handleCopyCode}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                                        copyFeedback 
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200'
                                    }`}
                                >
                                    {copyFeedback ? <CheckIcon /> : <CopyIcon />}
                                    {copyFeedback ? 'Copied' : 'Copy'}
                                </button>
                            )}
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">{selectedFile.language || 'TEXT'}</span>
                        </div>
                      </div>
                      
                      {/* Editor Content */}
                      <div className="p-6">
                        {selectedFile.type === 'text' ? (
                           <pre className="font-mono text-[13px] leading-relaxed text-slate-300 tab-4">
                             {/* Simple highlighting simulation by classname wrapping is tricky without a library, sticking to clean mono */}
                             {selectedFile.content}
                           </pre>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-20 gap-6">
                             <div className="relative group">
                                <div className="absolute -inset-4 bg-indigo-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition duration-700"></div>
                                <div className="relative p-8 bg-white/5 border border-white/10 rounded-xl">
                                    <IconPreview description={selectedFile.content} />
                                </div>
                             </div>
                             <div className="text-center">
                               <p className="text-sm font-medium text-slate-300 mb-1">Asset Preview</p>
                               <p className="text-xs text-slate-500 font-mono max-w-md">"{selectedFile.content}"</p>
                             </div>
                          </div>
                        )}
                      </div>
                   </div>
                )}

                {/* GUIDES VIEW */}
                {(activeTab === 'testing' || activeTab === 'security') && (
                  <div className="max-w-3xl mx-auto p-12">
                     <div className="prose prose-invert prose-slate prose-headings:font-medium prose-headings:text-indigo-100 prose-p:text-slate-400 prose-p:mb-6 prose-p:leading-relaxed prose-li:mb-2 prose-pre:bg-[#1f2937] prose-pre:border prose-pre:border-white/10 prose-strong:text-slate-200">
                        <Markdown>{activeTab === 'testing' ? result.testing_guide : result.security_review}</Markdown>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Helper Components & Functions ---

function TabButton({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 text-xs font-medium transition-all duration-200 rounded-md flex items-center gap-2 ${
        active 
        ? 'text-white bg-white/10 shadow-sm' 
        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
      }`}
    >
      {icon}
      {label}
      {active && <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50"></div>}
    </button>
  );
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