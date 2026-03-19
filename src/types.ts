export interface VaultEntry {
  id: string;
  name: string;
  username: string;
  password?: string;
  website?: string;
  notes?: string;
  tags?: string[];
  type: 'password' | 'note' | 'recovery';
  lastUpdated: string;
}

export interface VaultData {
  entries: VaultEntry[];
  settings: {
    clipboardTimeout: number;
    autoLockTimeout: number;
  };
}
