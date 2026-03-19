import React, { useState, useEffect } from 'react';
import { Shield, Lock, Unlock, Key, FileLock2, Search, Plus, Trash2, Copy, ExternalLink, MoreVertical, Check, AlertCircle, RefreshCw, Settings2, Eye, EyeOff, Info, Edit2, Upload, X, ArrowLeftRight, Download, FileText, Folder, FolderOpen } from 'lucide-react';
import { VaultEntry } from './types';
import { encryptData, decryptData, generateRecoveryKey } from './lib/crypto';
import { generatePassword, PasswordOptions } from './lib/password';
import { parseSmartPlaintext, readFileAsText } from './lib/importer';
import { getDomain, getIconUrl, getBrandColor } from './lib/branding';
import './App.css';
import { readTextFile, writeTextFile, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';

const VAULT_STORAGE_KEY = 'mavault_data_v2';
const NATIVE_FILE_NAME = 'mavault_core.sec';

// Helper to determine if we are running in Tauri
const isTauri = () => '__TAURI_INTERNALS__' in window;

// Helper to generate consistent, subtle pastel colors based on category name
const getStringColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 45%, 65%)`; // Matte, sophisticated color
};

export default function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [passphrase, setPassphrase] = useState('');
  // ... rest of state

  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'vault' | 'notes' | 'recovery' | 'security' | 'settings'>('vault');
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState<string | null>(null);
  const [storedRecoveryKey, setStoredRecoveryKey] = useState<string | null>(localStorage.getItem('mavault_rk'));
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [viewingRecovery, setViewingRecovery] = useState<VaultEntry | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [detectedEntries, setDetectedEntries] = useState<(Partial<VaultEntry> & { id: string })[]>([]);
  const [showImportPasswords, setShowImportPasswords] = useState(false);
  const [isGroupedView, setIsGroupedView] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const handleImportTextChange = (text: string) => {
    setImportText(text);
    const parsed = parseSmartPlaintext(text);
    setDetectedEntries(parsed);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    let combinedText = importText;
    for (let i = 0; i < files.length; i++) {
        const text = await readFileAsText(files[i]);
        combinedText += (combinedText ? '\n---\n' : '') + text;
    }
    handleImportTextChange(combinedText);
  };

  const updateDetectedEntry = (id: string, updates: Partial<VaultEntry>) => {
    setDetectedEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const removeDetectedEntry = (id: string) => {
    setDetectedEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleSwapUserPass = (id: string) => {
    setDetectedEntries(prev => prev.map(e => {
        if (e.id === id) {
            return { ...e, username: e.password, password: e.username };
        }
        return e;
    }));
  };

  const handleImportVault = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const encryptedData = await readFileAsText(file);
        const decrypted = await decryptData(encryptedData, passphrase);
        const importedEntries = JSON.parse(decrypted);
        
        if (window.confirm(`Merge ${importedEntries.length} entries into your current vault?`)) {
            const combined = [...importedEntries, ...entries];
            setEntries(combined);
            await saveVault(combined);
            showToast('Vault imported successfully!');
        }
    } catch (err: any) {
        showToast(err.message || 'Failed to decrypt backup. Ensure you use the same passphrase.', 'error');
    }
    e.target.value = ''; // Reset input
  };

  const handleExportVault = async () => {
    try {
        const dataStr = JSON.stringify(entries);
        const encrypted = await encryptData(dataStr, passphrase);
        const blob = new Blob([encrypted], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const date = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `mavault_backup_${date}.sec`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Vault exported successfully!');
    } catch (err) {
        showToast('Failed to export vault', 'error');
    }
  };

  const handleExportPlaintext = () => {
    const passwords = entries.filter(e => e.type === 'password');
    if (passwords.length === 0) {
        showToast('No passwords to export', 'error');
        return;
    }

    if (!window.confirm('WARNING: This will download a PLAIN TEXT file with all your passwords. This is NOT SECURE. Continue?')) {
        return;
    }

    let content = '';
    passwords.forEach(e => {
        const parts = [
            `USER: ${e.username}`,
            `PASS: ${e.password || ''}`,
            `WEB: ${e.website || ''}`,
            `NOTE: ${e.notes?.replace(/\n/g, ' ') || ''}`,
            `TAGS: ${(e.tags || []).join(', ')}`,
            `DATE: ${e.lastUpdated}`
        ];
        content += parts.join(' --- ') + '\n';
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `mavault_passwords_${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Plaintext export successful!');
  };

  const [genOptions, setGenOptions] = useState<PasswordOptions>({
    length: 16,
    useUppercase: true,
    useLowercase: true,
    useNumbers: true,
    useSymbols: true,
  });

  const AUTO_LOCK_TIMEOUT = 5 * 60 * 1000;

  useEffect(() => {
    if (isLocked) return;
    let timer: NodeJS.Timeout;
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setIsLocked(true);
        setPassphrase('');
        setEntries([]);
        setIsRecoveryMode(false);
        showToast('Vault auto-locked due to inactivity', 'error');
      }, AUTO_LOCK_TIMEOUT);
    };
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));
    resetTimer();
    return () => {
      if (timer) clearTimeout(timer);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [isLocked]);

  const [newEntry, setNewEntry] = useState<Partial<VaultEntry> & { tagsString?: string }>({
    type: 'password',
    name: '',
    username: '',
    password: '',
    website: '',
    notes: '',
    tagsString: '',
  });

  const handleGenerate = () => {
    const pwd = generatePassword(genOptions);
    setNewEntry({ ...newEntry, password: pwd });
    setShowPassword(true);
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) return;
    setIsLoading(true);
    setError(null);
    try {
      let storedData = null;

      if (isTauri()) {
        try {
          const filePath = await join(await appDataDir(), NATIVE_FILE_NAME);
          if (await exists(filePath)) {
            storedData = await readTextFile(filePath);
          }
        } catch (fsErr) {
          console.error("Tauri FS read error:", fsErr);
          // Fallback to local storage if file doesn't exist yet but we are in Tauri
          storedData = localStorage.getItem(VAULT_STORAGE_KEY);
        }
      } else {
        storedData = localStorage.getItem(VAULT_STORAGE_KEY);
      }

      if (storedData) {
        const payload = JSON.parse(storedData);
        const encryptedBlob = isRecoveryMode ? payload.r : payload.p;
        
        if (!encryptedBlob) {
            throw new Error(isRecoveryMode ? 'No recovery key data found.' : 'No passphrase data found.');
        }

        const decrypted = await decryptData(encryptedBlob, passphrase);
        try {
            setEntries(JSON.parse(decrypted));
        } catch (parseErr) {
            throw new Error('Vault data is corrupted (invalid JSON).');
        }
      } else {
        const rk = generateRecoveryKey();
        setGeneratedRecoveryKey(rk);
        setEntries([]);
      }
      setIsLocked(false);
    } catch (err: any) {
      console.error('Unlock error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveVault = async (updatedEntries: VaultEntry[], currentPassphrase = passphrase, rk = storedRecoveryKey) => {
    if (!currentPassphrase || !rk) return;
    try {
      const dataStr = JSON.stringify(updatedEntries);
      const encryptedPass = await encryptData(dataStr, currentPassphrase);
      const encryptedRec = await encryptData(dataStr, rk);
      const payload = { p: encryptedPass, r: encryptedRec };
      const payloadStr = JSON.stringify(payload);

      if (isTauri()) {
        const filePath = await join(await appDataDir(), NATIVE_FILE_NAME);
        
        // Ensure AppData directory exists (handled automatically by writeTextFile if baseDir is set, but we are using absolute paths here so we might need to rely on Tauri's rust side. For safety, we will just write the file using BaseDirectory)
        await writeTextFile(NATIVE_FILE_NAME, payloadStr, { baseDir: BaseDirectory.AppData });
        
        // Also create a backup
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        await writeTextFile(`${NATIVE_FILE_NAME}.backup.${timestamp}`, payloadStr, { baseDir: BaseDirectory.AppData });
      } else {
        localStorage.setItem(VAULT_STORAGE_KEY, payloadStr);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to save vault securely', 'error');
    }
  };

  const finalizeVaultCreation = async () => {
    if (generatedRecoveryKey) {
      localStorage.setItem('mavault_rk', generatedRecoveryKey);
      setStoredRecoveryKey(generatedRecoveryKey);
      await saveVault([], passphrase, generatedRecoveryKey);
      setGeneratedRecoveryKey(null);
      showToast('Vault created and secured.');
    }
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    let tags = newEntry.tagsString ? newEntry.tagsString.split(',').map(t => t.trim()).filter(t => t !== '') : [];
    
    // Auto-Tag Heuristics (Dynamic + Known)
    const knownCategories = ['driftaline', 'immigro', 'interviewamigo', 'mavia', 'safoora', 'shakeel', 'personal', 'work', 'finance'];
    
    // Extract all unique existing tags from the vault to act as dynamic categories
    const existingTags = new Set(knownCategories);
    entries.forEach(entry => {
        if (entry.tags) {
            entry.tags.forEach(t => existingTags.add(t.toLowerCase()));
        }
    });

    const searchTarget = `${newEntry.name || ''} ${newEntry.website || ''} ${newEntry.notes || ''}`.toLowerCase();
    
    // Check against all known AND dynamically learned tags
    for (const cat of Array.from(existingTags)) {
      if (searchTarget.includes(cat)) {
        // Find original casing if it exists, otherwise capitalize first letter
        const originalCasingTag = entries.flatMap(e => e.tags || []).find(t => t.toLowerCase() === cat);
        const capitalizedTag = originalCasingTag || (cat.charAt(0).toUpperCase() + cat.slice(1));
        
        if (!tags.includes(capitalizedTag)) {
          tags.push(capitalizedTag);
        }
      }
    }

    const entry: VaultEntry = {
      id: editingEntry ? editingEntry.id : crypto.randomUUID(),
      name: newEntry.name || 'Untitled',
      username: newEntry.username || '',
      password: newEntry.password,
      website: newEntry.website,
      notes: newEntry.notes,
      type: newEntry.type as any,
      tags: tags,
      lastUpdated: new Date().toISOString(),
    };
    let updatedEntries = editingEntry ? entries.map(e => e.id === editingEntry.id ? entry : e) : [entry, ...entries];
    setEntries(updatedEntries);
    await saveVault(updatedEntries);
    setShowAddModal(false);
    setEditingEntry(null);
    setSelectedEntryId(entry.id);
    setNewEntry({ type: 'password', name: '', username: '', password: '', website: '', notes: '', tagsString: '' });
    setShowPassword(false);
    showToast(editingEntry ? 'Entry updated' : 'Entry added');
  };

  const startEditing = (entry: VaultEntry) => {
    setEditingEntry(entry);
    setNewEntry({ ...entry, tagsString: entry.tags?.join(', ') || '' });
    setShowAddModal(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied!`);
    setTimeout(() => {
      navigator.clipboard.readText().then(current => {
        if (current === text) navigator.clipboard.writeText('');
      });
    }, 15000);
  };

  const handleDeleteEntry = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      const updatedEntries = entries.filter(e => e.id !== id);
      setEntries(updatedEntries);
      await saveVault(updatedEntries);
      setSelectedEntryId(null);
      showToast('Entry deleted');
    }
  };

  const selectedEntry = entries.find(e => e.id === selectedEntryId);

  const filteredEntries = entries.filter(e => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = e.name.toLowerCase().includes(query) || 
                         (e.username?.toLowerCase().includes(query)) ||
                         (e.tags?.some(t => t.toLowerCase().includes(query)));
    if (activeTab === 'vault') return matchesSearch && e.type === 'password';
    if (activeTab === 'notes') return matchesSearch && e.type === 'note';
    if (activeTab === 'recovery') return matchesSearch && e.type === 'recovery';
    return matchesSearch;
  });

  if (isLocked) {
    return (
      <div className="lock-screen">
        <div className="lock-card">
          <div className="logo-container">
            <Shield className="logo-icon" size={64} />
            <h1>Mavault</h1>
            <p>High-Security Local Vault</p>
          </div>
          <form onSubmit={handleUnlock}>
            <div className="input-group">
              <label>{isRecoveryMode ? 'Recovery Key' : 'Master Passphrase'}</label>
              <div className="input-wrapper">
                {isRecoveryMode ? <Key className="input-icon" size={18} /> : <Lock className="input-icon" size={18} />}
                <input type="password" placeholder={isRecoveryMode ? "Enter recovery key..." : "Enter passphrase..."} value={passphrase} onChange={(e) => setPassphrase(e.target.value)} autoFocus />
              </div>
              {error && <div className="error-message"><AlertCircle size={14} /> {error}</div>}
            </div>
            <button type="submit" className="unlock-button" disabled={isLoading}>
              {isLoading ? <span className="loader"></span> : <><Unlock size={18} /><span>{isRecoveryMode ? 'Recover' : 'Unlock'}</span></>}
            </button>
          </form>
          <button className="text-button" onClick={() => { setIsRecoveryMode(!isRecoveryMode); setError(null); setPassphrase(''); }}>
            <span>{isRecoveryMode ? 'Use Passphrase' : 'Use Recovery Key'}</span>
          </button>
          
          <button className="text-button reset-vault-btn" onClick={() => {
            if (window.confirm('DANGER: This will permanently delete your entire vault and all recovery keys. Are you sure?')) {
              localStorage.clear();
              window.location.reload();
            }
          }}>
            <span>Reset Vault (Delete All Data)</span>
          </button>
        </div>
        {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' ? <Check size={18} className="success-icon" /> : <AlertCircle size={18} className="error-icon" />}
          <span>{toast.message}</span>
        </div>
      )}
      </div>
    );
  }

  const getSecurityStats = () => {
    const total = entries.length;
    const weak = entries.filter(e => e.type === 'password' && e.password && e.password.length < 8).length;
    const reused = entries.filter(e => 
      e.type === 'password' && e.password && entries.filter(other => other.id !== e.id && other.password === e.password).length > 0
    ).length;
    return { total, weak, reused };
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Shield size={24} className="accent" style={{ filter: 'drop-shadow(0 0 12px rgba(59, 130, 246, 0.4))' }} />
          <span>Mavault</span>
        </div>
        <nav>
          <div className="sidebar-group">
            <div className="sidebar-group-title">My Vault</div>
            <button className={`nav-item ${activeTab === 'vault' ? 'active' : ''}`} onClick={() => setActiveTab('vault')}>
              <Lock size={16} /><span>Password Vault</span>
            </button>
            <button className={`nav-item ${activeTab === 'notes' ? 'active' : ''}`} onClick={() => setActiveTab('notes')}>
              <Key size={16} /><span>Secure Notes</span>
            </button>
            <button className={`nav-item ${activeTab === 'recovery' ? 'active' : ''}`} onClick={() => setActiveTab('recovery')}>
              <FileLock2 size={16} /><span>Recovery Codes</span>
            </button>
          </div>

          <div className="sidebar-group">
            <div className="sidebar-group-title">System</div>
            <button className={`nav-item ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}>
              <Shield size={16} /><span>Security Health</span>
            </button>
            <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <Settings2 size={16} /><span>Settings & Data</span>
            </button>
          </div>
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item lock-nav-btn" onClick={() => setIsLocked(true)}>
             <Unlock size={16} /><span>Lock Vault</span>
          </button>
        </div>
      </aside>

      {activeTab === 'security' ? (
        <main className="column-detail animate-fade-in">
          <div className="security-dashboard">
            <h2 className="detail-name" style={{ marginBottom: '40px' }}>Security Health</h2>
            {(() => {
              const stats = getSecurityStats();
              return (
                <>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <span className="stat-value">{stats.total}</span>
                      <span className="stat-label">Total Entries</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-value" style={{ color: stats.weak > 0 ? 'var(--warning)' : 'var(--success)' }}>{stats.weak}</span>
                      <span className="stat-label">Weak Passwords</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-value" style={{ color: stats.reused > 0 ? 'var(--error)' : 'var(--success)' }}>{stats.reused}</span>
                      <span className="stat-label">Reused Passwords</span>
                    </div>
                  </div>
                  <div className="security-recommendations">
                    <h3 className="field-label" style={{ marginBottom: '24px' }}>Recommendations</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {stats.weak > 0 && <div className="field-value-wrapper"><AlertCircle size={20} style={{ color: 'var(--warning)' }} /> <span>You have {stats.weak} weak passwords that should be updated.</span></div>}
                      {stats.reused > 0 && <div className="field-value-wrapper"><AlertCircle size={20} style={{ color: 'var(--error)' }} /> <span>{stats.reused} accounts share the same password. Unique passwords are safer.</span></div>}
                      {stats.total > 0 && stats.weak === 0 && stats.reused === 0 && <div className="field-value-wrapper"><Check size={20} style={{ color: 'var(--success)' }} /> <span>Your vault is in great health! All passwords are strong and unique.</span></div>}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </main>
      ) : activeTab === 'settings' ? (
        <main className="column-detail animate-fade-in">
            <div className="security-dashboard">
                <h2 className="detail-name" style={{ marginBottom: '40px' }}>Vault Settings</h2>
                
                <h3 className="field-label" style={{ marginBottom: '24px' }}>Data Management</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="field-value-wrapper" style={{ justifyContent: 'space-between', padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <Download size={24} className="accent" />
                        <div>
                        <div style={{ fontWeight: 600, fontSize: '16px' }}>Export Encrypted Vault</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Download a secure backup of all your entries.</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <input type="file" id="vault-import-input" accept=".sec" style={{ display: 'none' }} onChange={handleImportVault} />
                        <button className="btn btn-ghost" onClick={() => document.getElementById('vault-import-input')?.click()}>
                        <Upload size={16} /> Import (.sec)
                        </button>
                        <button className="btn btn-primary" onClick={handleExportVault}>
                        <Download size={16} /> Export (.sec)
                        </button>
                    </div>
                    </div>

                    <div className="field-value-wrapper" style={{ justifyContent: 'space-between', padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <FileText size={24} style={{ color: 'var(--warning)' }} />
                        <div>
                        <div style={{ fontWeight: 600, fontSize: '16px' }}>Plaintext Export</div>
                        <div style={{ fontSize: '13px', color: 'var(--error)', marginTop: '4px' }}>Warning: This file will NOT be encrypted.</div>
                        </div>
                    </div>
                    <button className="btn btn-ghost" onClick={handleExportPlaintext} style={{ borderColor: 'var(--error)' }}>
                        <FileText size={16} /> Export (.txt)
                    </button>
                    </div>
                </div>

                <h3 className="field-label" style={{ marginBottom: '24px', marginTop: '48px' }}>Security Configuration</h3>
                <div className="field-value-wrapper" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <Lock size={24} className="accent" />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '16px' }}>Auto-Lock Timer</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>Vault will lock after 5 minutes of inactivity.</div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
      ) : (
        <>
          {/* List Column */}
          <section className="column-list">
            <div className="list-toolbar">
              <div className="search-wrapper">
                <Search size={14} className="search-icon" />
                <input className="search-input" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => {
                  setEditingEntry(null);
                  const typeMap = { vault: 'password', notes: 'note', recovery: 'recovery' };
                  setNewEntry({ type: (typeMap as any)[activeTab] || 'password', name: '', username: '', password: '', website: '', notes: '', tagsString: '' }); 
                  setShowAddModal(true);
                }}>
                  <Plus size={14} /> Add
                </button>
                <button className={`btn btn-ghost ${isGroupedView ? 'active' : ''}`} title="Toggle Folders" onClick={() => setIsGroupedView(!isGroupedView)} style={{ background: isGroupedView ? 'var(--glass-bg-active)' : '' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinelinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                </button>
                <button className="btn btn-ghost" title="Smart Import" onClick={() => setShowImportModal(true)}>
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
            <div className="entry-scroll">
              {(() => {
                if (!isGroupedView || searchTerm) {
                  return filteredEntries.map(entry => {
                    const domain = getDomain(entry.website, entry.name);
                    const iconUrl = getIconUrl(domain);
                    const brandColor = getBrandColor(domain);

                    return (
                      <div 
                        key={entry.id} 
                        className={`entry-list-item ${selectedEntryId === entry.id ? 'active' : ''}`} 
                        onClick={() => setSelectedEntryId(entry.id)}
                      >
                        <div className="brand-orb brand-orb-small" style={{ '--brand-color': brandColor } as any}>
                          {iconUrl ? <img src={iconUrl} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} /> : <Shield size={16} />}
                        </div>
                        <div className="entry-list-info">
                          <div className="entry-item-header">
                            <span className="entry-item-title">{entry.name}</span>
                            {!searchTerm && <span className="entry-item-subtitle">{new Date(entry.lastUpdated).toLocaleDateString()}</span>}
                          </div>
                          <div className="entry-item-subtitle">
                            {entry.type === 'password' ? (entry.username || 'No username') : entry.type === 'note' ? 'Secure Note' : 'Recovery Code'}
                          </div>
                          {entry.tags && entry.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                              {entry.tags.slice(0, 2).map(t => <span key={t} className="tag-pill">{t}</span>)}
                              {entry.tags.length > 2 && <span className="tag-pill">+{entry.tags.length - 2}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                }

                // Grouped View Logic
                const groups: Record<string, VaultEntry[]> = {};
                filteredEntries.forEach(entry => {
                  const category = (entry.tags && entry.tags.length > 0) ? entry.tags[0].toUpperCase() : 'UNCATEGORIZED';
                  if (!groups[category]) groups[category] = [];
                  groups[category].push(entry);
                });

                // Sort groups: Uncategorized at bottom, others alphabetical
                const sortedGroupNames = Object.keys(groups).sort((a, b) => {
                  if (a === 'UNCATEGORIZED') return 1;
                  if (b === 'UNCATEGORIZED') return -1;
                  return a.localeCompare(b);
                });

                return sortedGroupNames.map(groupName => {
                  const isCollapsed = collapsedGroups[groupName];
                  return (
                    <div key={groupName} className="category-group">
                      <div className="category-header-wrapper">
                        <div 
                          className="category-header" 
                          onClick={() => toggleGroup(groupName)}
                          style={{
                            boxShadow: `0 4px 12px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.05)`
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                            {isCollapsed ? <Folder size={14} fill="rgba(255, 255, 255, 0.05)" /> : <FolderOpen size={14} fill="rgba(255, 255, 255, 0.05)" />}
                            <span style={{ color: 'var(--text-primary)' }}>{groupName}</span>
                          </span>
                          <span className="category-count">{groups[groupName].length}</span>
                        </div>
                      </div>
                      <div className={`category-content-wrapper ${isCollapsed ? 'collapsed' : ''}`}>
                        <div className="category-content">
                          {groups[groupName].map(entry => {
                            const domain = getDomain(entry.website, entry.name);
                            const iconUrl = getIconUrl(domain);
                            const brandColor = getBrandColor(domain);

                            return (
                              <div 
                                key={entry.id} 
                                className={`entry-list-item ${selectedEntryId === entry.id ? 'active' : ''}`} 
                                onClick={() => setSelectedEntryId(entry.id)}
                              >
                                <div className="brand-orb brand-orb-small" style={{ '--brand-color': brandColor } as any}>
                                  {iconUrl ? <img src={iconUrl} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} /> : <Shield size={16} />}
                                </div>
                                <div className="entry-list-info">
                                  <div className="entry-item-header">
                                    <span className="entry-item-title">{entry.name}</span>
                                  </div>
                                  <div className="entry-item-subtitle" style={{ marginTop: '2px' }}>
                                    {entry.type === 'password' ? (entry.username || 'No username') : entry.type === 'note' ? 'Secure Note' : 'Recovery Code'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </section>

          {/* Detail Column */}
          <main className="column-detail">
            {selectedEntry ? (
              <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="detail-aura-bg" style={{ '--brand-color': getBrandColor(getDomain(selectedEntry.website, selectedEntry.name)) } as any} />
                <header className="detail-header">
                  <button className="btn btn-ghost" onClick={() => startEditing(selectedEntry)}><Edit2 size={14} /> Edit</button>
                  <button className="btn btn-ghost" onClick={() => handleDeleteEntry(selectedEntry.id)} style={{ color: 'var(--error)' }}><Trash2 size={14} /> Delete</button>
                </header>
                <div className="detail-content">
                  <div className="detail-title-section">
                    <div className="detail-type">{selectedEntry.type}</div>
                    <h2 className="detail-name">{selectedEntry.name}</h2>
                    {selectedEntry.tags && selectedEntry.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        {selectedEntry.tags.map(t => <span key={t} className="tag-pill">{t}</span>)}
                      </div>
                    )}
                  </div>

                  <div className="bento-grid">
                    {selectedEntry.type === 'password' && (
                      <div className="bento-card bento-full-width">
                        <div className="copy-zone" onClick={() => copyToClipboard(selectedEntry.username || '', 'Username')}>
                          <span className="copy-zone-label">Username</span>
                          <span className="copy-zone-value">{selectedEntry.username || '—'}</span>
                          <div className="copy-indicator"><Copy size={12} /> Copy</div>
                        </div>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0 -16px' }}></div>
                        <div className="copy-zone" onClick={() => selectedEntry.password && copyToClipboard(selectedEntry.password, 'Password')}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="copy-zone-label">Password</span>
                            <button className="btn btn-ghost" style={{ padding: '4px 8px', height: 'auto', zIndex: 2 }} onClick={(e) => { e.stopPropagation(); setShowPassword(!showPassword); }}>
                              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          <span className={`copy-zone-value ${!showPassword ? 'masked' : ''}`}>
                            {showPassword ? selectedEntry.password : '••••••••••••'}
                          </span>
                          <div className="copy-indicator"><Copy size={12} /> Copy</div>
                        </div>
                      </div>
                    )}

                    {selectedEntry.website && (
                      <div className="bento-card">
                        <div className="copy-zone" onClick={() => copyToClipboard(selectedEntry.website || '', 'Website')}>
                          <span className="copy-zone-label">Website</span>
                          <span className="copy-zone-value" style={{ fontSize: '14px' }}>{selectedEntry.website}</span>
                          <div className="copy-indicator"><Copy size={12} /> Copy</div>
                        </div>
                        <a href={selectedEntry.website.startsWith('http') ? selectedEntry.website : `https://${selectedEntry.website}`} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: 'auto' }}>
                          Open Link <ExternalLink size={14} />
                        </a>
                      </div>
                    )}

                    {selectedEntry.type === 'note' && (
                      <div className="bento-card bento-full-width">
                        <div className="copy-zone" onClick={() => selectedEntry.notes && copyToClipboard(selectedEntry.notes, 'Note')}>
                          <span className="copy-zone-label">Secure Note</span>
                          <pre className="copy-zone-value" style={{ whiteSpace: 'pre-wrap', fontSize: '14px', marginTop: '8px' }}>{selectedEntry.notes}</pre>
                          <div className="copy-indicator"><Copy size={12} /> Copy</div>
                        </div>
                      </div>
                    )}

                    {selectedEntry.type === 'recovery' && (
                      <div className="bento-card bento-full-width">
                        <div className="copy-zone" onClick={() => selectedEntry.notes && copyToClipboard(selectedEntry.notes, 'Codes')}>
                          <span className="copy-zone-label">Recovery Codes</span>
                          <span className="copy-zone-value" style={{ fontSize: '14px', opacity: 0.5 }}>Securely encrypted recovery information</span>
                          <div className="copy-indicator"><Copy size={12} /> Copy</div>
                        </div>
                        <button className="btn btn-primary" onClick={() => setViewingRecovery(selectedEntry)}><Shield size={14} /> View Grid</button>
                      </div>
                    )}

                    {(selectedEntry.type === 'password' && selectedEntry.notes) && (
                      <div className="bento-card bento-full-width">
                        <div className="copy-zone" onClick={() => selectedEntry.notes && copyToClipboard(selectedEntry.notes, 'Note')}>
                          <span className="copy-zone-label">Additional Notes</span>
                          <pre className="copy-zone-value" style={{ whiteSpace: 'pre-wrap', fontSize: '14px', marginTop: '8px' }}>{selectedEntry.notes}</pre>
                          <div className="copy-indicator"><Copy size={12} /> Copy</div>
                        </div>
                      </div>
                    )}

                    <div className="bento-card" style={{ background: 'transparent', boxShadow: 'none', border: 'none', padding: '16px 0' }}>
                      <span className="copy-zone-label">Last Updated</span>
                      <span className="copy-zone-value" style={{ fontSize: '12px', opacity: 0.5, marginTop: '4px' }}>
                        {new Date(selectedEntry.lastUpdated).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-detail">
                <p>Select an entry to view details</p>
              </div>
            )}
          </main>
        </>
      )}

      {/* Modals */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal animate-fade-in">
            <h3 style={{ marginBottom: '20px' }}>{editingEntry ? 'Edit' : 'Add'} {newEntry.type}</h3>
            <form onSubmit={handleSaveEntry}>
              <div className="form-group">
                <label>Name</label>
                <input required value={newEntry.name} onChange={e => setNewEntry({...newEntry, name: e.target.value})} placeholder="e.g. Google, Netflix..." />
              </div>
              {newEntry.type === 'password' && (
                <>
                  <div className="form-group">
                    <label>Username</label>
                    <input value={newEntry.username} onChange={e => setNewEntry({...newEntry, username: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type={showPassword ? "text" : "password"} style={{ flex: 1 }} value={newEntry.password} onChange={e => setNewEntry({...newEntry, password: e.target.value})} />
                      <button type="button" className="btn btn-ghost" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                      <button type="button" className="btn btn-ghost" onClick={handleGenerate}><RefreshCw size={14} /></button>
                      <button type="button" className="btn btn-ghost" onClick={() => setShowGenerator(!showGenerator)}><Settings2 size={14} /></button>
                    </div>
                  </div>
                  {showGenerator && (
                    <div className="generator-options" style={{ marginBottom: '16px' }}>
                      <div className="range-group"><label>Length: {genOptions.length}</label><input type="range" min="8" max="64" value={genOptions.length} onChange={e => setGenOptions({...genOptions, length: parseInt(e.target.value)})} /></div>
                      <div className="checkbox-grid">
                        <label><input type="checkbox" checked={genOptions.useUppercase} onChange={e => setGenOptions({...genOptions, useUppercase: e.target.checked})} />ABC</label>
                        <label><input type="checkbox" checked={genOptions.useLowercase} onChange={e => setGenOptions({...genOptions, useLowercase: e.target.checked})} />abc</label>
                        <label><input type="checkbox" checked={genOptions.useNumbers} onChange={e => setGenOptions({...genOptions, useNumbers: e.target.checked})} />123</label>
                        <label><input type="checkbox" checked={genOptions.useSymbols} onChange={e => setGenOptions({...genOptions, useSymbols: e.target.checked})} />#$&</label>
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label>Website URL</label>
                    <input value={newEntry.website} onChange={e => setNewEntry({...newEntry, website: e.target.value})} placeholder="https://..." />
                  </div>
                </>
              )}
              {(newEntry.type === 'note' || newEntry.type === 'recovery') && (
                <div className="form-group">
                  <label>{newEntry.type === 'note' ? 'Content' : 'Recovery Codes'}</label>
                  <textarea rows={6} value={newEntry.notes} onChange={e => setNewEntry({...newEntry, notes: e.target.value})} placeholder="Enter secure info..." />
                </div>
              )}
              <div className="form-group">
                <label>Tags (comma separated)</label>
                <input value={newEntry.tagsString} onChange={e => setNewEntry({...newEntry, tagsString: e.target.value})} placeholder="Work, Social..." />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => { setShowAddModal(false); setEditingEntry(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingRecovery && (
        <div className="modal-overlay">
          <div className="modal recovery-grid-modal animate-fade-in">
            <h3 style={{ marginBottom: '8px' }}>{viewingRecovery.name}</h3>
            <p className="modal-subtitle">Recovery Codes Grid</p>
            <div className="recovery-grid">
              {(viewingRecovery.notes || '').split(/\s+/).filter(w => w.trim() !== '').map((word, i) => (
                <div key={i} className="grid-item">
                  <span className="grid-index">{i + 1}</span>
                  <span className="grid-word">{word}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => copyToClipboard(viewingRecovery.notes || '', 'All codes')}>Copy All</button>
              <button className="btn btn-primary" onClick={() => setViewingRecovery(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {generatedRecoveryKey && (
        <div className="modal-overlay">
          <div className="modal animate-fade-in" style={{ textAlign: 'center' }}>
            <Key size={40} className="accent" style={{ marginBottom: '16px' }} />
            <h3 style={{ marginBottom: '8px' }}>Vault Recovery Key</h3>
            <p className="warning-text">Save this key in a secure physical location. It is the only way to recover your vault if you lose your passphrase.</p>
            <div className="field-value-wrapper" style={{ margin: '24px 0', justifyContent: 'center' }}>
              <code style={{ fontSize: '18px', color: 'var(--accent)', letterSpacing: '1px' }}>{generatedRecoveryKey}</code>
              <button className="btn btn-ghost" onClick={() => copyToClipboard(generatedRecoveryKey, 'Recovery Key')}><Copy size={16} /></button>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={finalizeVaultCreation}>I have saved the key</button>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal animate-fade-in" style={{ maxWidth: '900px', width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Smart Bulk Import</h3>
              <button className="btn btn-ghost" onClick={() => { setShowImportModal(false); setImportText(''); setDetectedEntries([]); }}>
                <X size={18} />
              </button>
            </div>
            
            <p className="modal-subtitle">Paste plaintext or upload files (.txt, .csv). We'll heuristically detect accounts, usernames, and passwords.</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div className="form-group">
                <label>Paste Text</label>
                <textarea 
                  rows={6} 
                  value={importText} 
                  onChange={e => handleImportTextChange(e.target.value)} 
                  placeholder="Title: My Account&#10;User: me@email.com&#10;Pass: secret123&#10;---&#10;Google&#10;google.com&#10;other_pass" 
                  style={{ fontSize: '12px' }}
                />
              </div>
              <div className="form-group">
                <label>Upload Files</label>
                <div className="file-drop-zone">
                  <input type="file" id="bulk-file-input" multiple accept=".txt,.csv,.md" onChange={handleFileChange} style={{ display: 'none' }} />
                  <label htmlFor="bulk-file-input" className="file-drop-label">
                    <Upload size={32} opacity={0.5} />
                    <span>Click to upload or drag & drop</span>
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>Supports .txt, .csv, .md</span>
                  </label>
                </div>
              </div>
            </div>

            {detectedEntries.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Detected Entries ({detectedEntries.length})
                  </h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-ghost" style={{ fontSize: '11px', height: '24px' }} onClick={() => setShowImportPasswords(!showImportPasswords)}>
                      {showImportPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showImportPasswords ? 'Hide' : 'Show'} Passwords
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: '11px', height: '24px' }} onClick={() => setDetectedEntries([])}>Clear All</button>
                  </div>
                </div>
                
                <div className="import-preview-container">
                  <table className="import-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Name</th>
                        <th>Username</th>
                        <th style={{ width: '32px' }}></th>
                        <th>Password</th>
                        <th>Website</th>
                        <th>Notes</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {detectedEntries.map((e) => (
                        <tr key={e.id}>
                          <td>
                            <select value={e.type} onChange={opt => updateDetectedEntry(e.id, { type: opt.target.value as any })}>
                              <option value="password">Pass</option>
                              <option value="note">Note</option>
                              <option value="recovery">Rec</option>
                            </select>
                          </td>
                          <td><input value={e.name} onChange={val => updateDetectedEntry(e.id, { name: val.target.value })} title={e.name} /></td>
                          <td><input value={e.username} onChange={val => updateDetectedEntry(e.id, { username: val.target.value })} title={e.username} /></td>
                          <td>
                            <button className="btn btn-ghost" onClick={() => handleSwapUserPass(e.id)} title="Swap Username/Password" style={{ padding: '4px' }}>
                              <ArrowLeftRight size={12} />
                            </button>
                          </td>
                          <td><input type={showImportPasswords ? "text" : "password"} value={e.password} onChange={val => updateDetectedEntry(e.id, { password: val.target.value })} /></td>
                          <td><input value={e.website} onChange={val => updateDetectedEntry(e.id, { website: val.target.value })} title={e.website} /></td>
                          <td><input value={e.notes} onChange={val => updateDetectedEntry(e.id, { notes: val.target.value })} title={e.notes} /></td>
                          <td>
                            <button className="btn btn-ghost" onClick={() => removeDetectedEntry(e.id)} style={{ color: 'var(--error)', padding: '4px' }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="btn btn-ghost" onClick={() => {
                setShowImportModal(false);
                setImportText('');
                setDetectedEntries([]);
                setShowImportPasswords(false);
              }}>Cancel</button>
              <button 
                className="btn btn-primary" 
                disabled={detectedEntries.length === 0}
                onClick={async () => {
                  const newVaultEntries = detectedEntries.map(e => ({
                    ...e,
                    lastUpdated: new Date().toISOString()
                  })) as VaultEntry[];
                  
                  const combined = [...newVaultEntries, ...entries];
                  setEntries(combined);
                  await saveVault(combined);
                  setShowImportModal(false);
                  setImportText('');
                  setDetectedEntries([]);
                  showToast(`Imported ${newVaultEntries.length} entries successfully.`);
                }}
              >
                Import {detectedEntries.length} Entries
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' ? <Check size={18} className="success-icon" /> : <AlertCircle size={18} className="error-icon" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
