import React, { useState, useEffect } from 'react';
import { useEnterprise } from '../context/EnterpriseContext';
import { ErpDocument } from '../types/enterprise';
import { getErpDocuments, uploadErpDocument } from '../services/erpDocumentService';
import { FolderGit2, FileText, UploadCloud, Tag, Download, Eye, Search } from 'lucide-react';

export const ErpDocumentsPage: React.FC = () => {
  const { currentOrg, selectedProject, selectedSite } = useEnterprise();
  const [documents, setDocuments] = useState<ErpDocument[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Form states
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<'blueprint' | 'contract' | 'permit' | 'compliance' | 'invoice' | 'report' | 'general'>('blueprint');
  const [fileName, setFileName] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const loadDocs = async () => {
    const data = await getErpDocuments(
      categoryFilter === 'all' ? undefined : categoryFilter,
      selectedProject?.id,
      selectedSite?.id,
      currentOrg?.id
    );
    setDocuments(data);
  };

  useEffect(() => {
    loadDocs();
  }, [categoryFilter, selectedProject, selectedSite, currentOrg]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle) return;

    await uploadErpDocument({
      org_id: currentOrg?.id || 'org_enterprise_default',
      project_id: selectedProject?.id || null,
      site_id: selectedSite?.id || null,
      category: docCategory,
      title: docTitle,
      file_name: fileName || `${docTitle.replace(/\s+/g, '_')}.pdf`,
      file_size: 2500000,
      file_type: 'application/pdf',
      file_url: '#',
      uploaded_by: 'Authorized Site Engineer',
      tags: tagsInput ? tagsInput.split(',').map((t) => t.trim()) : ['Site'],
    });

    setIsUploadModalOpen(false);
    setDocTitle('');
    setFileName('');
    setTagsInput('');
    loadDocs();
  };

  const filtered = documents.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-6 h-6 text-purple-600" />
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Engineering Documents & Blueprints</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Structural drawings, regulatory permits, work orders, contracts & compliance records.
          </p>
        </div>

        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all self-start md:self-auto"
        >
          <UploadCloud className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
          {['all', 'blueprint', 'contract', 'permit', 'compliance'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize whitespace-nowrap transition-all ${
                categoryFilter === cat
                  ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {cat === 'all' ? 'All Files' : cat + 's'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search drawings or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((doc) => (
          <div
            key={doc.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-purple-400 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400">
                  {doc.category}
                </span>
                <FileText className="w-5 h-5 text-purple-500 shrink-0" />
              </div>

              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-2 leading-snug">
                {doc.title}
              </h3>
              <p className="text-[11px] font-mono text-slate-400 mt-1 truncate">{doc.file_name}</p>

              <div className="flex flex-wrap gap-1 mt-3">
                {doc.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium text-slate-600 dark:text-slate-300"
                  >
                    <Tag className="w-2.5 h-2.5 text-slate-400" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <span>{doc.file_size ? `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB` : 'Document'}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => alert(`Opening ${doc.file_name} in CAD/PDF viewer`)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="View"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => alert(`Downloading ${doc.file_name}`)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Upload Engineering Document</h3>

            <form onSubmit={handleUpload} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CST Station Underground Layout Rev-4"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Category *</label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                  >
                    <option value="blueprint">Blueprint / CAD Drawing</option>
                    <option value="contract">Work Order / Contract</option>
                    <option value="permit">Site Permit / Clearance</option>
                    <option value="compliance">EHS & Safety Compliance</option>
                    <option value="invoice">Commercial Tax Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">File Name</label>
                  <input
                    type="text"
                    placeholder="drawing_layout.dwg / pdf"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="Foundation, Structural, Pier 4"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20"
                >
                  Save & Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default ErpDocumentsPage;
