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
  customIcon?: string; // Base64 encoded image
}

export interface CustomBrand {
  id: string;
  name: string;
  domain: string;
}

export interface VaultData {
  entries: VaultEntry[];
  customBrands: CustomBrand[];
  settings: {
    clipboardTimeout: number;
    autoLockTimeout: number;
  };
}
