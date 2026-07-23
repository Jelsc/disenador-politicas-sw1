import { routes } from './app.routes';

describe('app routes', () => {
  it('registers the new document repository routes and legacy redirects', () => {
    const dashboardRoute = routes.find(route => Array.isArray(route.children));
    const documentListRoute = dashboardRoute?.children?.find(route => route.path === 'documents');
    const policyRepositoryRoute = dashboardRoute?.children?.find(route => route.path === 'documents/:policyId');
    const policyConfigRoute = dashboardRoute?.children?.find(route => route.path === 'documents/:policyId/config');
    const editorRoute = dashboardRoute?.children?.find(route => route.path === 'documents/:policyId/:documentId/versions/:version/editor');
    const legacyPolicyRepositoryRoute = dashboardRoute?.children?.find(route => route.path === 'policies/:id/documents');
    const legacyPolicyConfigRoute = dashboardRoute?.children?.find(route => route.path === 'policies/:id/documents/config');
    const procedureRepositoryRoute = dashboardRoute?.children?.find(route => route.path === 'tramites/:id/documents');

    expect(documentListRoute?.data?.['launcher']).toBe('document-repository');
    expect(policyRepositoryRoute?.data?.['repositoryScope']).toBe('policy');
    expect(policyConfigRoute?.data?.['viewMode']).toBe('config');
    expect(editorRoute).toBeDefined();
    expect(legacyPolicyRepositoryRoute?.redirectTo).toBe('documents/:id');
    expect(legacyPolicyConfigRoute?.redirectTo).toBe('documents/:id/config');
    expect(procedureRepositoryRoute?.data?.['repositoryScope']).toBe('procedure');
    expect(procedureRepositoryRoute?.data?.['viewMode']).toBe('procedure-docs');
  });
});
