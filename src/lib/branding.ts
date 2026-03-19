import { CustomBrand } from '../types';

/**
 * Mavault Branding Engine
 * Heuristically derives icons and brand colors from domains.
 */

// 1. High Priority Platforms (Always win if mentioned)
export const PLATFORM_MAP: Record<string, string> = {
  'github': 'github.com',
  'replit': 'replit.com',
  'instagram': 'instagram.com',
  'firebase': 'firebase.google.com',
  'google': 'google.com',
  'gsuite': 'google.com',
  'gmail': 'gmail.com',
  'facebook': 'facebook.com',
  'twitter': 'twitter.com',
  'x.com': 'x.com',
  'linkedin': 'linkedin.com',
  'apple': 'apple.com',
  'microsoft': 'microsoft.com',
  'outlook': 'microsoft.com',
  'icloud': 'apple.com',
  'wordpress': 'wordpress.com',
  'amazon': 'amazon.com',
  'reddit': 'reddit.com',
  'netflix': 'netflix.com',
  'spotify': 'spotify.com',
  'youtube': 'youtube.com',
  'discord': 'discord.com',
  'slack': 'slack.com'
};

// 2. Organization & Service Mappings
export const SERVICE_MAP: Record<string, string> = {
  // Education & Gov
  'plymouth': 'www.plymouth.ac.uk',
  'lancaster': 'www.lancaster.ac.uk',
  'bailrigg': 'www.lancaster.ac.uk',
  'student finance': 'www.gov.uk',
  'companies house': 'www.gov.uk',
  'turnitin': 'www.turnitin.com',
  
  // Finance & Business
  'starling': 'www.starlingbank.com',
  'payoneer': 'www.payoneer.com',
  'stripe': 'www.stripe.com',
  'paypal': 'www.paypal.com',
  'wise': 'wise.com',
  'revolut': 'revolut.com',
  'monzo': 'monzo.com',
  'coinbase': 'coinbase.com',
  'binance': 'binance.com',
  'interactive brokers': 'www.interactivebrokers.com',
  'upwork': 'www.upwork.com',
  'ein presswire': 'www.einpresswire.com',
  'bonline': 'www.bonline.com',
  'tesco': 'www.tesco.com',
  '1688': 'www.alibaba.com',
  'alibaba': 'www.alibaba.com',
  'shopify': 'shopify.com',
  'ebay': 'ebay.com',
  'etsy': 'etsy.com',
  
  // Tech & Infrastructure
  'aws': 'aws.amazon.com',
  'azure': 'azure.microsoft.com',
  'cloudflare': 'cloudflare.com',
  'supabase': 'supabase.com',
  'clerk': 'clerk.com',
  'emailjs': 'emailjs.com',
  'cursor': 'cursor.com',
  'vercel': 'vercel.com',
  'netlify': 'netlify.com',
  'digitalocean': 'digitalocean.com',
  'heroku': 'heroku.com',
  'openai': 'openai.com',
  'chatgpt': 'openai.com',
  'claude': 'anthropic.com',
  'perplexity': 'perplexity.ai',
  'godaddy': 'www.godaddy.com',
  'bluehost': 'www.bluehost.com',
  'mongodb': 'mongodb.com',
  'planetscale': 'planetscale.com',
  'railway': 'railway.app',
  
  // Social & Entertainment
  'tiktok': 'www.tiktok.com',
  'snapchat': 'www.snapchat.com',
  'pinterest': 'www.pinterest.com',
  'twitch': 'www.twitch.tv',
  'steam': 'steampowered.com',
  'epic games': 'epicgames.com',
  'roblox': 'www.roblox.com',
  'whatsapp': 'whatsapp.com',
  'telegram': 'telegram.org',
  'signal': 'signal.org',
  'zoom': 'zoom.us',
  'disney+': 'disneyplus.com',
  'hulu': 'hulu.com',
  'hbo': 'max.com',
  'peacock': 'peacocktv.com',
  
  // Productivity
  'notion': 'notion.so',
  'trello': 'trello.com',
  'asana': 'asana.com',
  'monday': 'monday.com',
  'clickup': 'clickup.com',
  'linear': 'linear.app',
  'jira': 'atlassian.com',
  'figma': 'figma.com',
  'canva': 'canva.com',
  'miro': 'miro.com',
  'adobe': 'adobe.com'
};

export const POPULAR_BRANDS = [
  ...Object.entries(PLATFORM_MAP).map(([name, domain]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), domain })),
  ...Object.entries(SERVICE_MAP).map(([name, domain]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), domain }))
].reduce((acc, current) => {
  const x = acc.find(item => item.domain === current.domain);
  if (!x) return acc.concat([current]);
  else return acc;
}, [] as { name: string, domain: string }[]).sort((a, b) => a.name.localeCompare(b.name));

