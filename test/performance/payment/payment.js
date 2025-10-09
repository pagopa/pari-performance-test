import { htmlReport, textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';

import { getTokenIO, getTokenKeycloak } from '../../common/api/tokenAuth.js';
import { getProductsApproved, createBarCode, previewPayment, authPayment, deletePayment } from '../../common/api/payment.js';
import { toTrimmedString } from '../../common/basicUtils.js';
import { loadEnvConfig } from '../../common/loadEnv.js';
import { prepareScenario } from '../../common/scenarioSetup.js';

/** Load fiscal codes from CSV */
const fiscalCodes = new SharedArray('fiscalCodes', () => {
  const csv = open('../../../assets/fc_list_10k.csv');
  return csv
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line !== 'CF');
});

/** Environment and API configuration */
const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase();
const envConfig = loadEnvConfig(targetEnv);

const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || '');
const keycloakUrl = toTrimmedString(__ENV.KEYCLOAK_URL, envConfig.keycloakUrl || '');

if (!baseUrl) {
  throw new Error(`Missing APIM_URL for environment: ${targetEnv}`);
}
if (!keycloakUrl) {
  throw new Error(`Missing KEYCLOAK_URL for environment: ${targetEnv}`);
}

/** Scenario setup */
const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV });

export const options = {
  discardResponseBodies: true,
  scenarios: {
    payment: scenarioConfig,
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

/**
 * Generates test summary reports.
 * @param {Object} data - K6 test result data.
 * @returns {Object} Report files.
 */
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [`report-${Date.now()}.html`]: htmlReport(data),
  };
}

/** Setup function for logging scenario */
export function setup() {
  logScenario();
}

/** Test data */
const initiativeId = '68dd003ccce8c534d1da22bc';
const startIndex = 0;
const email = __ENV.KEYCLOAK_USERNAME;
const password = __ENV.KEYCLOAK_PASSWORD;

/**
 * Default test function: End-to-End Payment Flow
 */
export default function () {
  const iterationIndex = startIndex + exec.scenario.iterationInTest;
  const fiscalCode = fiscalCodes[iterationIndex];

  if (!fiscalCode) {
    console.error(`Index ${iterationIndex} out of range. Skipping iteration.`);
    return;
  }

  // Obtain tokens
  const tokenIO = getTokenIO(fiscalCode);
  const tokenKeycloak = getTokenKeycloak(keycloakUrl, email, password);

  group('Payment API - End-to-End Flow', () => {
    let trxCode;
    let selectedProduct;

    /** Create Voucher */
    group('Create Voucher', () => {
      const payload = { initiativeId };
      const res = createBarCode(baseUrl, tokenIO, payload);

      check(res, { 'Voucher created (201)': r => r?.status === 201 });

      trxCode = res.json('trxCode');
      if (!trxCode) {
        throw new Error('❌ Missing trxCode in createBarCode response.');
      }
    });

    /** Retrieve Products */
    group('Get Products', () => {
      const res = getProductsApproved(baseUrl, tokenKeycloak);

      check(res, { 'Products retrieved (200)': r => r?.status === 200 });

      const productList = res.json('content') || [];
      if (!productList.length) {
        throw new Error('❌ No products available for preview.');
      }

      selectedProduct = productList[Math.floor(Math.random() * productList.length)];
    });

    /** Preview, Authorize and Delete Payment */
    group('Preview, Authorize And Delete Payment', () => {
      const previewPayload = {
        productGtin: selectedProduct.gtinCode,
        productName: selectedProduct.productName,
        amountCents: 1000,
        discountCode: trxCode,
      };

      const previewRes = previewPayment(baseUrl, tokenKeycloak, previewPayload);
      check(previewRes, { 'Preview succeeded (200)': r => r?.status === 200 });

      const authPayload = {
        additionalProperties: { productGtin: selectedProduct.gtinCode },
        amountCents: 1000,
        discountCode: trxCode,
      };

      const authRes = authPayment(baseUrl, tokenKeycloak, authPayload);
      check(authRes, { 'Authorization succeeded (200)': r => r?.status === 200 });

      sleep(3);

      const deleteRes = deletePayment(baseUrl, tokenKeycloak, authRes.json('id'));
      check(deleteRes, { 'Delete succeeded (200)': r => r?.status === 200 });

    });
        
  });
}
