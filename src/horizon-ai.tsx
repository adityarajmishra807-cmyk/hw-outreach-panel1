import React from 'react';
import { BrainCircuit, Check, Clock3, Database, Loader2, Sparkles, ArrowUpRight } from 'lucide-react';

type Prospect = {
  id: string;
  name: string;
  handle: string;
  niche: string;
  score: number | null;
  status: string;
  reply: string;
  time: string;
};

type HorizonResponse = {
  ok: boolean;
  text?: string;
  error?: string;
};

const EXAMPLES = [
  'I spoke to Rahul today. He wants a restaurant website for around 60k and wants it before October 15. I need to send the proposal tomorrow.',
  'Organize this: our strongest outreach opportunity today is a luxury travel business that replied and asked to see the demo.',
  'What should I focus on today based on the outreach pipeline?',
];

export function HorizonAI({ prospects }: { prospects: Prospect[] }) {
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [loading, setLoading] = React.useState(false);
  const [notice, setNotice] = React.useState('');

  async function sendMessage(message = input) {
    const text = message.trim();
    if (!text || loading) return;
    setInput('');
    setNotice('');
    setMessages((current) => [...current, { role: 'user', text }]);
    setLoading(true);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: {
            workspace: 'Horizon Works Outreach',
            prospects: prospects.map(({ id, ...p }) => p),
            counts: {
              prospects: prospects.length,
              sent: prospects.filter((p) => ['Sent', 'Replied', 'Interested', 'Not interested'].includes(p.status)).length,
              replies: prospects.filter((p) => ['Replied', 'Interested', 'Not interested'].includes(p.status)).length,
              interested: prospects.filter((p) => p.status === 'Interested').length,
            },
          },
        }),
      });
      const data = (await response.json()) as HorizonResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || 'Horizon could not process that request.');
      setMessages((current) => [...current, { role: 'assistant', text: data.text || 'Done.' }]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Horizon AI is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="horizon-ai-page">
      <div className="horizon-ai-intro">
        <div>
          <p className="eyebrow">HORIZON WORKS / AI OPERATING LAYER</p>
          <div className="horizon-title-row">
            <div className="horizon-logo"><BrainCircuit size={22} /></div>
            <div>
              <h2>Horizon AI</h2>
              <p>Tell Horizon anything. It interprets the information, uses workspace context, and becomes the organizing layer for everything you do.</p>
            </div>
          </div>
        </div>
        <div className="horizon-status"><span /> Gemini backbone</div>
      </div>

      <div className="horizon-grid">
        <div className="panel horizon-chat-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Command center</p>
              <h3>Talk naturally</h3>
            </div>
            <span className="horizon-live"><span /> Ready</span>
          </div>

          <div className="horizon-examples">
            {EXAMPLES.map((example) => (
              <button key={example} onClick={() => sendMessage(example)}>{example}</button>
            ))}
          </div>

          <div className="horizon-messages" aria-live="polite">
            {messages.length === 0 ? (
              <div className="horizon-empty-chat">
                <Sparkles size={20} />
                <strong>Start with a thought, update, plan, or question.</strong>
                <span>Horizon is designed to turn unstructured conversation into organized workspace context.</span>
              </div>
            ) : messages.map((message, index) => (
              <div className={`horizon-message ${message.role}`} key={`${message.role}-${index}`}>
                <div className="horizon-message-label">{message.role === 'user' ? 'YOU' : 'HORIZON'}</div>
                <div className="horizon-message-text">{message.text}</div>
              </div>
            ))}
            {loading && <div className="horizon-message assistant"><div className="horizon-message-label">HORIZON</div><div className="horizon-loading"><Loader2 size={15} className="spin" /> Thinking with workspace context…</div></div>}
          </div>

          {notice && <div className="horizon-notice"><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}

          <form className="horizon-composer" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={5} placeholder="Tell Horizon anything… e.g. a client update, an idea, a deadline, a task, or a question." />
            <div className="horizon-composer-foot">
              <span>Private server-side Gemini request</span>
              <button className="primary-btn" type="submit" disabled={loading || !input.trim()}>{loading ? 'Working…' : 'Send to Horizon'} <ArrowUpRight size={14} /></button>
            </div>
          </form>
        </div>

        <div className="horizon-side-stack">
          <div className="panel">
            <div className="panel-head"><div><p className="section-kicker">Workspace context</p><h3>What Horizon can see</h3></div></div>
            <div className="horizon-context-row"><Database size={15} /><div><strong>{prospects.length}</strong><span>prospects in outreach</span></div><Check size={14} /></div>
            <div className="horizon-context-row"><Clock3 size={15} /><div><strong>Live</strong><span>current session context</span></div><Check size={14} /></div>
            <div className="horizon-context-row"><BrainCircuit size={15} /><div><strong>Gemini</strong><span>reasoning backbone</span></div><Check size={14} /></div>
          </div>

          <div className="panel horizon-memory-card">
            <p className="section-kicker">Coming next</p>
            <h3>Memory becomes the backbone</h3>
            <p>Future iterations will persist decisions, client facts, project context, preferences, and important conversations so Horizon gets smarter over time.</p>
            <div className="memory-line"><span>Conversation</span><i /></div>
            <div className="memory-line"><span>Structured workspace</span><i /></div>
            <div className="memory-line"><span>Long-term memory</span><i /></div>
          </div>
        </div>
      </div>
    </section>
  );
}
