import http, { head } from 'k6/http';
import { check } from 'k6';
import { logResult, logErrorResult } from '../dynamicScenarios/utils.js';

/** Payment API Endpoints */
const PAYMENT_API = {
  CREATE_BARCODE: '/payment/bar-code',
  PRODUCTS: '/merchant-op/initiatives/{initiativeId}/products?size=10&status=APPROVED',
  PREVIEW_PAYMENT: '/merchant-op/initiatives/{initiativeId}/transactions/bar-code/{trxCode}/preview',
  AUTH_PAYMENT: '/merchant-op/initiatives/{initiativeId}/transactions/bar-code/{trxCode}/authorize',
  DELETE_PAYMENT: '/merchant-op/initiatives/{initiativeId}/transactions/{trxCode}',
  GET_BARCODE: '/payment/initiatives/{initiativeId}/bar-code',
  DOWNLOAD_PDF: '/web/payment/initiatives/{initiativeId}/bar-code/{trxCode}/pdf',
};

/**
 * Generates a RFC4122 v4 UUID using Math.random (sufficient for test data, not cryptographically secure).
 * @return {string} A v4 UUID string.
 */
export function generateUuidV4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Builds headers for HTTP requests.
 * @param {string} token - Bearer token for authorization.
 * @param {string} acceptLanguage - Language for the request (default: 'it-IT').
 * @return {Object} Headers object.
 */
function buildHeaders(token, acceptLanguage = 'it-IT') {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept-Language': acceptLanguage,
  };
}

/**
 * Replaces the {trxCode} and {initiativeId} placeholders in an endpoint with their actual values.
 * @param {string} endpoint - Endpoint URL with {trxCode}/{initiativeId} placeholders.
 * @param {string} trxCode - Transaction code to replace in the URL.
 * @param {string} initiativeId - Initiative id to replace in the URL.
 * @return {string} Endpoint with placeholders replaced.
 */
function replaceTrxCode(endpoint, trxCode, initiativeId) {
  return endpoint
    .replace('{trxCode}', trxCode || '')
    .replace('{initiativeId}', initiativeId || '');
}

/**
 * Validates the response and logs the result.
 * @param {string} apiName - Name of the API call.
 * @param {Object} res - HTTP response object.
 * @param {string} expectedField - JSON field expected in the response.
 * @return {Object} Response object.
 */
function validateResponse(apiName, res, expectedField = 'trxCode') {
  const isSuccess = [200, 201, 202].includes(res?.status);
  if (!isSuccess) {
    logErrorResult(apiName, res, false);
  }

  check(res, {
    [`${apiName} - status is success`]: () => isSuccess,
  });

  return res;
}

function validateAndLogResponse(name, res, okStatuses = [200], expectedByStatus = {}) {
  logResult(name, res);

  const isOk = !!res && okStatuses.includes(res.status);
  let ok = isOk;

  if (!ok && res) {
    const expectedCodes = expectedByStatus[res.status];
    if (expectedCodes && expectedCodes.length > 0) {
      const j = parseJsonSafe(res);
      if (j?.code && expectedCodes.includes(j.code)) {
        ok = true;
      }
    }
  }

  check(res, {
    [`${name} responded with pure 2xx`]: () => isOk,
    [`${name} ok (status in ${JSON.stringify(okStatuses)} or expected codes)`]: () => ok,
  });

  return { res, ok, isOk };
}

/**
 * Retrieves approved products from the API.
 * @param {string} baseUrl - Base URL of the API.
 * @param {string} token - Bearer token for authorization.
 * @param {string} acceptLanguage - Language for the request (default: 'it-IT').
 * @return {Object} Response object.
 */
export function getProductsApproved(baseUrl, initiativeId, token, acceptLanguage = 'it-IT') {
  const apiName = 'getProductsApproved';
  const url = `${baseUrl}${PAYMENT_API.PRODUCTS.replace('{initiativeId}', initiativeId || '')}`;
  const headers = buildHeaders(token, acceptLanguage);

  const res = http.get(url, {
    headers,
    tags: { apiName },
    responseType: 'text',
  });

  return validateResponse(apiName, res, 'content');
}

