import React from 'react';
import { Archive, BookOpen, FileText, Plus, Search, X } from 'lucide-react';
import { addKnowledge, archiveKnowledge, getKnowledge, searchKnowledge, subscribeToKnowledgeChanges, type KnowledgeChunk, type KnowledgeDocument } from './horizon-knowledge';
import './horizon-knowledge.css';

export function HorizonKnowledgePanel({ onClose }: { onClose: () => void }) {
  const [docs, setDocs] = React.useState<KnowledgeDocument[]>(() => getKnowledge());
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<KnowledgeDocument | null>(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [form, setForm] = React.useState({ title: '', source: '', tags: '', content: '' });

  React.useEffect(() => subscribeToKnowledgeChanges(() => setDocs(getKnowledge())), []);

  const results = query.trim() ? searchKnowledge(query, 12) : [];

  function save() {
    if (!form.title.trim() || !form.content.trim()) return;
    addKnowledge({ title: form.title, source: form.source, content: form.content, tags: form.tags.split(',') });
    setForm({ title: '', source: '', tags: '', content: '' });
    setShowAdd(false);
  }

  return <div className="hk-backdrop" onClick={onClose}>
    <section className="hk-panel" onClick={(event) => event.stopPropagation()}>
      <header className="hk-header">
        <div className="hk-brand"><div className="hk-mark"><BookOpen size={15} /></div><div><p>HORIZON KNOWLEDGE</p><h2>Knowledge Brain</h2><span>Company information that Horizon can retrieve during AI requests.</span></div></div>
        <button className="hk-close" onClick={onClose}><X size={17} /></button>
      </header>

      <div className="hk-toolbar">
        <div className="hk-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your knowledge..." /></div>
        <button className="hk-add" onClick={() => setShowAdd(true)}><Plus size={14} /> Add knowledge</button>
      </div>

      {showAdd && <div className="hk-add-form">
        <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Title — e.g. Prachar architecture" />
        <input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="Source — optional" />
        <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Tags — comma separated" />
        <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} rows={7} placeholder="Paste the information Horizon should know..." />
        <div className="hk-form-actions"><button className="hk-secondary" onClick={() => setShowAdd(false)}>Cancel</button><button className="hk-add" onClick={save}>Index knowledge</button></div>
      </div>}

      <div className="hk-content">
        {query.trim() ? <div className="hk-results"><div className="hk-section-label">RELEVANT KNOWLEDGE · {results.length}</div>{results.length === 0 ? <div className="hk-empty"><Search size={22} /><strong>No matching knowledge</strong><span>Try a project name, client, feature, process, or keyword.</span></div> : results.map((result) => <KnowledgeResult key={result.chunkId} result={result} onOpen={() => setSelected(docs.find((doc) => doc.id === result.id) || null)} />)}</div> : <div className="hk-list"><div className="hk-section-label">INDEXED KNOWLEDGE · {docs.length}</div>{docs.length === 0 ? <div className="hk-empty"><FileText size={22} /><strong>Your knowledge brain is empty</strong><span>Paste company knowledge, proposals, research, project notes, or documentation here. Horizon will index it into searchable chunks.</span><button className="hk-add" onClick={() => setShowAdd(true)}><Plus size={14} /> Add first knowledge</button></div> : docs.map((doc) => <article className="hk-doc" key={doc.id} onClick={() => setSelected(doc)}><div className="hk-doc-icon"><FileText size={16} /></div><div className="hk-doc-main"><strong>{doc.title}</strong><span>{doc.source} · {doc.tags.length ? doc.tags.join(', ') : 'No tags'}</span><small>{doc.content.length.toLocaleString()} characters · updated {new Date(doc.updatedAt).toLocaleString()}</small></div><button className="hk-archive" onClick={(event) => { event.stopPropagation(); archiveKnowledge(doc.id); }} title="Archive"><Archive size={14} /></button></article>)}</div>}
      </div>

      {selected && <div className="hk-detail" onClick={() => setSelected(null)}><article className="hk-detail-card" onClick={(event) => event.stopPropagation()}><header><div><p>KNOWLEDGE RECORD</p><h3>{selected.title}</h3><span>{selected.source} · {selected.tags.join(', ') || 'No tags'}</span></div><button className="hk-close" onClick={() => setSelected(null)}><X size={16} /></button></header><div className="hk-detail-body"><pre>{selected.content}</pre></div></article></div>}
    </section>
  </div>;
}

function KnowledgeResult({ result, onOpen }: { result: KnowledgeChunk; onOpen: () => void }) {
  return <button className="hk-result" onClick={onOpen}><div className="hk-doc-icon"><BookOpen size={15} /></div><div><strong>{result.title}</strong><span>{result.source} · chunk {result.chunkIndex + 1}</span><p>{result.chunkText.slice(0, 280)}{result.chunkText.length > 280 ? '…' : ''}</p></div></button>;
}
