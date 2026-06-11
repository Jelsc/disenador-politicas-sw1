export const environment = {
  production: true,
  apiUrl: (window as any)['env']?.['apiUrl'] || '/api',
  aiUrl: (window as any)['env']?.['aiUrl'] || '/ai',
  wsUrl: (window as any)['env']?.['wsUrl'] || `ws://${window.location?.host || 'localhost'}/ws`
};