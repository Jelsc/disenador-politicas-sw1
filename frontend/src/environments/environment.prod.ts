export const environment = {
  production: true,
  apiUrl: (window as any)['env']?.['apiUrl'] || 'https://api-primerpacialsw.duckdns.org/api',
  aiUrl: (window as any)['env']?.['aiUrl'] || 'https://api-primerpacialsw.duckdns.org/ai',
  wsUrl: (window as any)['env']?.['wsUrl'] || 'wss://api-primerpacialsw.duckdns.org/ws'
};