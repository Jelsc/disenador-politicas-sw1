export const environment = {
  production: false,
  apiUrl: (window as any)['env']?.['apiUrl'] || 'http://localhost:8080/api',
  aiUrl: (window as any)['env']?.['aiUrl'] || 'http://localhost:8000',
  wsUrl: (window as any)['env']?.['wsUrl'] || 'ws://localhost:8080/ws'
};