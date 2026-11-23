import React, { useEffect, useState } from 'react';
import { FileCode, Send } from 'lucide-react';
import { askProjectAssistant } from '../api/client.js';

export default function ChatPage({ projectId, initialMessages, onOpenCitation }) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMessages(initialMessages || []);
  }, [projectId, initialMessages]);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setQuestion('');
    setError('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setLoading(true);

    try {
      const assistantMessage = await askProjectAssistant(projectId, trimmed);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[680px] flex-col rounded-xl border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-white">Codebase Assistant</h2>
        <p className="text-xs text-slate-400">
          Answers are grounded in ChromaDB vector retrieval and Graphology dependency neighbors.
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-sm text-slate-400">
            Ask a question about this repository, such as &ldquo;Where are API routes defined?&rdquo; or &ldquo;How
            does module X connect to module Y?&rdquo;
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={msg._id || idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-3xl rounded-xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-teal-500 font-medium text-slate-950'
                  : 'border border-slate-800 bg-slate-950 text-slate-200'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

              {msg.role === 'assistant' && msg.sources?.length > 0 && (
                <div className="mt-3 border-t border-slate-800 pt-2.5">
                  <p className="mb-2 text-xs text-slate-400">
                    Sources · retrieval confidence: {msg.confidence || 'medium'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.map((src, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() =>
                          onOpenCitation(src.filePath, {
                            startLine: src.startLine,
                            endLine: src.endLine,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 font-mono text-xs text-teal-300 transition-colors hover:border-teal-500"
                      >
                        <FileCode size={12} />
                        <span className="tabular-nums">
                          {src.filePath}:{src.startLine}-{src.endLine}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <p className="text-xs text-teal-400">Searching ChromaDB chunks &amp; generating grounded answer...</p>
        )}
        {error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-slate-800 p-4">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about functions, entry points, data flow, or error handling..."
          className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-teal-400 disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          <Send size={15} />
          Ask
        </button>
      </form>
    </div>
  );
}
