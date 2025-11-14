import http, { head } from 'k6/http';
import { check } from 'k6';
import { logResult } from '../dynamicScenarios/utils.js';

/** Payment API Endpoints */
const PAYMENT_API = {
  CREATE_BARCODE: '/payment/bar-code',
  PRODUCTS: '/merchant-op/products?size=10&status=APPROVED',
  PREVIEW_PAYMENT: '/merchant-op/transactions/bar-code/{trxCode}/preview',
  AUTH_PAYMENT: '/merchant-op/transactions/bar-code/{trxCode}/authorize',
  DELETE_PAYMENT: '/merchant-op/transactions/{trxCode}',
  GET_BARCODE: '/payment/initiatives/{initiativeId}/bar-code',
  DOWNLOAD_PDF: '/web/payment/initiatives/{initiativeId}/bar-code/{trxCode}/pdf',
};

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
 * Replaces the {trxCode} placeholder in an endpoint with the actual transaction code.
 * @param {string} endpoint - Endpoint URL with {trxCode} placeholder.
 * @param {string} trxCode - Transaction code to replace in the URL.
 * @return {string} Endpoint with transaction code.
 */
function replaceTrxCode(endpoint, trxCode) {
  return endpoint.replace('{trxCode}', trxCode || '');
}

/**
 * Validates the response and logs the result.
 * @param {string} apiName - Name of the API call.
 * @param {Object} res - HTTP response object.
 * @param {string} expectedField - JSON field expected in the response.
 * @return {Object} Response object.
 */
function validateResponse(apiName, res, expectedField = 'trxCode') {
  logResult(apiName, res);

  check(res, {
    [`${apiName} - status is success`]: (r) =>
      [200, 201, 202].includes(r.status)
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
export function getProductsApproved(baseUrl, token, acceptLanguage = 'it-IT') {
  const apiName = 'getProductsApproved';
  const url = `${baseUrl}${PAYMENT_API.PRODUCTS}`;
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
export function previewPayment(baseUrl, token, payload, acceptLanguage = 'it-IT') {
  const apiName = 'previewPayment';
  const url = `${baseUrl}${replaceTrxCode(PAYMENT_API.PREVIEW_PAYMENT, payload.discountCode)}`;
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
export function authPayment(baseUrl, token, payload, acceptLanguage = 'it-IT') {
  const apiName = 'authPayment';
  const url = `${baseUrl}${replaceTrxCode(PAYMENT_API.AUTH_PAYMENT, payload.discountCode)}`;
  const headers = buildHeaders(token, acceptLanguage);

  const res = http.put(url, JSON.stringify(payload), {
    headers,
    tags: { apiName },
    responseType: 'text',
  });
  return validateResponse(apiName, res);
}

export function deletePayment(baseUrl, token, id, acceptLanguage = 'it-IT'){
  const apiName = 'deletePayment';
  const url = `${baseUrl}${replaceTrxCode(PAYMENT_API.DELETE_PAYMENT, id)}`;
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
