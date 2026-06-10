import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { environment } from '../../../environments/environment';
import { PolicyService } from './policy.service';

describe('PolicyService', () => {
  let service: PolicyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PolicyService]
    });

    service = TestBed.inject(PolicyService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts deterministic dry-run verifications to the backend contract', () => {
    service.verifyDryRun('Política 1', { nodes: [], connectors: [] }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/policies/dry-run`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ policyName: 'Política 1', rules: '{"nodes":[],"connectors":[]}' });
    req.flush({
      policyName: 'Política 1',
      status: 'ok',
      durationMs: 4,
      checkedPaths: 0,
      errors: [],
      warnings: [],
      bottlenecks: [],
      checks: [],
      recommendations: []
    });
  });
});
