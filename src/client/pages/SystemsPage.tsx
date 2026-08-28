import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import type { System } from '../../shared/types';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

export default function SystemsPage() {
  const { toast } = useToast();
  const [systems, setSystems] = useState<System[]>([]);
  const [editing, setEditing] = useState<System | null>(null);
  const [form, setForm] = useState({ name: '', description: '', industry: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function load() {
    const res = await api('/api/systems');
    setSystems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startEdit(sys: System) {
    setEditing(sys);
    setForm({ name: sys.name, description: sys.description ?? '', industry: sys.industry ?? '', notes: sys.notes ?? '' });
  }

  function startCreate() {
    setEditing({ id: 0, name: '', description: null, industry: null, notes: null, created_at: '', updated_at: '' } as System);
    setForm({ name: '', description: '', industry: '', notes: '' });
  }

  async function save() {
    const method = editing && editing.id ? 'PUT' : 'POST';
    const url = editing?.id ? `/api/systems/${editing.id}` : '/api/systems';
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setEditing(null);
    toast(editing?.id ? 'System updated' : 'System added');
    load();
  }

  async function confirmDelete() {
    if (deleting === null) return;
    await api(`/api/systems/${deleting}`, { method: 'DELETE' });
    toast('System deleted', 'info');
    setDeleting(null);
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete system?"
        message="This can't be undone. The system will be permanently removed."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="page-title">Systems</h2>
          <p className="text-sapphire-400 text-sm mt-1">Every system you've touched. Even the small ones might be your edge.</p>
        </div>
        <button onClick={startCreate} className="btn-primary">+ Add System</button>
      </div>

      {editing && (
        <div className="card p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <input placeholder="System name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input w-full" />
            <input placeholder="Industry" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} className="input w-full" />
          </div>
          <textarea placeholder="Description — what does this system do?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="input w-full mb-4 resize-none" />
          <textarea placeholder="Notes — any personal context or memories" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="input w-full mb-4 resize-none" />
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">Save</button>
            <button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {systems.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sapphire-400">No systems yet. Start adding the systems you've worked on — you never know which one will be your edge.</p>
          </div>
        )}
        {systems.map(sys => (
          <div key={sys.id} className="card p-5 group">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sapphire-800">{sys.name}</h3>
                  {sys.industry && <span className="tag">{sys.industry}</span>}
                </div>
                {sys.description && <p className="text-sm text-sapphire-600 mt-2">{sys.description}</p>}
                {sys.notes && <p className="text-xs text-sapphire-400 mt-2 italic">{sys.notes}</p>}
              </div>
              <div className="flex gap-3 shrink-0 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(sys)} className="text-xs text-sapphire-400 hover:text-mint-600">Edit</button>
                <button onClick={() => setDeleting(sys.id)} className="text-xs text-sapphire-400 hover:text-teal-600">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
