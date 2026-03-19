/**
 * Mavault Branding Engine
 * Heuristically derives icons and brand colors from domains.
 */

// 1. High Priority Platforms (Always win if mentioned)
const PLATFORM_MAP: Record<string, string> = {
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
  'wordpress': 'wordpress.com'
};

// 2. Organization & Service Mappings
const SERVICE_MAP: Record<string, string> = {
  // Education & Gov (Added www. for better icon reliability)
  'plymouth': 'www.plymouth.ac.uk',
  'capitol': 'www.plymouth.ac.uk',
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
  'interactive brokers': 'www.interactivebrokers.com',
  'upwork': 'www.upwork.com',
  'ein presswire': 'www.einpresswire.com',
  'bonline': 'www.bonline.com',
  'tesco': 'www.tesco.com',
  '1688': 'www.alibaba.com', // 1688 mapping to Alibaba
  'alibaba': 'www.alibaba.com',
  
  // Tech & Infrastructure
  'aws': 'aws.amazon.com',
  'supabase': 'supabase.com',
  'clerk': 'clerk.com',
  'emailjs': 'emailjs.com',
  'cursor': 'cursor.com',
  'vercel': 'vercel.com',
  'digitalocean': 'digitalocean.com',
  'heroku': 'heroku.com',
  'openai': 'openai.com',
  'chatgpt': 'openai.com',
  'claude': 'anthropic.com',
  'godaddy': 'www.godaddy.com',
  'bluehost': 'www.bluehost.com',
  'qt': 'www.qt.io',
  'anki': 'ankiweb.net',
  
  // CMS & Tools
  'webtoffee': 'wordpress.com', // Map to WordPress as requested
  'wbtofee': 'wordpress.com',
  'interview amigo': 'interviewamigo.com',
  'wpmudev': 'wordpress.com',
  'elementor': 'elementor.com',
  'flutterflow': 'flutterflow.io',
  'woocommerce': 'woocommerce.com',
  'iubenda': 'iubenda.com',
  'certum': 'www.certum.pl',
  
  // Social & Entertainment
  'tiktok': 'www.tiktok.com',
  'snapchat': 'www.snapchat.com',
  'pinterest': 'www.pinterest.com',
  'youtube': 'www.youtube.com',
  'netflix': 'www.netflix.com',
  'spotify': 'www.spotify.com',
  'discord': 'www.discord.com',
  'twitch': 'www.twitch.tv',
  'steam': 'steampowered.com',
  'epic games': 'epicgames.com',
  'ea': 'www.ea.com',
  'roblox': 'www.roblox.com',
  
  // Health & Travel
  'puregym': 'www.puregym.com',
  'the gym group': 'www.thegymgroup.com',
  'trainline': 'www.thetrainline.com',
  'surfshark': 'www.surfshark.com',
  'lta tennis': 'www.lta.org.uk'
};

const OAUTH_KEYWORDS = [
  '(google)', '(google login)', '(google oauth)', '(gmail)',
  '(microsoft)', '(msft)', '(outlook)', '(apple)',
  '(facebook)', '(fb)', '(github)', '(wordpress)'
];

export function getDomain(url: string | undefined, name?: string): string | null {
  // Normalize input
  const cleanName = name ? name.toLowerCase().trim() : '';
  
  // CRITICAL: If the NAME contains a high-priority platform (GitHub, Instagram), 
  // it MUST win, even if there's a URL. This fixes "GitHub Plymouth".
  for (const [key, domain] of Object.entries(PLATFORM_MAP)) {
    if (cleanName.includes(key)) return domain;
  }

  // 2. If no platform match in name, use the URL if it exists
  if (url && url.trim() !== '') {
    try {
      const domain = url.includes('://') ? new URL(url).hostname : url.split('/')[0];
      return domain.replace('www.', '').toLowerCase();
    } catch {
      // Fall through
    }
  }

  if (!cleanName) return null;

  // 3. Clean OAuth noise
  let processedName = cleanName;
  for (const kw of OAUTH_KEYWORDS) {
    processedName = processedName.replace(kw, '').trim();
  }

  // 4. Match against Organization & Service Map
  const sortedServiceKeys = Object.keys(SERVICE_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedServiceKeys) {
    if (processedName.includes(key)) return SERVICE_MAP[key];
  }

  // 5. Domain-like strings fallback
  if (processedName.includes('.') && !processedName.includes(' ')) return processedName;

  return null;
}

export function getIconUrl(domain: string | null): string | null {
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
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