export function getHeuristicBrand(name: string, domain: string | undefined): { name: string, domain: string } | null {
  const cleanName = name.toLowerCase();
  
  for (const [key, dom] of Object.entries(PLATFORM_MAP)) {
    if (cleanName.includes(key)) return { name: key.charAt(0).toUpperCase() + key.slice(1), domain: dom };
  }

  for (const [key, dom] of Object.entries(SERVICE_MAP)) {
    if (cleanName.includes(key) || (domain && domain.includes(dom))) return { name: key.charAt(0).toUpperCase() + key.slice(1), domain: dom };
  }

  return null;
}

const OAUTH_KEYWORDS = [
  '(google)', '(google login)', '(google oauth)', '(gmail)',
  '(microsoft)', '(msft)', '(outlook)', '(apple)',
  '(facebook)', '(fb)', '(github)', '(wordpress)'
];

export function getDomain(url: string | undefined, name?: string, customBrands?: CustomBrand[]): string | null {
  const cleanName = name ? name.toLowerCase().trim() : '';
  
  if (customBrands) {
    const custom = customBrands.find(b => cleanName.includes(b.name.toLowerCase()));
    if (custom) return custom.domain;
  }

  for (const [key, domain] of Object.entries(PLATFORM_MAP)) {
    if (cleanName.includes(key)) return domain;
  }

  if (url && url.trim() !== '') {
    try {
      const domain = url.includes('://') ? new URL(url).hostname : url.split('/')[0];
      return domain.replace('www.', '').toLowerCase();
    } catch {
      // Fall through
    }
  }

  if (!cleanName) return null;

  let processedName = cleanName;
  for (const kw of OAUTH_KEYWORDS) {
    processedName = processedName.replace(kw, '').trim();
  }

  const sortedServiceKeys = Object.keys(SERVICE_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedServiceKeys) {
    if (processedName.includes(key)) return SERVICE_MAP[key];
  }

  if (processedName.includes('.') && !processedName.includes(' ')) return processedName;

  return null;
}

export function getIconUrl(domain: string | null): string | null {
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

export function getLetterAvatar(name: string, color: string): string {
  const firstLetter = (name[0] || '?').toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${color}" />
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="50" fill="rgba(255,255,255,0.9)">${firstLetter}</text>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

const BRAND_COLORS: Record<string, string> = {
  'google.com': '#4285F4',
  'github.com': '#ffffff',
  'netflix.com': '#E50914',
  'amazon.com': '#FF9900',
  'facebook.com': '#1877F2',
  'twitter.com': '#1DA1F2',
  'x.com': '#ffffff',
  'linkedin.com': '#0A66C2',
  'apple.com': '#ffffff',
  'microsoft.com': '#00A4EF',
  'adobe.com': '#FF0000',
  'spotify.com': '#1ED760',
  'discord.com': '#5865F2',
  'figma.com': '#F24E1E',
  'notion.so': '#ffffff',
  'slack.com': '#4A154B',
  'zoom.us': '#2D8CFF',
  'reddit.com': '#FF4500',
  'twitch.tv': '#9146FF',
  'paypal.com': '#003087',
  'stripe.com': '#635BFF',
  'digitalocean.com': '#0080FF',
  'heroku.com': '#430098',
  'vercel.com': '#ffffff',
  'openai.com': '#10a37f',
  'gmail.com': '#EA4335',
  'instagram.com': '#E4405F',
  'snapchat.com': '#FFFC00',
  'pinterest.com': '#BD081C',
  'youtube.com': '#FF0000',
  'proton.me': '#6D4AFF',
  'tiktok.com': '#000000',
  'aws.amazon.com': '#FF9900',
  'supabase.com': '#3ECF8E',
  'clerk.com': '#6C47FF',
  'starlingbank.com': '#25D366',
  'thetrainline.com': '#00A859',
  'puregym.com': '#E4FF00',
  'gov.uk': '#005EA5',
  'www.plymouth.ac.uk': '#000000',
  'www.lancaster.ac.uk': '#B5121B',
  'www.alibaba.com': '#FF6600',
  'firebase.google.com': '#FFCA28',
  'replit.com': '#F26207',
  'wordpress.com': '#21759b'
};

export function getBrandColor(domain: string | null): string {
  if (!domain) return '#3b82f6';
  const cleanDomain = domain.toLowerCase();
  if (BRAND_COLORS[cleanDomain]) return BRAND_COLORS[cleanDomain];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 60%, 65%)`;
}
