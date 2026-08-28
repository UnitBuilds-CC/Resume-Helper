import { useState, useCallback } from 'react';
import { api } from '../hooks/api';

interface FileUploadProps {
  onTextExtracted: (text: string, filename: string) => void;
}

export default function FileUpload({ onTextExtracted }: FileUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api('/api/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onTextExtracted(data.text, data.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }, [onTextExtracted]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
        dragging ? 'border-teal-500 bg-teal-500/10' : 'border-cream-300/40 hover:border-sapphire-300/60'
      }`}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sapphire-600 text-sm">Extracting text...</p>
        </div>
      ) : error ? (
        <p className="text-teal-600 text-sm">{error}</p>
      ) : (
        <>
          <p className="text-sapphire-600 text-sm mb-1">Drop a file here or click to browse</p>
          <p className="text-sapphire-400 text-xs">PDF, DOCX, TXT, MD</p>
        </>
      )}
      <input type="file" accept=".pdf,.docx,.txt,.md,.markdown" onChange={onInputChange} className="hidden" id="file-upload" />
      <label htmlFor="file-upload" className="mt-3 inline-block btn-secondary cursor-pointer text-xs">
        Choose File
      </label>
    </div>
  );
}