/**
 * Creates a new barcode for payment.
 * @param {string} baseUrl - Base URL of the API.
 * @param {string} token - Bearer token for authorization.
 * @param {Object} payload - Payload for the request.
 * @param {string} acceptLanguage - Language for the request (default: 'it-IT').
 * @return {Object} Response object.
 */
export function createBarCode(baseUrl, token, payload, acceptLanguage = 'it-IT') {
  const apiName = 'createBarCode';
  const url = `${baseUrl}${PAYMENT_API.CREATE_BARCODE}`;
  const headers = buildHeaders(token, acceptLanguage);

  const res = http.post(url, JSON.stringify(payload), {
    headers,
    tags: { apiName },
    responseType: 'text',
  });
  return validateResponse(apiName, res);
}

/**
 * Previews a payment before authorization.
 * @param {string} baseUrl - Base URL of the API.
 * @param {string} token - Bearer token for authorization.
 * @param {Object} payload - Payload containing transaction info.
 * @param {string} acceptLanguage - Language for the request (default: 'it-IT').
 * @return {Object} Response object.
 */
export function previewPayment(baseUrl, initiativeId, trxCode, token, payload, acceptLanguage = 'it-IT') {
  const apiName = 'previewPayment';
  const url = `${baseUrl}${replaceTrxCode(PAYMENT_API.PREVIEW_PAYMENT, trxCode, initiativeId)}`;
  const headers = buildHeaders(token, acceptLanguage);

  const res = http.put(url, JSON.stringify(payload), {
    headers,
    tags: { apiName },
    responseType: 'text',
  });

  return validateResponse(apiName, res);
}

/**
 * Authorizes a payment.
 * @param {string} baseUrl - Base URL of the API.
 * @param {string} token - Bearer token for authorization.
 * @param {Object} payload - Payload containing transaction info.
 * @param {string} acceptLanguage - Language for the request (default: 'it-IT').
 * @return {Object} Response object.
 */
export function authPayment(baseUrl, initiativeId, trxCode, token, payload, acceptLanguage = 'it-IT') {
  const apiName = 'authPayment';
  const url = `${baseUrl}${replaceTrxCode(PAYMENT_API.AUTH_PAYMENT, trxCode, initiativeId)}`;
  const headers = buildHeaders(token, acceptLanguage);

  const res = http.put(url, JSON.stringify(payload), {
    headers,
    tags: { apiName },
    responseType: 'text',
  });
  return validateResponse(apiName, res);
}

export function deletePayment(baseUrl, initiativeId, token, id, acceptLanguage = 'it-IT'){
  const apiName = 'deletePayment';
  const url = `${baseUrl}${replaceTrxCode(PAYMENT_API.DELETE_PAYMENT, id, initiativeId)}`;
  const headers = buildHeaders(token, acceptLanguage);

  const res = http.del(url, null, {  
    headers: headers,
    tags: { apiName },
    responseType: 'text',
  });

  return validateResponse(apiName, res);
}

export function getBarcode(baseUrl, token, initiativeId, acceptLanguage = 'it-IT'){
  const apiName = 'getBarcode';
  const url = `${baseUrl}${PAYMENT_API.GET_BARCODE.replace('{initiativeId}', initiativeId)}`;
  const headers = buildHeaders(token, acceptLanguage);

  const params = {
    headers,
    responseType: 'text',
    tags: {
      apiName: apiName,
      // Potrebbe restituire 404 atteso
      expected_response: 'true',
    },
  };

  const res = http.get(url, params);

  return validateAndLogResponse(apiName, res);
}

export function downloadPdf(baseUrl, token, initiativeId, trxCode, acceptLanguage = 'it-IT'){
  const apiName = 'downloadPdf';
  const url = `${baseUrl}${PAYMENT_API.DOWNLOAD_PDF.replace('{initiativeId}', initiativeId).replace('{trxCode}', trxCode)}`;
  const headers = buildHeaders(token, acceptLanguage);
    console.log(`Downloading PDF from URL: ${url}`);
  const params = {
    headers,
    responseType: 'text',
    tags: {
      apiName: apiName,
      // Potrebbe restituire 404 atteso
      expected_response: 'true',
    },
  };

  const res = http.get(url, params);

  return validateAndLogResponse(apiName, res);
}
