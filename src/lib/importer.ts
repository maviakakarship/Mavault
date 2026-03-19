import { VaultEntry } from '../types';

/**
 * Reads a File object as text.
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Heuristically parses plaintext into partial VaultEntry objects.
 */
export function parseSmartPlaintext(text: string): (Partial<VaultEntry> & { id: string })[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map(l => l.trim());
  const parsed: (Partial<VaultEntry> & { id: string })[] = [];
  
  const urlRegex = /https?:\/\/[^\s]+/;
  const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
  const indicatorKeywords = ['GOOGLE', 'GITHUB', 'SSO', 'OAUTH', 'APPLE', 'MICROSOFT', 'FACEBOOK', 'PAYPAL', 'STRIPE'];

  lines.forEach((line) => {
    // 1. Skip obvious noise
    if (!line || line.match(/^[-\s=_*]{3,}$/) || line.toLowerCase().includes('login information')) {
      return;
    }

    // 2. Advanced Segment Splitting
    const rawParts = line.split(/\s*---\s*|\s*\|\s*|\s*:\s*|\s+-\s+/).map(p => p.trim()).filter(p => p.length > 0);
    if (rawParts.length === 0) return;

    const entry: Partial<VaultEntry> & { id: string } = {
      id: crypto.randomUUID(),
      type: 'password',
      name: '',
      username: '',
      password: '',
      website: '',
      notes: '',
      tags: []
    };

    const usedIndices = new Set<number>();
    let loginMethod = '';
    let emailIndex = -1;

    // Pass 0: Pre-Classification of Indicators (OAuth etc)
    rawParts.forEach((part, i) => {
      const upper = part.toUpperCase();
      if (indicatorKeywords.includes(upper)) {
        loginMethod = upper;
        usedIndices.add(i);
      }
    });

    // Smart Categories Heuristic
    const knownCategories = ['driftaline', 'immigro', 'interviewamigo', 'mavia', 'safoora', 'shakeel', 'personal', 'work', 'finance'];
    const lowerLine = line.toLowerCase();
    for (const cat of knownCategories) {
      if (lowerLine.includes(cat)) {
        entry.tags = [cat.charAt(0).toUpperCase() + cat.slice(1)];
        break;
      }
    }

    // Pass 1: Highly reliable patterns (Email, URL)
    rawParts.forEach((part, i) => {
      if (usedIndices.has(i)) return;
      if (urlRegex.test(part)) {
        entry.website = part.match(urlRegex)![0];
        usedIndices.add(i);
      } else if (emailRegex.test(part) && !entry.username) {
        entry.username = part;
        emailIndex = i;
        usedIndices.add(i);
      }
    });

    // Pass 2: Identification of Student/Uni ID
    const isAcademic = entry.username?.toLowerCase().endsWith('.ac.uk') || entry.username?.toLowerCase().includes('student');
    if (isAcademic) {
        rawParts.forEach((part, i) => {
            if (usedIndices.has(i)) return;
            if (part.match(/^\d+$/) && part.length > 5) {
                entry.notes = (entry.notes ? entry.notes + '\n' : '') + `Student ID: ${part}`;
                usedIndices.add(i);
            }
        });
    }

    // Pass 3: Classification of Name (Always first unassigned part if possible)
    rawParts.forEach((part, i) => {
        if (usedIndices.has(i)) return;
        if (!entry.name) {
            entry.name = part;
            usedIndices.add(i);
        }
    });

    // Pass 4: Contextual/Positional Logic
    // If we have an emailIndex, the part immediately AFTER it is very likely the password
    if (emailIndex !== -1 && emailIndex + 1 < rawParts.length) {
        const nextPart = rawParts[emailIndex + 1];
        if (!usedIndices.has(emailIndex + 1) && nextPart.length > 0) {
            entry.password = nextPart;
            usedIndices.add(emailIndex + 1);
        }
    }

    // Final Pass: Remaining parts (Classification by complexity/entropy)
    rawParts.forEach((part, i) => {
      if (usedIndices.has(i)) return;

      const hasNumbers = /\d/.test(part);
      const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(part);
      const hasUpper = /[A-Z]/.test(part);
      const hasLower = /[a-z]/.test(part);
      
      // Better password heuristic: mix of char types OR high length with some numbers
      const isLikelyPassword = (hasNumbers && (hasSpecial || hasUpper || hasLower) && part.length > 4) || 
                               (part.length > 10 && (hasNumbers || hasSpecial));

      if (!entry.password && isLikelyPassword) {
        entry.password = part;
        usedIndices.add(i);
      } else if (!entry.username && !isLikelyPassword && part.length < 32) {
        entry.username = part;
        usedIndices.add(i);
      } else {
        entry.notes = (entry.notes ? entry.notes + '\n' : '') + part;
        usedIndices.add(i);
      }
    });

    // Cleanup and naming
    if (loginMethod) {
        entry.name = entry.name ? `${entry.name} (${loginMethod})` : loginMethod;
    }
    
    if (!entry.name && entry.username) entry.name = entry.username;
    if (!entry.name && entry.website) {
        try { entry.name = new URL(entry.website).hostname; } catch(e) { entry.name = entry.website; }
    }
    if (!entry.name) entry.name = 'Imported Entry';
    if (entry.notes) entry.notes = entry.notes.trim();

    parsed.push(entry);
  });

  return parsed;
}
