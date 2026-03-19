# Known Issues & Broken Features

## Vault Entry Persistence
- **Custom Icon Persistence**: `customIcon` (Base64) is correctly set in `App.tsx` state (`entryIcon`) and captured in `handleSaveEntry`, but fails to persist in the `.sec` file after saving.
- **Root Cause Analysis**: IPC bridge and `saveVault` serialization appear correct. The issue is likely a silent failure during encryption/decryption or the `VaultEntry` object being dropped during the vault write process.

## Status
- [ ] Investigate encryption layer (`src/lib/crypto.ts`) for potential serialization issues.
- [ ] Review `VaultData` interface and usage in `handleUnlock`.
