/**
 * Mavault Password Generator
 * Uses cryptographically secure random values.
 */

export interface PasswordOptions {
  length: number;
  useUppercase: boolean;
  useLowercase: boolean;
  useNumbers: boolean;
  useSymbols: boolean;
}

const CHARSETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

export function generatePassword(options: PasswordOptions): string {
  let charset = '';
  if (options.useUppercase) charset += CHARSETS.uppercase;
  if (options.useLowercase) charset += CHARSETS.lowercase;
  if (options.useNumbers) charset += CHARSETS.numbers;
  if (options.useSymbols) charset += CHARSETS.symbols;

  if (charset === '') return '';

  const array = new Uint32Array(options.length);
  crypto.getRandomValues(array);

  let password = '';
  for (let i = 0; i < options.length; i++) {
    password += charset[array[i] % charset.length];
  }

  return password;
}
