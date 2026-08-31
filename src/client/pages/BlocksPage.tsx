import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import TagInput from '../components/TagInput';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Block, Skill, Employment, System, Project } from '../../shared/types';

export default function BlocksPage() {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [employment, setEmployment] = useState<Employment[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Block | null>(null);
  const [form, setForm] = useState({ 
    title: '', 
    content: '', 
    skills: [] as string[], 
    is_generic: true, 
    target_companies: '',
    employment_ids: [] as number[],
    system_ids: [] as number[],
    project_ids: [] as number[]
  });
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (filter) params.set('skill', filter);
    if (search) params.set('search', search);
    const [blocksRes, empRes, sysRes, projRes] = await Promise.all([
      api(`/api/blocks?${params}`),
      api('/api/template-cv/employment'),
      api('/api/systems'),
      api('/api/projects')
    ]);
    setBlocks(await blocksRes.json());
    setEmployment(await empRes.json());
    setSystems(await sysRes.json());
    setProjects(await projRes.json());
    setLoading(false);
  }

  async function loadSkills() {
    const res = await api('/api/skills');
    const data: Skill[] = await res.json();
    setSkills(data.map(s => s.name));
  }

  useEffect(() => { load(); loadSkills(); }, [filter, search]);

  function startCreate() {
    setEditing({ id: 0, title: '', content: '', skills: [], is_generic: true, target_companies: '', employment_ids: [], system_ids: [], project_ids: [], created_at: '', updated_at: '' } as Block);
    setForm({ title: '', content: '', skills: [], is_generic: true, target_companies: '', employment_ids: [], system_ids: [], project_ids: [] });
  }

  function startEdit(block: Block) {
    setEditing(block);
    setForm({ 
      title: block.title, 
      content: block.content, 
      skills: [...block.skills], 
      is_generic: block.is_generic !== false, 
      target_companies: block.target_companies || '',
      employment_ids: block.employment_ids || [],
      system_ids: block.system_ids || [],
      project_ids: block.project_ids || []
    });
  }

  async function save() {
    const method = editing && editing.id ? 'PUT' : 'POST';
    const url = editing?.id ? `/api/blocks/${editing.id}` : '/api/blocks';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setEditing(null);
    toast(editing?.id ? 'Block updated' : 'Block added');
    load();
    loadSkills();
  }

  async function confirmDelete() {
    if (deleting === null) return;
    await api(`/api/blocks/${deleting}`, { method: 'DELETE' });
    toast('Block deleted', 'info');
    setDeleting(null);
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete block?"
        message="This can't be undone. The block and its skill tags will be removed."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="page-title">Blocks</h2>
          <p className="text-sapphire-400 text-sm mt-1">What you did, why, and how. Tag with skills so AI can cherry-pick the right ones.</p>
        </div>
        <button onClick={startCreate} className="btn-primary">+ Add Block</button>
      </div>

      <div className="flex gap-3 mb-6">
        <input placeholder="Search blocks..." value={search} onChange={e => setSearch(e.target.value)} className="input flex-1" />
        <input placeholder="Filter by skill..." value={filter} onChange={e => setFilter(e.target.value)} className="input w-52" />
      </div>

      {editing && (
        <div className="card p-5 mb-6">
          <input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="input w-full mb-4" />
          <textarea
            placeholder="What you did, why you did it, and how... (Markdown supported)"
            value={form.content}
            onChange={e => setForm({ ...form, content: e.target.value })}
            rows={6}
            className="input w-full mb-4 resize-none font-mono text-sm"
          />
          <div className="mb-4">
            <label className="text-xs text-sapphire-400 mb-2 block">Skills</label>
            <TagInput tags={form.skills} onChange={tags => setForm({ ...form, skills: tags })} suggestions={skills} />
          </div>
          <div className="mb-4 p-4 bg-cream-50/40 rounded-lg border border-cream-300/30">
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={form.is_generic} 
                onChange={e => setForm({ ...form, is_generic: e.target.checked, target_companies: e.target.checked ? '' : form.target_companies })} 
                className="rounded border-cream-300 text-teal-500 focus:ring-teal-500" 
              />
              <span className="text-sm text-sapphire-700">Generic (use for any company)</span>
            </label>
            {!form.is_generic && (
              <div>
                <label className="text-xs text-sapphire-400 mb-2 block">Target Companies (comma-separated)</label>
                <input 
                  placeholder="e.g. Twin, Canonical, Google" 
                  value={form.target_companies} 
                  onChange={e => setForm({ ...form, target_companies: e.target.value })} 
                  className="input w-full" 
                />
                <p className="text-xs text-sapphire-400 mt-1">This block will only be used for CVs targeting these specific companies</p>
              </div>
            )}
          </div>
          
          <div className="mb-4">
            <label className="text-xs text-sapphire-400 mb-2 block">Related Employment</label>
            <select
              multiple
              value={form.employment_ids.map(String)}
              onChange={e => setForm({ ...form, employment_ids: Array.from(e.target.selectedOptions, o => Number(o.value)) })}
              className="input w-full h-24"
            >
              {employment.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.company} - {emp.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-sapphire-400 mt-1">Select employment entries this block relates to (hold Ctrl/Cmd to select multiple)</p>
          </div>

          <div className="mb-4">
            <label className="text-xs text-sapphire-400 mb-2 block">Related Systems</label>
            <select
              multiple
              value={form.system_ids.map(String)}
              onChange={e => setForm({ ...form, system_ids: Array.from(e.target.selectedOptions, o => Number(o.value)) })}
              className="input w-full h-24"
            >
              {systems.map(sys => (
                <option key={sys.id} value={sys.id}>
                  {sys.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-sapphire-400 mt-1">Select systems this block relates to (hold Ctrl/Cmd to select multiple)</p>
          </div>

          <div className="mb-4">
            <label className="text-xs text-sapphire-400 mb-2 block">Related Projects</label>
            <select
              multiple
              value={form.project_ids.map(String)}
              onChange={e => setForm({ ...form, project_ids: Array.from(e.target.selectedOptions, o => Number(o.value)) })}
              className="input w-full h-24"
            >
              {projects.map(proj => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-sapphire-400 mt-1">Select projects this block relates to (hold Ctrl/Cmd to select multiple)</p>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">Save</button>
            <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {blocks.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sapphire-400">No blocks yet. Start writing about what you've done — this is where your story lives.</p>
          </div>
        )}
        {blocks.map(block => (
          <div key={block.id} className="card p-5 group">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-sapphire-800">{block.title}</h3>
                  {block.is_generic === false && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-lavender-100 text-lavender-700 border border-lavender-300/30" title={`Only for: ${block.target_companies}`}>
                      Company-specific
                    </span>
                  )}
                </div>
                <p className="text-sm text-sapphire-600 mt-2 whitespace-pre-wrap line-clamp-3">{block.content}</p>
                {block.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {block.skills.map(s => (
                      <span key={s} className="tag">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 shrink-0 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(block)} className="text-xs text-sapphire-400 hover:text-mint-600">Edit</button>
                <button onClick={() => setDeleting(block.id)} className="text-xs text-sapphire-400 hover:text-teal-600">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
