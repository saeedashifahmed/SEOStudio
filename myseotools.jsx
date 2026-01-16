import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Type, 
  FileText, 
  CheckCircle, 
  TrendingUp, 
  Scissors, 
  Hash, 
  Sparkles, 
  Copy, 
  Check, 
  AlertCircle, 
  Loader2,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

/**
 * GEMINI API UTILITIES
 * Handles authentication and exponential backoff for robustness.
 */
const apiKey = ""; // Injected at runtime

const generateContent = async (prompt, systemInstruction) => {
  const model = "gemini-2.5-flash-preview-09-2025";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] }
  };

  const delays = [1000, 2000, 4000, 8000, 16000];
  
  for (let i = 0; i <= delays.length; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        // If it's a 429 or 5xx, we might want to retry
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`API Error: ${response.status}`);
        }
        // For 400s (bad request), fail immediately
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "API Request Failed");
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

    } catch (error) {
      if (i === delays.length) throw error; // Rethrow after last attempt
      await new Promise(resolve => setTimeout(resolve, delays[i]));
    }
  }
};

/**
 * COMPONENTS
 */

// --- Shared UI Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const Button = ({ onClick, disabled, loading, children, variant = "primary", className = "" }) => {
  const baseStyles = "inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-400",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-400"
  };
  
  return (
    <button 
      onClick={onClick} 
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
};

const Label = ({ children }) => (
  <label className="block text-sm font-semibold text-slate-700 mb-1">{children}</label>
);

const TextArea = ({ value, onChange, placeholder, rows = 6, className = "" }) => (
  <textarea
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    rows={rows}
    className={`w-full p-3 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none text-slate-800 text-sm ${className}`}
  />
);

const Input = ({ value, onChange, placeholder, className = "" }) => (
  <input
    type="text"
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    className={`w-full p-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-slate-800 text-sm ${className}`}
  />
);

