import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Lock, Unlock, Key, FileLock2, Search, Plus, Trash2, Copy, ExternalLink, MoreVertical, Check, AlertCircle, RefreshCw, Settings2, Eye, EyeOff, Info, Edit2, Upload, X, ArrowLeftRight, Download, FileText, Folder, FolderOpen, ChevronDown, Tags } from 'lucide-react';
import { VaultEntry, CustomBrand } from './types';
import { encryptData, decryptData, generateRecoveryKey } from './lib/crypto';
import { generatePassword, PasswordOptions } from './lib/password';
import { parseSmartPlaintext, readFileAsText } from './lib/importer';
import { getDomain, getIconUrl, getBrandColor, getHeuristicBrand, POPULAR_BRANDS, getLetterAvatar, autoTagEntry } from './lib/branding';
import './App.css';

const VAULT_STORAGE_KEY = 'mavault_data_v2';
const NATIVE_FILE_NAME = 'mavault_core.sec';

// Helper to determine if we are running in Electron
const isElectron = () => navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;

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

  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'vault' | 'notes' | 'recovery' | 'security' | 'settings'>('vault');
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [customBrands, setCustomBrands] = useState<CustomBrand[]>([]);
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

  const [showBackupPassphraseModal, setShowBackupPassphraseModal] = useState<{ isOpen: boolean, resolve: (pass: string | null) => void, reject: () => void }>({ isOpen: false, resolve: () => {}, reject: () => {} });
  const [backupPassphraseInput, setBackupPassphraseInput] = useState('');

  const promptForBackupPassphrase = (): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      setBackupPassphraseInput('');
      setShowBackupPassphraseModal({ isOpen: true, resolve, reject });
    });
  };

  const handleImportVault = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const encryptedData = await readFileAsText(file);
        
        let decrypted: string | null = null;
        try {
            decrypted = await decryptData(encryptedData, passphrase);
        } catch (decryptErr) {
            // If it fails with current passphrase, prompt for the file's original passphrase using custom modal
            const backupPassword = await promptForBackupPassphrase();
            if (!backupPassword) {
                showToast('Import cancelled.', 'error');
                e.target.value = '';
                return;
            }
            decrypted = await decryptData(encryptedData, backupPassword);
        }

        if (!decrypted) throw new Error("Failed to decrypt.");

        const importedEntries = JSON.parse(decrypted);
        
        if (window.confirm(`Successfully decrypted! Merge ${importedEntries.length} entries into your current vault?`)) {
            const combined = [...importedEntries, ...entries];
            setEntries(combined);
            await saveVault(combined);
            showToast('Vault imported successfully!');
        }
    } catch (err: any) {
        showToast(err.message || 'Failed to decrypt backup. Incorrect passphrase.', 'error');
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
    if (entries.length === 0) {
        showToast('No data to export', 'error');
        return;
    }

    if (!window.confirm('WARNING: This will download a PLAIN TEXT file with ALL your data (Passwords, Notes, and Recovery Codes). This is NOT SECURE. Continue?')) {
        return;
    }

    let content = `MAVAULT HUMAN-READABLE EXPORT - ${new Date().toLocaleString()}\n`;
    content += `==========================================\n\n`;

    entries.forEach(e => {
        content += `[${e.type.toUpperCase()}] ${e.name}\n`;
        if (e.username) content += `Username: ${e.username}\n`;
        if (e.password) content += `Password: ${e.password}\n`;
        if (e.website)  content += `URL:      ${e.website}\n`;
        if (e.notes)    content += `Content:  \n${e.notes}\n`;
        if (e.tags && e.tags.length > 0) content += `Tags:     ${e.tags.join(', ')}\n`;
        content += `Last Updated: ${new Date(e.lastUpdated).toLocaleString()}\n`;
        content += `------------------------------------------\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `mavault_full_export_${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Full Plaintext export successful!');
  };

  const handleExportCSV = () => {
    const passwords = entries.filter(e => e.type === 'password');
    if (passwords.length === 0) {
        showToast('No passwords to export', 'error');
        return;
    }

    if (!window.confirm('This will download an UNENCRYPTED CSV of your PASSWORDS ONLY. This is intended for importing into other managers. Continue?')) {
        return;
    }

    const headers = ['name', 'url', 'username', 'password', 'notes', 'tags'];
    const rows = passwords.map(e => [
        `"${(e.name || '').replace(/"/g, '""')}"`,
        `"${(e.website || '').replace(/"/g, '""')}"`,
        `"${(e.username || '').replace(/"/g, '""')}"`,
        `"${(e.password || '').replace(/"/g, '""')}"`,
        `"${(e.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        `"${(e.tags || []).join(',')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `mavault_passwords_only_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('CSV Export successful!');
  };

  const [genOptions, setGenOptions] = useState<PasswordOptions>({
    length: 16,
    useUppercase: true,
    useLowercase: true,
    useNumbers: true,
    useSymbols: true,
  });

  const AUTO_LOCK_TIMEOUT = 5 * 60 * 1000;

  const [customBrandInput, setCustomBrandInput] = useState({ name: '', domain: '' });

  const lockVault = () => {
    setIsLocked(true);
    setPassphrase('');
    setEntries([]);
    setIsRecoveryMode(false);
    setShowAddModal(false);
    setEditingEntry(null);
    setSelectedEntryId(null);
    setNewEntry({ type: 'password', name: '', username: '', password: '', website: '', notes: '', tagsString: '' });
    showToast('Vault locked', 'error');
  };

  useEffect(() => {
    if (isElectron()) {
      (window as any).api.onLock(() => lockVault());
    }
  }, []);

  useEffect(() => {
    if (isLocked) return;
    let timer: NodeJS.Timeout;
    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        lockVault();
        showToast('Vault auto-locked due to inactivity', 'error');
      }, AUTO_LOCK_TIMEOUT);
    };
    const events = ['mousedown', 'mousemove', 'scroll', 'touchstart', 'keydown'];
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
    customIcon: undefined,
  });

  const handleCustomIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setNewEntry(prev => ({ ...prev, customIcon: base64 }));
        showToast('Custom icon uploaded');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerate = () => {
    const pwd = generatePassword(genOptions);
    setNewEntry({ ...newEntry, password: pwd });
    setShowPassword(true);
  };

  const runAutoDetect = () => {
    console.log("DEBUG: Auto-detect triggered for:", newEntry.website, newEntry.name);
    if (!newEntry.website) return;
    
    // Heuristically derive domain
    const domain = getDomain(newEntry.website, newEntry.name, customBrands);
    console.log("Detected domain:", domain);

    if (!domain) {
      showToast('Could not automatically detect brand from this website', 'error');
      return;
    }
    
    // Heuristic Brand Lookup
    const heuristic = getHeuristicBrand(newEntry.name || '', domain);
    console.log("Heuristic brand found:", heuristic);

    // Update state with detected info
    setCustomBrandInput({ 
        name: heuristic?.name || newEntry.name || 'Untitled', 
        domain: heuristic?.domain || domain 
    });
    
    // Suggest Tags
    const detectedTags: string[] = [];
    if (newEntry.website.includes('bank')) detectedTags.push('Finance');
    if (newEntry.website.includes('work') || (newEntry.name && newEntry.name.toLowerCase().includes('work'))) detectedTags.push('Work');
    
    setNewEntry(prev => ({
      ...prev,
      tagsString: [...(prev.tagsString ? prev.tagsString.split(', ') : []), ...detectedTags].join(', ')
    }));
    
    showToast('Auto-detected brand and tags!');
  };

  const handleAutoTag = async () => {
    if (!window.confirm('This will automatically categorize all your entries based on their names and websites. Continue?')) return;
    
    const updatedEntries = entries.map(entry => {
      if (entry.type !== 'password') return entry;
      const domain = getDomain(entry.website, entry.name, customBrands);
      const suggestedTags = autoTagEntry(entry.name, domain);
      
      const currentTags = entry.tags || [];
      const newTags = Array.from(new Set([...currentTags, ...suggestedTags]));
      
      return { ...entry, tags: newTags };
    });
    
    setEntries(updatedEntries);
    await saveVault(updatedEntries);
    showToast('Auto-tagged all entries!');
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
      let storedData = await (window as any).api.readVault();

      if (storedData) {
        const payload = JSON.parse(storedData);
        const encryptedBlob = isRecoveryMode ? payload.r : payload.p;
        
        if (!encryptedBlob) {
            throw new Error(isRecoveryMode ? 'No recovery key data found.' : 'No passphrase data found.');
        }

        const decrypted = await decryptData(encryptedBlob, passphrase);
        try {
            const parsed = JSON.parse(decrypted);
            // Handle legacy format vs new VaultData format
            if (Array.isArray(parsed)) {
                setEntries(parsed);
                setCustomBrands([]);
            } else {
                setEntries(parsed.entries || []);
                setCustomBrands(parsed.customBrands || []);
            }
            if (!isRecoveryMode) setStoredRecoveryKey(payload.rk);
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (parseErr) {
            throw new Error('Vault data is corrupted (invalid JSON).');
        }
      } else {
        const rk = generateRecoveryKey();
        setGeneratedRecoveryKey(rk);
        setEntries([]);
        setCustomBrands([]);
      }
      requestAnimationFrame(() => setIsLocked(false));
    } catch (err: any) {
      console.error('Unlock error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveVault = async (updatedEntries: VaultEntry[], updatedBrands = customBrands, currentPassphrase = passphrase, rk = storedRecoveryKey) => {
    if (!currentPassphrase || !rk) return;
    try {
      const dataStr = JSON.stringify({ entries: updatedEntries, customBrands: updatedBrands });
      const encryptedPass = await encryptData(dataStr, currentPassphrase);
      const encryptedRec = await encryptData(dataStr, rk);
      const payload = { p: encryptedPass, r: encryptedRec, rk: rk };
      const payloadStr = JSON.stringify(payload);

      await (window as any).api.writeVault(payloadStr);
    } catch (err) {
      console.error(err);
      showToast('Failed to save vault securely', 'error');
    }
  };

  const finalizeVaultCreation = async () => {
    if (generatedRecoveryKey) {
      localStorage.setItem('mavault_rk', generatedRecoveryKey);
      setStoredRecoveryKey(generatedRecoveryKey);
      await saveVault([], [], passphrase, generatedRecoveryKey);
      setGeneratedRecoveryKey(null);
      showToast('Vault created and secured.');
    }
  };

  const [iconSearchTerm, setIconSearchTerm] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);

  const filteredIcons = useMemo(() => {
    if (!iconSearchTerm) return POPULAR_BRANDS;
    return POPULAR_BRANDS.filter(b => b.name.toLowerCase().includes(iconSearchTerm.toLowerCase()));
  }, [iconSearchTerm]);

  const handleSaveEntry = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const currentTags = newEntry.tagsString ? newEntry.tagsString.split(',').map(t => t.trim()).filter(t => t !== '') : [];

    try {
        // If the user provided overrides in the branding section, we apply them to the entry directly
        const finalName = customBrandInput.name || newEntry.name || 'Untitled';
        const finalWebsite = customBrandInput.domain || newEntry.website || '';

        const entry: VaultEntry = {
          id: editingEntry ? editingEntry.id : crypto.randomUUID(),
          name: finalName,
          username: newEntry.username || '',
          password: newEntry.password || '',
          website: finalWebsite,
          notes: newEntry.notes || '',
          type: newEntry.type as any,
          tags: currentTags,
          lastUpdated: new Date().toISOString(),
          customIcon: newEntry.customIcon, 
        };
        
        const updatedEntries = editingEntry ? entries.map(e => e.id === editingEntry.id ? entry : e) : [entry, ...entries];
        
        // Save to state AND storage immediately
        setEntries(updatedEntries);
        await saveVault(updatedEntries, customBrands);
        
        setShowAddModal(false);
        setEditingEntry(null);
        setCustomBrandInput({ name: '', domain: '' });
        setSelectedEntryId(entry.id);
        setNewEntry({ type: 'password', name: '', username: '', password: '', website: '', notes: '', tagsString: '', customIcon: undefined });
        setShowPassword(false);
        showToast(editingEntry ? 'Entry updated' : 'Entry added');
    } catch (err) {
        showToast('Failed to save entry', 'error');
    }
  };

  const startEditing = (entry: VaultEntry) => {
    setEditingEntry(entry);
    setNewEntry({ ...entry, tagsString: entry.tags?.join(', ') || '', customIcon: entry.customIcon });
    
    // Set overrides to match current entry values so user can see them
    setCustomBrandInput({ name: entry.name, domain: entry.website || '' });

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

  const handleDeleteAllEntries = async () => {
    if (!window.confirm('DANGER: This will delete ALL entries in your vault. This action cannot be undone. Continue?')) return;
    if (!window.confirm('FINAL WARNING: Are you absolutely sure you want to clear your entire vault?')) return;
    
    setEntries([]);
    await saveVault([]);
    setSelectedEntryId(null);
    showToast('All entries deleted', 'error');
  };

  const selectedEntry = entries.find(e => e.id === selectedEntryId);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const query = searchTerm.toLowerCase();
      const matchesSearch = e.name.toLowerCase().includes(query) || 
                           (e.username?.toLowerCase().includes(query)) ||
                           (e.tags?.some(t => t.toLowerCase().includes(query)));
      
      if (activeTab === 'vault') return matchesSearch && e.type === 'password';
      if (activeTab === 'notes') return matchesSearch && e.type === 'note';
      if (activeTab === 'recovery') return matchesSearch && e.type === 'recovery';
      return matchesSearch;
    });
  }, [entries, searchTerm, activeTab]);

  // Grouped View Logic
  const groups = useMemo(() => {
    const g: Record<string, VaultEntry[]> = {};
    filteredEntries.forEach(entry => {
      const category = (entry.tags && entry.tags.length > 0) ? entry.tags[0].toUpperCase() : 'UNCATEGORIZED';
      if (!g[category]) g[category] = [];
      g[category].push(entry);
    });
    return g;
  }, [filteredEntries]);

  // Sort groups: Uncategorized at bottom, others alphabetical
  const sortedGroupNames = useMemo(() => {
    return Object.keys(groups).sort((a, b) => {
      if (a === 'UNCATEGORIZED') return 1;
      if (b === 'UNCATEGORIZED') return -1;
      return a.localeCompare(b);
    });
  }, [groups]);

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
          
          <button className="text-button reset-vault-btn" onClick={async () => {
            if (window.confirm('DANGER: This will permanently delete your entire vault and all recovery keys. Are you sure?')) {
              localStorage.clear();
              if (isElectron() && (window as any).api?.deleteVault) {
                try {
                  await (window as any).api.deleteVault();
                } catch (e) {
                  console.error('Failed to delete vault file', e);
                }
              }
              // Reset state manually instead of reloading to prevent freezing
              setStoredRecoveryKey(null);
              setGeneratedRecoveryKey(null);
              setPassphrase('');
              setIsRecoveryMode(false);
              setError(null);
              setEntries([]);
              setCustomBrands([]);
              setIsLocked(true);
              showToast('Vault has been completely reset.');
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
    const passEntries = entries.filter(e => e.type === 'password');
    const weakEntries = passEntries.filter(e => e.password && e.password.length < 8);
    const reusedEntries = passEntries.filter(e => 
      e.password && passEntries.filter(other => other.id !== e.id && other.password === e.password).length > 0
    );
    
    // Heuristic Breach Check (Common Passwords)
    const commonPasswords = ['123456', 'password', '12345678', 'qwerty', '12345', '123456789', 'admin', '1234'];
    const breachedEntries = passEntries.filter(e => e.password && commonPasswords.includes(e.password.toLowerCase()));

    // Calculate Score (0-100)
    let score = 100;
    if (total > 0) {
        const penalties = (weakEntries.length * 10) + (reusedEntries.length * 15) + (breachedEntries.length * 30);
        score = Math.max(0, 100 - penalties);
    } else {
        score = 0;
    }

    return { 
      total, 
      score,
      weak: weakEntries.length, 
      reused: reusedEntries.length,
      breached: breachedEntries.length,
      weakEntries,
      reusedEntries,
      breachedEntries
    };
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
            {(() => {
              const stats = getSecurityStats();
              const scoreColor = stats.score > 80 ? 'var(--success)' : stats.score > 50 ? 'var(--warning)' : 'var(--error)';
              
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '60px' }}>
                    <div style={{ flex: 1 }}>
                      <h2 className="detail-name" style={{ marginBottom: '8px' }}>Security Audit</h2>
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', maxWidth: '400px' }}>
                        Analyze your vault for vulnerabilities, reused credentials, and known breaches.
                      </p>
                    </div>
                  </div>
                  
                  <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '48px' }}>
                    <div className="stat-card" style={{ padding: '24px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px' }}>Breached</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: stats.breached > 0 ? 'var(--error)' : 'var(--text-primary)' }}>{stats.breached}</div>
                    </div>
                    <div className="stat-card" style={{ padding: '24px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px' }}>Reused</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: stats.reused > 0 ? 'var(--error)' : 'var(--text-primary)' }}>{stats.reused}</div>
                    </div>
                    <div className="stat-card" style={{ padding: '24px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px' }}>Weak</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: stats.weak > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{stats.weak}</div>
                    </div>
                  </div>

                  <div className="settings-section-title">Critical Issues</div>
                  <div className="bento-grid" style={{ gridTemplateColumns: '1fr' }}>
                    {/* BREACHED SECTION */}
                    {stats.breached > 0 && (
                      <div className="bento-card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.03)' }}>
                        <div className="bento-card-header">
                          <div className="bento-icon-box" style={{ background: 'var(--error)', borderColor: 'transparent' }}>
                            <AlertCircle size={20} style={{ color: 'white' }} />
                          </div>
                          <div>
                            <div className="bento-card-title" style={{ marginBottom: '2px' }}>Compromised Passwords</div>
                            <div style={{ fontSize: '12px', color: 'var(--error)', fontWeight: 600 }}>Action Required: High Risk</div>
                          </div>
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
                          {stats.breachedEntries.map(e => (
                            <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="brand-orb brand-orb-small" style={{ '--brand-color': getBrandColor(getDomain(e.website, e.name)) } as any}>
                                  {e.customIcon ? <img src={e.customIcon} alt="" /> : <Shield size={14} />}
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>{e.name}</span>
                              </div>
                              <button className="btn btn-ghost" style={{ fontSize: '11px', height: '28px', padding: '0 12px' }} onClick={() => { setActiveTab('vault'); setSelectedEntryId(e.id); }}>Change</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* REUSED SECTION */}
                    {stats.reused > 0 && (
                      <div className="bento-card">
                        <div className="bento-card-header">
                          <div className="bento-icon-box">
                            <Copy size={20} className="accent" />
                          </div>
                          <div>
                            <div className="bento-card-title" style={{ marginBottom: '2px' }}>Reused Passwords</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{stats.reused} accounts share credentials</div>
                          </div>
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
                          {stats.reusedEntries.map(e => (
                            <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="brand-orb brand-orb-small" style={{ '--brand-color': getBrandColor(getDomain(e.website, e.name)) } as any}>
                                  {e.customIcon ? <img src={e.customIcon} alt="" /> : <Shield size={14} />}
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 600 }}>{e.name}</span>
                              </div>
                              <button className="btn btn-ghost" style={{ fontSize: '11px', height: '28px', padding: '0 12px' }} onClick={() => { setActiveTab('vault'); setSelectedEntryId(e.id); }}>Unique Fix</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {stats.total === 0 && (
                      <div className="empty-detail" style={{ background: 'transparent' }}>
                        <p>No password entries to analyze.</p>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </main>
      ) : activeTab === 'settings' ? (
        <main className="column-detail animate-fade-in">
          <div className="security-dashboard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '48px' }}>
              <div>
                <h2 className="detail-name" style={{ marginBottom: '8px' }}>Settings & Data</h2>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Manage your data and vault security policy.</p>
              </div>
              <div className="settings-status-pill">
                <div className="status-indicator-dot"></div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Auto-Lock: 5m Inactivity
                </span>
              </div>
            </div>
            
            <div className="settings-section-title">Official Backups (Encrypted)</div>
            <div className="bento-grid" style={{ marginBottom: '48px' }}>
              <div className="bento-card bento-full-width bento-full-width-row">
                <div style={{ flex: 1 }}>
                  <div className="bento-card-header">
                    <div className="bento-icon-box">
                      <Shield size={20} className="accent" />
                    </div>
                    <span className="copy-zone-label">Security Master File</span>
                  </div>
                  <div className="bento-card-title">Standard .sec Backup</div>
                  <div className="bento-card-description" style={{ marginBottom: 0 }}>
                    The industry standard for Mavault. Includes everything: passwords, secure notes, and recovery codes.
                    It is completely encrypted and only your master passphrase can open this.
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '200px' }}>
                  <input type="file" id="vault-import-input" accept=".sec" style={{ display: 'none' }} onChange={handleImportVault} />
                  <button className="btn btn-primary" onClick={handleExportVault}>
                    <Download size={14} /> Export All
                  </button>
                  <button className="btn btn-ghost" onClick={() => document.getElementById('vault-import-input')?.click()}>
                    <Upload size={14} /> Import All
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-section-title">Portability & Exports (Plaintext)</div>
            <div className="bento-grid" style={{ marginBottom: '48px' }}>
              <div className="bento-card">
                <div className="bento-card-header">
                  <div className="bento-icon-box">
                    <FileLock2 size={20} style={{ color: 'var(--warning)' }} />
                  </div>
                  <span className="copy-zone-label">CSV Format</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="bento-card-title">Passwords Only</div>
                  <div className="bento-card-description">
                    Optimized for moving to Bitwarden, 1Password, or Chrome.
                  </div>
                </div>
                <button className="btn btn-ghost" style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }} onClick={handleExportCSV}>
                  <Download size={14} /> Export .csv
                </button>
              </div>

              <div className="bento-card">
                <div className="bento-card-header">
                  <div className="bento-icon-box">
                    <FileText size={20} style={{ color: 'var(--error)' }} />
                  </div>
                  <span className="copy-zone-label">TXT Format</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="bento-card-title">Full Human Readable</div>
                  <div className="bento-card-description">
                    Includes passwords, notes, and recovery codes in a text file.
                  </div>
                </div>
                <button className="btn btn-ghost" style={{ borderColor: 'var(--error)', color: 'var(--error)' }} onClick={handleExportPlaintext}>
                  <Download size={14} /> Export .txt
                </button>
              </div>
            </div>

            <div className="settings-section-title">Danger Zone</div>
            <div className="bento-card bento-full-width" style={{ border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--error)', marginBottom: '4px' }}>Factory Reset Vault</div>
                  <div className="bento-card-description" style={{ marginBottom: 0 }}>
                    Permanently wipe all data from this local machine.
                  </div>
                </div>
                <button className="btn btn-ghost" style={{ borderColor: 'var(--error)', color: 'var(--error)' }} onClick={handleDeleteAllEntries}>
                  <Trash2 size={14} /> Wipe Everything
                </button>
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
                </button>
                <button className="btn btn-ghost" title="Auto-Tag Everything" onClick={handleAutoTag}>
                  <Tags size={14} />
                </button>
                <button className="btn btn-ghost" title="Smart Import" onClick={() => setShowImportModal(true)}>
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>
            <div className="entry-scroll">
              {(() => {
                console.log(`DEBUG: Rendering entries. Total count: ${entries.length}, Filtered count: ${filteredEntries.length}`);
                if (filteredEntries.length === 0) {
                    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No entries found.</div>;
                }

                if (!isGroupedView || searchTerm) {
                  return filteredEntries.map(entry => {
                    console.log("DEBUG: Rendering entry in list:", entry.name);
                    const domain = getDomain(entry.website, entry.name, customBrands);
                    const iconUrl = getIconUrl(domain);
                    const brandColor = getBrandColor(domain);

                    return (
                      <div 
                        key={entry.id} 
                        className={`entry-list-item ${selectedEntryId === entry.id ? 'active' : ''}`} 
                        onClick={() => setSelectedEntryId(entry.id)}
                      >
                        <div className="brand-orb brand-orb-small" style={{ '--brand-color': brandColor } as any}>
                          {entry.customIcon ? (
                            <img src={entry.customIcon} alt="" />
                          ) : iconUrl ? (
                            <img src={iconUrl} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          ) : (
                            <Shield size={16} />
                          )}
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
                            const domain = getDomain(entry.website, entry.name, customBrands);
                            const iconUrl = getIconUrl(domain);
                            const brandColor = getBrandColor(domain);

                            return (
                              <div 
                                key={entry.id} 
                                className={`entry-list-item ${selectedEntryId === entry.id ? 'active' : ''}`} 
                                onClick={() => setSelectedEntryId(entry.id)}
                              >
                                <div className="brand-orb brand-orb-small" style={{ '--brand-color': brandColor } as any}>
                                  {entry.customIcon ? (
                                    <img src={entry.customIcon} alt="" />
                                  ) : iconUrl ? (
                                    <img src={iconUrl} alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                  ) : (
                                    <Shield size={16} />
                                  )}
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
                        {(() => {
                          const isWeak = selectedEntry.password && selectedEntry.password.length < 8;
                          const isReused = selectedEntry.password && entries.some(e => e.id !== selectedEntry.id && e.type === 'password' && e.password === selectedEntry.password);
                          
                          if (isWeak || isReused) {
                            return (
                              <div style={{ padding: '16px', background: isReused ? 'rgba(239, 68, 68, 0.05)' : 'rgba(234, 179, 8, 0.05)', borderRadius: '12px', border: `1px solid ${isReused ? 'rgba(239, 68, 68, 0.2)' : 'rgba(234, 179, 8, 0.2)'}`, marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <AlertCircle size={20} style={{ color: isReused ? 'var(--error)' : 'var(--warning)', flexShrink: 0 }} />
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: 600, color: isReused ? 'var(--error)' : 'var(--warning)', marginBottom: '4px' }}>
                                    {isReused ? 'Critical Risk: Reused Password' : 'Moderate Risk: Weak Password'}
                                  </div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    {isReused ? 'This password is used across multiple accounts. Click edit to generate a new one.' : 'This password is too short and vulnerable to attacks. Click edit to generate a stronger one.'}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
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
                <input required value={newEntry.name} onChange={e => { const val = e.target.value; setNewEntry(prev => ({...prev, name: val})); }} placeholder="e.g. Google, Netflix..." />
              </div>
              {newEntry.type === 'password' && (
                <>
                  <div className="form-group">
                    <label>Username</label>
                    <input value={newEntry.username} onChange={e => { const val = e.target.value; setNewEntry(prev => ({...prev, username: val})); }} />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input type={showPassword ? "text" : "password"} style={{ flex: 1 }} value={newEntry.password} onChange={e => { const val = e.target.value; setNewEntry(prev => ({...prev, password: val})); }} />
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
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input value={newEntry.website} onChange={e => { const val = e.target.value; setNewEntry(prev => ({...prev, website: val})); }} placeholder="https://..." />
                      <button type="button" className="btn btn-ghost" onClick={runAutoDetect} title="Auto-Detect">
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>
                </>
              )}
              {(newEntry.type === 'note' || newEntry.type === 'recovery') && (
                <div className="form-group">
                  <label>{newEntry.type === 'note' ? 'Content' : 'Recovery Codes'}</label>
                  <textarea rows={6} value={newEntry.notes} onChange={e => { const val = e.target.value; setNewEntry(prev => ({...prev, notes: val})); }} placeholder="Enter secure info..." />
                </div>
              )}
              <div className="form-group">
                <label>Tags (comma separated)</label>
                <input value={newEntry.tagsString} onChange={e => { const val = e.target.value; setNewEntry(prev => ({...prev, tagsString: val})); }} placeholder="Work, Social..." />
              </div>

              <div className="custom-brand-section">
                <label>Custom Brand & Icon</label>
                <div className="avatar-preview">
                  <div className="brand-orb" style={{ '--brand-color': getBrandColor(customBrandInput.domain || getDomain(newEntry.website, newEntry.name)) } as any}>
                    {(() => {
                      const domain = customBrandInput.domain || getDomain(newEntry.website, newEntry.name);
                      const iconUrl = getIconUrl(domain);
                      const brandColor = getBrandColor(domain);
                      return newEntry.customIcon ? (
                        <img src={newEntry.customIcon} alt="" />
                      ) : iconUrl ? (
                        <img src={iconUrl} alt="" onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement!.innerHTML = `<img src="${getLetterAvatar(customBrandInput.name || newEntry.name || '?', brandColor)}" alt="" />`;
                        }} />
                      ) : (
                        <img src={getLetterAvatar(customBrandInput.name || newEntry.name || '?', brandColor)} alt="" />
                      );
                    })()}
                  </div>
                  <div className="avatar-preview-text">
                    <h4>{customBrandInput.name || newEntry.name || 'Brand Preview'}</h4>
                    <p>{customBrandInput.domain || getDomain(newEntry.website, newEntry.name) || 'No domain detected'}</p>
                  </div>
                  <label className="avatar-upload-btn">
                    <Upload size={14} /> Upload
                    <input type="file" accept="image/*" onChange={handleCustomIconUpload} style={{ display: 'none' }} />
                  </label>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowIconPicker(!showIconPicker)}>
                    {showIconPicker ? 'Hide' : 'Pick'}
                  </button>
                </div>

                {showIconPicker && (
                  <div className="icon-picker-container animate-fade-in">
                    <div className="icon-picker-search">
                      <Search size={14} className="search-icon" />
                      <input 
                        placeholder="Search popular brands..." 
                        value={iconSearchTerm} 
                        onChange={e => setIconSearchTerm(e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    <div className="icon-grid">
                      {filteredIcons.map(brand => (
                        <div 
                          key={brand.domain} 
                          className={`icon-item ${customBrandInput.domain === brand.domain ? 'active' : ''}`}
                          onClick={() => setCustomBrandInput({ name: brand.name, domain: brand.domain })}
                        >
                          <img src={getIconUrl(brand.domain)!} alt={brand.name} />
                          <span>{brand.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="custom-brand-grid" style={{ marginTop: '16px' }}>
                  <input placeholder="Override Name" value={customBrandInput.name} onChange={e => setCustomBrandInput({...customBrandInput, name: e.target.value})} />
                  <input placeholder="Override Domain" value={customBrandInput.domain} onChange={e => setCustomBrandInput({...customBrandInput, domain: e.target.value})} />
                </div>
              </div>
            </form>

            <div style={{ 
              marginTop: '24px', 
              paddingTop: '20px', 
              borderTop: '1px solid var(--glass-border)', 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '12px' 
            }}>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => { setShowAddModal(false); setEditingEntry(null); }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSaveEntry}
                style={{ cursor: 'pointer', zIndex: 9999, pointerEvents: 'auto' }}
              >
                Save Entry
              </button>
            </div>
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
