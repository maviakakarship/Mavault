# Personal Security Vault — V1 Specification

## 1. Overview

This project is a personal security application designed for private use only.

The purpose of the application is to replace insecure storage methods such as plaintext notes with a local encrypted vault that stores passwords, secure notes, recovery codes, and account security information.

The application is not intended to compete with commercial password managers.
It is designed to be simple, local-first, and secure, with minimal attack surface.

V1 focuses on:

* Local encrypted vault
* Manual vault transfer between devices
* Desktop usage (Windows + macOS)
* No cloud sync
* No browser integration
* No passkey support
* No autofill
* No Google Authenticator integration

The goal of V1 is to provide a safer system than storing passwords in plaintext files, without introducing unnecessary complexity.Then in V2 we can decide if we want to add these things.

---

## 2. Goals

The application must:

* Securely store passwords
* Securely store notes
* Securely store recovery codes
* Provide account inventory tracking
* Provide security health overview
* Encrypt all data at rest
* Require master passphrase unlock
* Support manual vault transfer between devices
* Run on Windows and macOS

The application must NOT:

* Store secrets in plaintext
* Log secrets
* Sync automatically
* Upload data silently
* Require an account
* Depend on a server
* Depend on a cloud service
* Allow access without unlock
* Allow screenshots of vault contents where possible

---

## 3. Platform Support

V1 supports:

* Windows desktop
* macOS desktop

The same vault file format must work on both platforms.

The vault file can be copied manually between devices.

No automatic sync is included in V1.

---

## 4. Architecture

### 4.1 Local-first design

All data is stored locally.

There is no server.

There is no account system.

There is no backend.

All secrets exist only inside the encrypted vault file.

---

### 4.2 Vault file

All data is stored inside a single encrypted vault file.

Example filename:

myvault.sec

The vault file contains:

* passwords
* notes
* recovery codes
* security metadata
* settings

The vault file must never contain plaintext secrets.

---

### 4.3 Manual transfer model

Users may copy the vault file manually between devices.

Rules:

* Only one copy should be edited at a time
* App should show last modified time
* App should create backup before save
* App should warn if vault is old

No automatic merge is required.

---

## 5. Security Model

### 5.1 Threats considered

The app should protect against:

* casual access to device
* stolen device
* cloud breach (if vault file stored in cloud manually)
* accidental file exposure
* user mistakes
* plaintext leaks
* clipboard leaks
* screenshot leaks

The app does not guarantee protection against:

* advanced malware
* compromised OS
* hardware attacks
* keyloggers
* unlocked device access

---

### 5.2 Encryption

All vault data must be encrypted.

Encryption must be applied before writing to disk.

Secrets must not exist in plaintext on disk.

Secrets should exist in memory only when needed.

Memory should be cleared when possible.

---

### 5.3 Master passphrase

The vault is protected by a master passphrase.

Rules:

* Required on first unlock
* Required after app restart
* Required after vault change
* Required after long inactivity

Optional:

* OS biometrics after first unlock

Biometrics must never replace the master passphrase as root unlock.

---

### 5.4 Recovery key

During vault creation, generate a recovery key.

The recovery key allows vault access if the passphrase is lost.

Rules:

* Show only once
* User must save manually
* App must warn user to store safely
* Recovery key not stored in plaintext

If both passphrase and recovery key are lost, vault cannot be recovered.

---

### 5.5 Logging rules

The app must never log:

* passwords
* notes
* recovery codes
* decrypted data
* encryption keys

Logs may include:

* errors
* timestamps
* UI events
* non-sensitive metadata

---

### 5.6 Clipboard protection

When copying secrets:

* clipboard must auto clear after timeout
* timeout default: 15 seconds
* user may change timeout

Clipboard must never store secrets permanently.

---

### 5.7 Screenshot protection

Where supported:

* block screenshots in vault view
* block screen recording if possible

If not supported, show warning.

---

### 5.8 Auto lock

Vault must lock when:

* app closed
* system sleep
* inactivity timeout
* manual lock
* app background (mobile later)

---

### 5.9 Backup

Before saving changes:

Create backup:

myvault.backup.timestamp.sec

Backup files must remain encrypted.

No automatic cloud backup.

---

## 6. Data Types

### 6.1 Password entry

Fields:

* account name
* username
* password
* website
* notes
* tags
* last updated

---

### 6.2 Secure note

Fields:

* title
* content
* tags
* last updated

Text only.

No attachments in V1.

---

### 6.3 Recovery entry

Fields:

* account name
* recovery codes
* seed phrases
* emergency info
* notes

---

### 6.4 Account metadata

Fields:

* has password
* has 2FA
* has recovery codes
* important flag
* last changed

Used for security dashboard.

---

## 7. Features

### 7.1 Vault

* list entries
* search
* filter
* add
* edit
* delete
* copy password
* generate password

---

### 7.2 Notes

* list
* add
* edit
* delete

---

### 7.3 Recovery

* list
* add
* edit
* delete

---

### 7.4 Security dashboard

Show:

* weak passwords
* reused passwords
* missing 2FA
* missing recovery codes
* old passwords
* total accounts

---

### 7.5 Account inventory

Track all accounts.

Allow marking:

* important
* has 2FA
* has backup codes

---

### 7.6 Export / import

Allow:

* encrypted export
* manual import
* plaintext import tool (for migration only)

Warn before export.

---

## 8. UI Structure

Tabs:

* Vault
* Notes
* Recovery
* Security
* Settings

---

## 9. Settings

Options:

* change passphrase
* change timeout
* clipboard timeout
* backup folder
* vault location
* lock timeout

---

## 10. Not included in V1

Not allowed:

* autofill
* browser extension
* passkeys
* Google Auth import
* TOTP codes
* cloud sync
* account login
* server
* web version
* file attachments
* sharing

---

## 11. Future versions (not V1)

Possible later:

* sync
* mobile app
* TOTP support
* autofill
* passkeys
* cloud backup
* encrypted sync

Not part of V1.

---

## 12. Definition of V1 complete

V1 is complete when:

* vault can be created
* vault encrypted
* passwords stored
* notes stored
* recovery stored
* master unlock works
* backup works
* vault opens on Windows
* vault opens on macOS
* manual transfer works
* no secrets leak

Then V1 is done.
