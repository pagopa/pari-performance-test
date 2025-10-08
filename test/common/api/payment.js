import http from 'k6/http'
import { check } from 'k6'
import { logResult } from '../dynamicScenarios/utils.js'

const PAYMENT_API = {
  CREATE_BARCODE: '/bar-code',
  PRODUCTS: '/merchant-op/products?size=10&status=APPROVED',
  PREVIEW_PAYMENT: '/merchant-op/transactions/bar-code/{trxCode}/preview',
  AUTH_PAYMENT: '/merchant-op/transactions/bar-code/{trxCode}/authorize',
}


//  --- UTILITY ---
function buildHeaders(token, acceptLanguage = 'it-IT') {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept-Language': acceptLanguage,
  }
}

function replaceTrxCode(endpoint, trxCode) {
  return endpoint.replace('{trxCode}', trxCode || '')
}

function validateResponse(apiName, res, expectedField = 'trxCode') {
  logResult(apiName, res)

  check(res, {
    [`${apiName} - status is success`]: (r) =>
      [200, 201, 202, 403].includes(r.status),
    [`${apiName} - contains ${expectedField}`]: (r) =>
      r.json(expectedField) !== undefined,
  })

  return res
}


//  --- API ---
export function getProductsApproved(baseUrl, token, acceptLanguage = 'it-IT') {
  const apiName = 'getProductsApproved'
  const url = `${baseUrl}${PAYMENT_API.PRODUCTS}`
  const headers = buildHeaders(token, acceptLanguage)

  const res = http.get(url, { headers, tags: { apiName } })
  return validateResponse(apiName, res, 'content')
}

export function createBarCode(baseUrl, token, payload, acceptLanguage = 'it-IT') {
  const apiName = 'createBarCode'
  const url = `${baseUrl}${PAYMENT_API.CREATE_BARCODE}`
  const headers = buildHeaders(token, acceptLanguage)

  const res = http.post(url, JSON.stringify(payload), {
    headers,
    tags: { apiName },
  })

  return validateResponse(apiName, res)
}

export function previewPayment(baseUrl, token, payload, acceptLanguage = 'it-IT') {
  const apiName = 'previewPayment'
  const url = `${baseUrl}${replaceTrxCode(PAYMENT_API.PREVIEW_PAYMENT, payload.trxCode)}`
  const headers = buildHeaders(token, acceptLanguage)

  const res = http.put(url, JSON.stringify(payload), {
    headers,
    tags: { apiName },
  })

  return validateResponse(apiName, res)
}

export function authPayment(baseUrl, token, payload, acceptLanguage = 'it-IT') {
  const apiName = 'authPayment'
  const url = `${baseUrl}${replaceTrxCode(PAYMENT_API.AUTH_PAYMENT, payload.trxCode)}`
  const headers = buildHeaders(token, acceptLanguage)

  const res = http.put(url, JSON.stringify(payload), {
    headers,
    tags: { apiName },
    expected_response: (r) => [200, 201, 202].includes(r.status),
  })

  return validateResponse(apiName, res)
}
