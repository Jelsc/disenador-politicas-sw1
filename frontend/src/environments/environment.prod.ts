export const environment = {
  production: true,
  apiUrl: (window as any)['env']?.['apiUrl'] || 'https://api.midominio.com/api',
  aiUrl: (window as any)['env']?.['aiUrl'] || 'https://api.midominio.com/ai',
  wsUrl: (window as any)['env']?.['wsUrl'] || 'wss://api.midominio.com/ws'
};