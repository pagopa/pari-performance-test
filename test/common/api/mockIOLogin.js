import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { logResult } from '../dynamicScenarios/utils.js';

export const IDPAY_ONBOARDING_API_NAMES = {
  testLogin: 'idpay/mock-io',
};

const mockLoginErrorCounter = new Counter('mock_login_failed');

export function getMockLogin(fiscalCode) {
  const apiName = IDPAY_ONBOARDING_API_NAMES.testLogin;
  const url = `https://uat01.rtd.internal.uat.cstar.pagopa.it/cstarmockbackendio/bpd/pagopa/api/v1/login?fiscalCode=${fiscalCode}`;

  const res = http.post(url, null, { responseType: 'text' });

  // ✅ esegui i check qui
  const ok = check(res, {
    'mock login status 200': (r) => r.status === 200,
    'mock login body is not empty': (r) => r.body && r.body.length > 0,
  });

  if (!ok) {
    logResult?.(`❌ Login failed for ${fiscalCode} - status: ${res.status}`);
    mockLoginErrorCounter.add(1);
  }

  return {
    res,
    ok,
    token: ok ? res.body : null,
  };
}