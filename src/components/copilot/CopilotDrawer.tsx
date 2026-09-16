import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, X, Globe, Database, Sparkles } from 'lucide-react';
import { DerivedMineMetrics, DatasetBundle } from '../../types/minegov';
import { queryMineGovCopilot, SupportedLanguage, CopilotResponse } from '../../services/copilotEngine';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: DerivedMineMetrics[];
  data: DatasetBundle;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
  metrics,
  data
}) => {
  const [query, setQuery] = useState('');
  const [lang, setLang] = useState<SupportedLanguage>('EN');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; response: CopilotResponse | string }>>([
    {
      role: 'assistant',
      response: {
        answer: 'Welcome to MineGov Copilot AI. I am your statutory coal governance assistant. Ask me questions about mine risk ranking, overdue compliance, CAPA aging, abnormal sensor telemetry, contractor scores, or document OCR queues.',
        sources: [],
        confidence: 1.0
      }
    }
  ]);

  const handleSend = (textToSend?: string) => {
    const q = textToSend || query;
    if (!q.trim()) return;

    setChatHistory(prev => [...prev, { role: 'user', response: q }]);
    const res = queryMineGovCopilot(q, metrics, data, lang);
    setChatHistory(prev => [...prev, { role: 'assistant', response: res }]);
    setQuery('');
  };

  const presetQuestions = [
    'Which mine has the highest risk and why?',
    'Show overdue compliance items & CAPA status',
    'List abnormal telemetry sensor readings',
    'Which contractors require governance attention?',
    'Show document OCR verification queue'
  ];
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-carbon-900 border-l border-copper/40 shadow-2xl z-50 flex flex-col font-sans"
          >
            {/* Header */}
            <div className="p-4 border-b border-carbon-700/60 bg-carbon-850 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-copper flex items-center justify-center text-white shadow-copper-glow">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-warm-pale flex items-center gap-2">
                    MineGov Copilot
                    <span className="px-1.5 py-0.5 text-[9px] font-mono bg-copper/20 text-copper-light rounded">FACTUAL AI</span>
                  </h3>
                  <p className="text-[11px] text-warm-slate">Queries structured 13 CSV dataset facts</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Language Switcher */}
                <div className="flex items-center gap-1 bg-carbon-800 px-2 py-1 rounded border border-carbon-700 text-xs">
                  <Globe className="w-3 h-3 text-copper-light" />
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value as SupportedLanguage)}
                    className="bg-transparent text-warm-sand outline-none text-[11px] font-mono"
                  >
                    <option value="EN">English</option>
                    <option value="HI">Hindi (हिंदी)</option>
                    <option value="BN">Bengali (বাংলা)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Presets */}
            <div className="px-3 py-2 bg-carbon-850/60 border-b border-carbon-700/40 flex flex-wrap gap-1.5">
              {presetQuestions.map((pq, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(pq)}
                  className="px-2 py-1 rounded-md bg-carbon-800 hover:bg-carbon-750 border border-carbon-700/60 text-[11px] text-warm-sand flex items-center gap-1 transition-colors text-left"
                >
                  <Sparkles className="w-3 h-3 text-copper-light shrink-0" />
                  <span className="truncate max-w-[200px]">{pq}</span>
                </button>
              ))}
            </div>

            {/* Chat Feed */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {chatHistory.map((item, index) => (
                <div
                  key={index}
                  className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl p-3 text-xs leading-relaxed ${
                      item.role === 'user'
                        ? 'bg-copper text-white rounded-br-none'
                        : 'bg-carbon-800 border border-carbon-700 text-gray-200 rounded-bl-none shadow-panel'
                    }`}
                  >
                    {typeof item.response === 'string' ? (
                      <p>{item.response}</p>
                    ) : (
                      <div className="space-y-2">
                        <div className="whitespace-pre-line font-sans">{item.response.answer}</div>

                        {item.response.sources.length > 0 && (
                          <div className="pt-2 border-t border-carbon-700/60 mt-2 space-y-1">
                            <span className="text-[10px] font-mono font-semibold text-warm-slate flex items-center gap-1">
                              <Database className="w-3 h-3 text-copper-light" />
                              VERIFIED SOURCE EVIDENCE:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {item.response.sources.map((s, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="px-1.5 py-0.5 rounded bg-carbon-900 border border-carbon-700 text-[10px] font-mono text-copper-light"
                                >
                                  {s.table} #{s.recordId}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-3 border-t border-carbon-700 bg-carbon-850 flex items-center gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask MineGov Copilot about mines, risk, compliance..."
                className="flex-1 bg-carbon-800 border border-carbon-700 text-xs text-white rounded-lg px-3 py-2 focus:border-copper outline-none"
              />
              <button
                onClick={() => handleSend()}
                className="p-2 rounded-lg bg-copper hover:bg-copper-dark text-white transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};


