export const environment = {
  production: false,
  apiUrl: (window as any)['env']?.['apiUrl'] || 'http://localhost/api',
  aiUrl: (window as any)['env']?.['aiUrl'] || 'http://localhost/ai',
  wsUrl: (window as any)['env']?.['wsUrl'] || 'ws://localhost/ws'
};