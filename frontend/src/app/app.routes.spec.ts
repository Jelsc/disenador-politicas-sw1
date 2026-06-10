import { routes } from './app.routes';

describe('app routes', () => {
  it('registers policy and procedure repository routes', () => {
    const dashboardRoute = routes.find(route => Array.isArray(route.children));
    const policyRepositoryRoute = dashboardRoute?.children?.find(route => route.path === 'policies/:id/documents');
    const procedureRepositoryRoute = dashboardRoute?.children?.find(route => route.path === 'tramites/:id/documents');

    expect(policyRepositoryRoute?.data?.['repositoryScope']).toBe('policy');
    expect(procedureRepositoryRoute?.data?.['repositoryScope']).toBe('procedure');
    expect(procedureRepositoryRoute?.data?.['mode']).toBe('view');
  });
});
