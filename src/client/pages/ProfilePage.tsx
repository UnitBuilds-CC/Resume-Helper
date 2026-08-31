import { api } from '../hooks/api';
import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import type { TemplateCV, Education, Employment, System, Block, Project } from '../../shared/types';

export default function ProfilePage() {
  const { toast } = useToast();
  const [templateCv, setTemplateCv] = useState<TemplateCV | null>(null);
  const [education, setEducation] = useState<Education[]>([]);
  const [employment, setEmployment] = useState<Employment[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('personal');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [cvRes, eduRes, empRes, sysRes, blocksRes, projRes] = await Promise.all([
        api('/api/template-cv'),
        api('/api/template-cv/education'),
        api('/api/template-cv/employment'),
        api('/api/systems'),
        api('/api/blocks'),
        api('/api/projects')
      ]);
      
      setTemplateCv(await cvRes.json());
      setEducation(await eduRes.json());
      setEmployment(await empRes.json());
      setSystems(await sysRes.json());
      setBlocks(await blocksRes.json());
      setProjects(await projRes.json());
    } catch (error) {
      toast('Failed to load profile data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function updateTemplateCv(field: string, value: any) {
    try {
      const res = await api('/api/template-cv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      setTemplateCv(await res.json());
      toast('Updated successfully');
    } catch (error) {
      toast('Failed to update', 'error');
    }
  }

  async function addEducation() {
    try {
      const res = await api('/api/template-cv/education', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: education.length })
      });
      await loadAll();
      toast('Education added');
    } catch (error) {
      toast('Failed to add education', 'error');
    }
  }

  async function updateEducation(id: number, field: string, value: any) {
    try {
      await api(`/api/template-cv/education/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      await loadAll();
      toast('Updated successfully');
    } catch (error) {
      toast('Failed to update', 'error');
    }
  }

  async function deleteEducation(id: number) {
    if (!confirm('Delete this education entry?')) return;
    try {
      await api(`/api/template-cv/education/${id}`, { method: 'DELETE' });
      await loadAll();
      toast('Deleted successfully');
    } catch (error) {
      toast('Failed to delete', 'error');
    }
  }

  async function addEmployment() {
    try {
      const res = await api('/api/template-cv/employment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: employment.length })
      });
      await loadAll();
      toast('Employment added');
    } catch (error) {
      toast('Failed to add employment', 'error');
    }
  }

  async function updateEmployment(id: number, field: string, value: any) {
    try {
      await api(`/api/template-cv/employment/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      await loadAll();
      toast('Updated successfully');
    } catch (error) {
      toast('Failed to update', 'error');
    }
  }

  async function deleteEmployment(id: number) {
    if (!confirm('Delete this employment entry?')) return;
    try {
      await api(`/api/template-cv/employment/${id}`, { method: 'DELETE' });
      await loadAll();
      toast('Deleted successfully');
    } catch (error) {
      toast('Failed to delete', 'error');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const sections = [
    { id: 'personal', label: 'Personal Info', icon: '👤' },
    { id: 'education', label: 'Education', icon: '🎓' },
    { id: 'employment', label: 'Employment', icon: '💼' },
    { id: 'systems', label: 'Systems', icon: '⚙️' },
    { id: 'blocks', label: 'Blocks', icon: '📦' },
    { id: 'projects', label: 'Projects', icon: '🚀' }
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-sapphire-800">My Profile</h1>
        <p className="text-sapphire-600 mt-2">Manage all your profile data in one place</p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm border border-cream-200 p-4 sticky top-4">
            <nav className="space-y-1">
              {sections.map(section => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
                    activeSection === section.id
                      ? 'bg-teal-50 text-teal-700 border border-teal-200'
                      : 'text-sapphire-600 hover:bg-cream-50'
                  }`}
                >
                  <span className="mr-2">{section.icon}</span>
                  {section.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {/* Personal Info Section */}
          {activeSection === 'personal' && templateCv && (
            <div className="bg-white rounded-lg shadow-sm border border-cream-200 p-6">
              <h2 className="text-2xl font-bold text-sapphire-800 mb-6">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-sapphire-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={templateCv.full_name || ''}
                    onChange={(e) => updateTemplateCv('full_name', e.target.value)}
                    className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sapphire-700 mb-2">Professional Title</label>
                  <input
                    type="text"
                    value={templateCv.professional_title || ''}
                    onChange={(e) => updateTemplateCv('professional_title', e.target.value)}
                    className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sapphire-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={templateCv.email || ''}
                    onChange={(e) => updateTemplateCv('email', e.target.value)}
                    className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sapphire-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={templateCv.phone || ''}
                    onChange={(e) => updateTemplateCv('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sapphire-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={templateCv.location || ''}
                    onChange={(e) => updateTemplateCv('location', e.target.value)}
                    className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sapphire-700 mb-2">LinkedIn</label>
                  <input
                    type="url"
                    value={templateCv.linkedin || ''}
                    onChange={(e) => updateTemplateCv('linkedin', e.target.value)}
                    className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sapphire-700 mb-2">Website</label>
                  <input
                    type="url"
                    value={templateCv.website || ''}
                    onChange={(e) => updateTemplateCv('website', e.target.value)}
                    className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-sapphire-700 mb-2">Professional Summary</label>
                <textarea
                  value={templateCv.summary || ''}
                  onChange={(e) => updateTemplateCv('summary', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          )}

          {/* Education Section */}
          {activeSection === 'education' && (
            <div className="bg-white rounded-lg shadow-sm border border-cream-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-sapphire-800">Education</h2>
                <button
                  onClick={addEducation}
                  className="px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 transition-colors"
                >
                  + Add Education
                </button>
              </div>
              <div className="space-y-4">
                {education.map(edu => (
                  <div key={edu.id} className="border border-cream-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-sapphire-700 mb-2">Institution</label>
                        <input
                          type="text"
                          value={edu.institution || ''}
                          onChange={(e) => updateEducation(edu.id, 'institution', e.target.value)}
                          className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-sapphire-700 mb-2">Degree</label>
                        <input
                          type="text"
                          value={edu.degree || ''}
                          onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                          className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-sapphire-700 mb-2">Field</label>
                        <input
                          type="text"
                          value={edu.field || ''}
                          onChange={(e) => updateEducation(edu.id, 'field', e.target.value)}
                          className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-sapphire-700 mb-2">Start Date</label>
                          <input
                            type="text"
                            value={edu.start_date || ''}
                            onChange={(e) => updateEducation(edu.id, 'start_date', e.target.value)}
                            className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="e.g., 2020"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-sapphire-700 mb-2">End Date</label>
                          <input
                            type="text"
                            value={edu.end_date || ''}
                            onChange={(e) => updateEducation(edu.id, 'end_date', e.target.value)}
                            className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="e.g., 2024"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-sapphire-700 mb-2">Details</label>
                      <textarea
                        value={edu.details || ''}
                        onChange={(e) => updateEducation(edu.id, 'details', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <button
                      onClick={() => deleteEducation(edu.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Employment Section */}
          {activeSection === 'employment' && (
            <div className="bg-white rounded-lg shadow-sm border border-cream-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-sapphire-800">Employment</h2>
                <button
                  onClick={addEmployment}
                  className="px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 transition-colors"
                >
                  + Add Employment
                </button>
              </div>
              <div className="space-y-4">
                {employment.map(emp => (
                  <div key={emp.id} className="border border-cream-200 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-sapphire-700 mb-2">Company</label>
                        <input
                          type="text"
                          value={emp.company || ''}
                          onChange={(e) => updateEmployment(emp.id, 'company', e.target.value)}
                          className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-sapphire-700 mb-2">Title</label>
                        <input
                          type="text"
                          value={emp.title || ''}
                          onChange={(e) => updateEmployment(emp.id, 'title', e.target.value)}
                          className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-sapphire-700 mb-2">Location</label>
                        <input
                          type="text"
                          value={emp.location || ''}
                          onChange={(e) => updateEmployment(emp.id, 'location', e.target.value)}
                          className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-sapphire-700 mb-2">Start Date</label>
                          <input
                            type="text"
                            value={emp.start_date || ''}
                            onChange={(e) => updateEmployment(emp.id, 'start_date', e.target.value)}
                            className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="e.g., 2020"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-sapphire-700 mb-2">End Date</label>
                          <input
                            type="text"
                            value={emp.end_date || ''}
                            onChange={(e) => updateEmployment(emp.id, 'end_date', e.target.value)}
                            className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder="e.g., Present"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-sapphire-700 mb-2">Description</label>
                      <textarea
                        value={emp.description || ''}
                        onChange={(e) => updateEmployment(emp.id, 'description', e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-cream-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <button
                      onClick={() => deleteEmployment(emp.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Systems Section */}
          {activeSection === 'systems' && (
            <div className="bg-white rounded-lg shadow-sm border border-cream-200 p-6">
              <h2 className="text-2xl font-bold text-sapphire-800 mb-6">Systems</h2>
              <p className="text-sapphire-600 mb-4">Manage your technical systems and tools. Use the Systems page for full CRUD operations.</p>
              <div className="space-y-2">
                {systems.map(sys => (
                  <div key={sys.id} className="border border-cream-200 rounded-lg p-3">
                    <div className="font-medium text-sapphire-800">{sys.name}</div>
                    {sys.industry && <div className="text-sm text-sapphire-600">{sys.industry}</div>}
                    {sys.description && <div className="text-sm text-sapphire-500 mt-1">{sys.description}</div>}
                  </div>
                ))}
              </div>
              <a href="/systems" className="inline-block mt-4 px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 transition-colors">
                Manage Systems →
              </a>
            </div>
          )}

          {/* Blocks Section */}
          {activeSection === 'blocks' && (
            <div className="bg-white rounded-lg shadow-sm border border-cream-200 p-6">
              <h2 className="text-2xl font-bold text-sapphire-800 mb-6">Blocks</h2>
              <p className="text-sapphire-600 mb-4">Manage your achievement blocks. Use the Blocks page for full CRUD operations.</p>
              <div className="space-y-2">
                {blocks.map(block => (
                  <div key={block.id} className="border border-cream-200 rounded-lg p-3">
                    <div className="font-medium text-sapphire-800">{block.title}</div>
                    <div className="text-sm text-sapphire-500 mt-1 line-clamp-2">{block.content}</div>
                    {block.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {block.skills.map(skill => (
                          <span key={skill} className="text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <a href="/blocks" className="inline-block mt-4 px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 transition-colors">
                Manage Blocks →
              </a>
            </div>
          )}

          {/* Projects Section */}
          {activeSection === 'projects' && (
            <div className="bg-white rounded-lg shadow-sm border border-cream-200 p-6">
              <h2 className="text-2xl font-bold text-sapphire-800 mb-6">Projects</h2>
              <p className="text-sapphire-600 mb-4">Manage your portfolio projects.</p>
              <div className="space-y-2">
                {projects.map(proj => (
                  <div key={proj.id} className="border border-cream-200 rounded-lg p-3">
                    <div className="font-medium text-sapphire-800">{proj.name}</div>
                    {proj.technologies && (
                      <div className="text-sm text-sapphire-600 mt-1">{proj.technologies}</div>
                    )}
                    {proj.description && (
                      <div className="text-sm text-sapphire-500 mt-1 line-clamp-2">{proj.description}</div>
                    )}
                  </div>
                ))}
              </div>
              <button className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 transition-colors">
                + Add Project
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