const ResultBox = ({ title, content, loading }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Fallback for iframe environments where clipboard API might be restricted
    try {
      const textArea = document.createElement("textarea");
      textArea.value = content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  if (!content && !loading) return null;

  return (
    <div className="mt-6 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{title}</h3>
        {content && (
          <button 
            onClick={handleCopy}
            className="flex items-center text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
            {copied ? "Copied" : "Copy Text"}
          </button>
        )}
      </div>
      <div className="relative bg-slate-50 rounded-xl border border-slate-200 p-4 min-h-[150px]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <span className="text-sm">Generating AI Insights...</span>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Feature Components ---

const UrlTrimmer = () => {
  const [inputUrl, setInputUrl] = useState('');
  const [cleanedUrl, setCleanedUrl] = useState('');

  const cleanUrls = () => {
    const lines = inputUrl.split('\n');
    
    const processed = lines.map(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return ''; // Preserve empty lines structure if desired, or skip
      
      try {
        const urlObj = new URL(trimmedLine);
        // Remove common tracking parameters
        const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref', '_ga'];
        paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
        return urlObj.toString();
      } catch (e) {
        // Return original line with error marker if invalid, so user sees which one failed
        return `${trimmedLine} (Invalid URL)`;
      }
    });

    setCleanedUrl(processed.join('\n'));
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100">
        <h2 className="text-xl font-bold text-indigo-900 mb-2">Bulk SEO URL Cleaner</h2>
        <p className="text-indigo-700/80 text-sm">Remove tracking parameters (UTM, fbclid, etc.) from multiple links at once.</p>
      </div>

      <Card className="p-6">
        <Label>Enter URLs (One per line)</Label>
        <TextArea 
          value={inputUrl} 
          onChange={(e) => setInputUrl(e.target.value)} 
          placeholder={`https://example.com/page?utm_source=google\nhttps://anothersite.com/post?fbclid=123...`}
          rows={8}
        />
        <div className="mt-4">
          <Button onClick={cleanUrls} disabled={!inputUrl}>Clean URLs</Button>
        </div>
        <ResultBox title="Cleaned URLs" content={cleanedUrl} />
      </Card>
    </div>
  );
};

const WordCounter = () => {
  const [text, setText] = useState('');
  
  const stats = {
    words: text.trim() === '' ? 0 : text.trim().split(/\s+/).length,
    chars: text.length,
    charsNoSpace: text.replace(/\s/g, '').length,
    paragraphs: text.trim() === '' ? 0 : text.trim().split(/\n\s*\n/).length,
    readTime: Math.ceil(text.trim().split(/\s+/).length / 200) + " min"
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-xl border border-emerald-100">
        <h2 className="text-xl font-bold text-emerald-900 mb-2">Word & Character Counter</h2>
        <p className="text-emerald-700/80 text-sm">Real-time analysis of your content density and reading time.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Words", val: stats.words },
          { label: "Characters", val: stats.chars },
          { label: "No Spaces", val: stats.charsNoSpace },
          { label: "Paragraphs", val: stats.paragraphs },
          { label: "Read Time", val: stats.readTime }
        ].map((stat, idx) => (
          <Card key={idx} className="p-4 flex flex-col items-center justify-center bg-slate-50">
            <span className="text-2xl font-bold text-slate-800">{stat.val}</span>
            <span className="text-xs text-slate-500 uppercase font-medium mt-1">{stat.label}</span>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <Label>Content</Label>
        <TextArea 
          value={text} 
          onChange={(e) => setText(e.target.value)} 
          placeholder="Paste your content here to analyze..." 
          rows={12}
        />
      </Card>
    </div>
  );
};

const AiWriter = () => {
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [tone, setTone] = useState('Professional');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!topic) return;
    setLoading(true);
    try {
      const prompt = `Topic: ${topic}\nTarget Keywords: ${keywords}\nTone: ${tone}`;
      const systemInstruction = `You are a professional, industry-grade SEO Article Writer. 
      Write a comprehensive, engaging, and human-like article based on the provided topic.
      - Structure the article with a catchy H1 title, an engaging introduction, multiple H2/H3 subheadings, and a strong conclusion.
      - Seamlessly integrate the provided target keywords without "keyword stuffing".
      - Use the requested tone.
      - Use markdown formatting for headings, bold text, and lists.
      - Ensure the content provides real value to the reader.`;
      
      const content = await generateContent(prompt, systemInstruction);
      setResult(content);
    } catch (error) {
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-6 rounded-xl border border-purple-100">
        <h2 className="text-xl font-bold text-purple-900 mb-2">AI Article Writer</h2>
        <p className="text-purple-700/80 text-sm">Generate human-like, SEO-optimized long-form content instantly.</p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <Label>Article Topic</Label>
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., The Future of Remote Work in 2026" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Target Keywords (Comma separated)</Label>
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g., remote work, digital nomad, productivity" />
          </div>
          <div>
            <Label>Tone of Voice</Label>
            <select 
              value={tone} 
              onChange={(e) => setTone(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-slate-800"
            >
              <option>Professional</option>
              <option>Conversational</option>
              <option>Witty & Fun</option>
              <option>Authoritative</option>
              <option>Empathetic</option>
            </select>
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={handleGenerate} loading={loading} disabled={!topic} className="w-full md:w-auto">
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Article
          </Button>
        </div>
      </Card>

      <ResultBox title="Generated Article" content={result} loading={loading} />
    </div>
  );
};

const AiImprover = () => {
  const [content, setContent] = useState('');
  const [goal, setGoal] = useState('Readability');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImprove = async () => {
    if (!content) return;
    setLoading(true);
    try {
      const prompt = `Content to Improve: ${content}\nGoal: ${goal}`;
      const systemInstruction = `You are an expert Content Editor and SEO Specialist.
      Rewrite the provided text to improve it based on the specified goal.
      - Maintain the original meaning but enhance clarity, flow, and engagement.
      - Use markdown for formatting.
      - If the goal is 'SEO', focus on keyword placement and structure.
      - If the goal is 'Readability', focus on shorter sentences and simple words.
      - Provide ONLY the rewritten version.`;
      
      const improved = await generateContent(prompt, systemInstruction);
      setResult(improved);
    } catch (error) {
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 rounded-xl border border-orange-100">
        <h2 className="text-xl font-bold text-orange-900 mb-2">Content Improver</h2>
        <p className="text-orange-700/80 text-sm">Elevate your existing drafts to professional standards.</p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <Label>Original Content</Label>
          <TextArea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste your draft here..." />
        </div>

        <div>
          <Label>Improvement Goal</Label>
          <div className="flex flex-wrap gap-2">
            {['Readability', 'SEO Optimization', 'Engagement', 'Persuasion', 'Conciseness'].map(g => (
              <button
                key={g}
                onClick={() => setGoal(g)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  goal === g 
                  ? "bg-indigo-100 text-indigo-700 border-indigo-200" 
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={handleImprove} loading={loading} disabled={!content}>
            <TrendingUp className="w-4 h-4 mr-2" />
            Improve Content
          </Button>
        </div>
      </Card>

      <ResultBox title="Polished Version" content={result} loading={loading} />
    </div>
  );
};

const AiProofreader = () => {
  const [content, setContent] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleProofread = async () => {
    if (!content) return;
    setLoading(true);
    try {
      const prompt = `Text to Proofread: ${content}`;
      const systemInstruction = `You are a strict and meticulous Proofreader using American English.
      1. Correct all spelling, grammar, punctuation, and syntax errors.
      2. Fix awkward phrasing.
      3. Output the corrected text first.
      4. Below the corrected text, provide a bulleted list of the key changes made (e.g., "Fixed comma splice in paragraph 2", "Corrected spelling of 'recieve'").
      5. Use Markdown. Separator between text and notes should be a horizontal rule (---).`;
      
      const proofed = await generateContent(prompt, systemInstruction);
      setResult(proofed);
    } catch (error) {
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-100">
        <h2 className="text-xl font-bold text-blue-900 mb-2">Smart Proofreader</h2>
        <p className="text-blue-700/80 text-sm">Grammar check, spell check, and syntax correction with detailed change logs.</p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <Label>Text to Proofread</Label>
          <TextArea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Paste text to check..." />
        </div>

        <Button onClick={handleProofread} loading={loading} disabled={!content}>
          <CheckCircle className="w-4 h-4 mr-2" />
          Proofread Now
        </Button>
      </Card>

      <ResultBox title="Corrected Text & Notes" content={result} loading={loading} />
    </div>
  );
};

const StrategyMaker = () => {
  const [bizType, setBizType] = useState('');
  const [audience, setAudience] = useState('');
  const [goals, setGoals] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStrategize = async () => {
    if (!bizType) return;
    setLoading(true);
    try {
      const prompt = `Business: ${bizType}\nAudience: ${audience}\nGoals: ${goals}`;
      const systemInstruction = `You are a Chief Marketing Officer (CMO). Create a detailed Content Marketing Strategy.
      Include the following sections using Markdown:
      1. **Executive Summary**: Brief overview of the strategy.
      2. **Audience Persona**: Deep dive into pain points and needs based on the input.
      3. **Content Pillars**: 3-5 core topics to focus on.
      4. **Channel Strategy**: Where to post (Blog, LinkedIn, Instagram, etc.) and why.
      5. **Content Calendar Idea**: A sample 1-week plan.
      6. **KPIs**: Metrics to track success.`;
      
      const strategy = await generateContent(prompt, systemInstruction);
      setResult(strategy);
    } catch (error) {
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-6 rounded-xl border border-pink-100">
        <h2 className="text-xl font-bold text-pink-900 mb-2">Content Strategy AI</h2>
        <p className="text-pink-700/80 text-sm">Generate a comprehensive marketing roadmap tailored to your business.</p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <Label>Business Type / Niche</Label>
          <Input value={bizType} onChange={(e) => setBizType(e.target.value)} placeholder="e.g., SaaS for Dentists, Vegan Bakery, Personal Finance Blog" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Target Audience</Label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g., Small business owners, Gen Z students" />
          </div>
          <div>
            <Label>Primary Goals</Label>
            <Input value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="e.g., Brand awareness, Lead generation" />
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={handleStrategize} loading={loading} disabled={!bizType} className="w-full md:w-auto">
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Generate Strategy
          </Button>
        </div>
      </Card>

      <ResultBox title="Your Custom Strategy" content={result} loading={loading} />
    </div>
  );
};

// --- Main App Component ---

const App = () => {
  const [activeTab, setActiveTab] = useState('writer');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const tools = [
    { id: 'writer', label: 'Article Writer', icon: Type, component: AiWriter },
    { id: 'improver', label: 'Article Improver', icon: TrendingUp, component: AiImprover },
    { id: 'proofreader', label: 'Proofreader', icon: CheckCircle, component: AiProofreader },
    { id: 'strategy', label: 'Strategy Maker', icon: LayoutDashboard, component: StrategyMaker },
    { id: 'counter', label: 'Word Counter', icon: Hash, component: WordCounter },
    { id: 'trimmer', label: 'URL Cleaner', icon: Scissors, component: UrlTrimmer },
  ];

  const ActiveComponent = tools.find(t => t.id === activeTab)?.component || AiWriter;

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-600">
              <Sparkles className="w-6 h-6 fill-current" />
              <span className="text-xl font-bold tracking-tight text-slate-900">SEO<span className="text-indigo-600">Pro</span></span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">AI Tools</div>
            {tools.slice(0, 4).map((tool) => (
              <button
                key={tool.id}
                onClick={() => { setActiveTab(tool.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tool.id 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <tool.icon className={`w-4 h-4 ${activeTab === tool.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                {tool.label}
              </button>
            ))}

            <div className="px-3 mt-6 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Utilities</div>
            {tools.slice(4).map((tool) => (
              <button
                key={tool.id}
                onClick={() => { setActiveTab(tool.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tool.id 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <tool.icon className={`w-4 h-4 ${activeTab === tool.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                {tool.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100">
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 text-center">
              <p>Powered by Gemini 2.5 Flash</p>
              <p className="mt-1">v1.0.0 Enterprise</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 md:px-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden text-slate-500 hover:text-slate-700"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-slate-800">
              {tools.find(t => t.id === activeTab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden md:flex items-center gap-2 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                System Operational
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            <ActiveComponent />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
