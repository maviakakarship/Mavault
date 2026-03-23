# Mavault

A high-security, hyper-local password manager built with React, Vite, and Electron. Designed for users who demand absolute control over their data without relying on cloud servers or third-party databases.

## 🛡️ Core Security Architecture

Mavault was built with a "Zero-Trust Local" philosophy. Your data is protected by multiple layers of active and passive security measures:

1. **Zero Cloud Exposure:** Your vault is never uploaded to the internet. There is no central database for hackers to breach. Your data lives exclusively in an encrypted `mavault_core.sec` file on your local hard drive.
2. **Military-Grade Encryption:** The `.sec` file is encrypted using AES-GCM (via the Web Crypto API). If malware or a bad actor copies this file from your machine, it is mathematically impossible for them to read it without your exact Master Passphrase.
3. **Hardware OS Hooking:** Mavault actively monitors your operating system. If you close your laptop lid, put your PC to sleep, or manually lock your screen (`Win + L` / `Cmd + Ctrl + Q`), Mavault intercepts the OS event and instantly locks the vault.
4. **Inactivity Auto-Lock:** Mavault monitors mouse and keyboard activity. After 5 minutes of total inactivity, it forcefully purges decryption keys from memory and returns to the lock screen.
5. **Anti-Screenshot Protection:** Mavault utilizes native OS flags to block background applications from recording or screenshotting the vault window, preventing malicious data scraping.

## 🔄 How to Change Your Master Passphrase

Since Mavault does not use cloud servers, there is no "Forgot Password" email link. However, you can securely migrate your data to a new passphrase using the built-in export tools:

1. **Unlock your vault** using your current Master Passphrase.
2. Navigate to the **Settings & Data** tab.
3. Under *Official Backups (Encrypted)*, click **Export All** to save your `mavault_backup.sec` file to your desktop.
4. Restart or completely lock Mavault. On the lock screen, click **Reset Vault (Delete All Data)**. *Note: This completely wipes the local app state and permanently deletes your old `mavault_core.sec` file. Your exported backup is completely safe.*
5. Mavault will now prompt you to create a new vault. Enter your **new** Master Passphrase and securely save your new Recovery Key.
6. Once inside your new, empty vault, go back to **Settings & Data** and click **Import All**. 
7. Select the `mavault_backup.sec` file you exported in Step 3. The app will detect that the file uses your old password and will prompt you to enter it once to decrypt the backup.
8. Your entire vault will instantly merge into your new setup, now secured by your new Master Passphrase!

## 🚀 Building & Running Locally

### Development
```bash
npm install
npm run electron:dev
```

### Building the Windows App (.exe)
```bash
npm run build:win
```
This will generate a portable `mavault-win32-x64` folder inside the `dist` directory. You can move this folder anywhere and run `mavault.exe`.

### Building the Mac App (.dmg)
*(Must be run on a macOS machine)*
```bash
npm run build:mac
```

## ✈️ Cross-Platform Migration

Mavault makes it easy to move your vault between Windows, macOS, and Linux without ever touching the cloud.

### Method 1: Manual File Move (Fastest)
1. Locate your encrypted vault file (`mavault_core.sec`) on your current machine.
   - **Windows**: `C:\Users\<YourUser>\Documents\mavault_core.sec`
   - **macOS/Linux**: `~/Documents/mavault_core.sec`
2. Copy this file to a USB drive or secure transfer method.
3. Paste the file into the **Documents** folder on your new machine.
4. Launch Mavault on the new machine and enter your **original Master Passphrase**.

### Method 2: Secure Export/Import
1. On your current machine, go to **Settings & Data** > **Export All**.
2. Save the `mavault_backup.sec` file.
3. On your new machine, launch a fresh instance of Mavault and create a temporary vault.
4. Go to **Settings & Data** > **Import All** and select your backup file.
5. Enter your **original Master Passphrase** when prompted to decrypt and merge the data.

### 🍎 Important for macOS Users
Since Mavault is a high-security, local-only tool, it is distributed as an **unsigned** application. macOS Gatekeeper will block it by default.
1. Drag Mavault from the `.dmg` to your **Applications** folder.
2. **Right-click** the Mavault app and select **Open**.
3. A security popup will appear. Click **Open** again to authorize the app.
