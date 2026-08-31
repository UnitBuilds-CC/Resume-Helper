import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import type { TemplateCV, Education, Employment } from '../../shared/types';

export default function TemplateCVPage() {
  const [cv, setCv] = useState<TemplateCV | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', location: '', linkedin: '', website: '', summary: '', professional_title: '' });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  async function load() {
    const res = await api('/api/template-cv');
    const data = await res.json();
    setCv(data);
    setForm({ full_name: data.full_name ?? '', email: data.email ?? '', phone: data.phone ?? '', location: data.location ?? '', linkedin: data.linkedin ?? '', website: data.website ?? '', summary: data.summary ?? '', professional_title: data.professional_title ?? '' });
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function savePersonal() {
    await api('/api/template-cv', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  }

  async function addEducation() {
    await api('/api/template-cv/education', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: (cv?.education.length ?? 0) }) });
    load();
  }

  async function updateEducation(edu: Education, field: string, value: string) {
    await api(`/api/template-cv/education/${edu.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) });
    load();
  }

  async function removeEducation(id: number) {
    await api(`/api/template-cv/education/${id}`, { method: 'DELETE' });
    load();
  }

  async function addEmployment() {
    await api('/api/template-cv/employment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sort_order: (cv?.employment.length ?? 0) }) });
    load();
  }

  async function updateEmployment(emp: Employment, field: string, value: string) {
    await api(`/api/template-cv/employment/${emp.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) });
    load();
  }

  async function removeEmployment(id: number) {
    await api(`/api/template-cv/employment/${id}`, { method: 'DELETE' });
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="page-title">Template CV</h2>
        <p className="text-sapphire-400 text-sm mt-1">The skeleton. Education and employment — the bare bones every compiled CV starts with.</p>
      </div>

      <section className="card p-5 mb-6">
        <h3 className="section-title mb-4">Personal Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <input placeholder="Full name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="input w-full" />
          <input placeholder="Professional title" value={form.professional_title} onChange={e => setForm({ ...form, professional_title: e.target.value })} className="input w-full" />
          <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input w-full" />
          <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input w-full" />
          <input placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="input w-full" />
          <input placeholder="LinkedIn" value={form.linkedin} onChange={e => setForm({ ...form, linkedin: e.target.value })} className="input w-full" />
          <input placeholder="Website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="input w-full" />
        </div>
        <textarea placeholder="Professional summary" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} rows={3} className="input w-full mb-4 resize-none" />
        <button onClick={savePersonal} className="btn-primary">{saved ? '✓ Saved' : 'Save Personal Info'}</button>
      </section>

      <section className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Education</h3>
          <button onClick={addEducation} className="btn-secondary text-xs">+ Add</button>
        </div>
        <div className="space-y-3">
          {cv?.education.map(edu => (
            <div key={edu.id} className="p-4 bg-cream-50/40 rounded-lg border border-cream-300/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
                <input placeholder="Institution" defaultValue={edu.institution ?? ''} onBlur={e => updateEducation(edu, 'institution', e.target.value)} className="input w-full" />
                <input placeholder="Degree" defaultValue={edu.degree ?? ''} onBlur={e => updateEducation(edu, 'degree', e.target.value)} className="input w-full" />
                <input placeholder="Field" defaultValue={edu.field ?? ''} onBlur={e => updateEducation(edu, 'field', e.target.value)} className="input w-full" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <input placeholder="Start date" defaultValue={edu.start_date ?? ''} onBlur={e => updateEducation(edu, 'start_date', e.target.value)} className="input w-full" />
                <input placeholder="End date" defaultValue={edu.end_date ?? ''} onBlur={e => updateEducation(edu, 'end_date', e.target.value)} className="input w-full" />
                <div className="flex items-center"><button onClick={() => removeEducation(edu.id)} className="text-xs text-sapphire-400 hover:text-teal-600">Remove</button></div>
              </div>
            </div>
          ))}
          {(!cv?.education || cv.education.length === 0) && <p className="text-sapphire-400 text-sm">No education entries yet.</p>}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Employment</h3>
          <button onClick={addEmployment} className="btn-secondary text-xs">+ Add</button>
        </div>
        <div className="space-y-3">
          {cv?.employment.map(emp => (
            <div key={emp.id} className="p-4 bg-cream-50/40 rounded-lg border border-cream-300/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
                <input placeholder="Company" defaultValue={emp.company ?? ''} onBlur={e => updateEmployment(emp, 'company', e.target.value)} className="input w-full" />
                <input placeholder="Title" defaultValue={emp.title ?? ''} onBlur={e => updateEmployment(emp, 'title', e.target.value)} className="input w-full" />
                <input placeholder="Location" defaultValue={emp.location ?? ''} onBlur={e => updateEmployment(emp, 'location', e.target.value)} className="input w-full" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-2">
                <input placeholder="Start date" defaultValue={emp.start_date ?? ''} onBlur={e => updateEmployment(emp, 'start_date', e.target.value)} className="input w-full" />
                <input placeholder="End date" defaultValue={emp.end_date ?? ''} onBlur={e => updateEmployment(emp, 'end_date', e.target.value)} className="input w-full" />
                <div className="flex items-center"><button onClick={() => removeEmployment(emp.id)} className="text-xs text-sapphire-400 hover:text-teal-600">Remove</button></div>
              </div>
              <textarea placeholder="Description" defaultValue={emp.description ?? ''} onBlur={e => updateEmployment(emp, 'description', e.target.value)} rows={2} className="input w-full resize-none" />
            </div>
          ))}
          {(!cv?.employment || cv.employment.length === 0) && <p className="text-sapphire-400 text-sm">No employment entries yet.</p>}
        </div>
      </section>
    </div>
  );
}
