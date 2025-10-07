import http, { head } from 'k6/http'
import { check } from 'k6'
import { logResult } from '../dynamicScenarios/utils.js'
import { DEV, UAT, getBaseUrl } from '../envUrl.js'

// --- API Endpoints ---
export const PAYMENT_API = {
  CREATE_BARCODE: '/bar-code',
  PRODUCTS: '/merchant-op/products?size=10&status=APPROVED',
  PREVIEW_PAYMENT: '/merchant-op/transactions/bar-code/{trxCode}/preview',
  AUTH_PAYMENT: '/merchant-op/transactions/bar-code/{trxCode}/authorize',
}

// --- Environments ---
const REGISTERED_ENVS = [DEV, UAT]
const BASE_URL = getBaseUrl(REGISTERED_ENVS).baseUrl
const API_PREFIX = '/payment'

function buildUrl(endpoint, trxCode, withPrefix = true) {
  const prefix = withPrefix ? API_PREFIX : ''
  return `${BASE_URL}${prefix}${endpoint.replace('{trxCode}', trxCode || '')}`
}

function validateResponse(apiName, res, expectedField = 'trxCode') {
  logResult(apiName, res)
  check(res, {
    [`${apiName} - status is success`]: (r) =>
      r.status === 200 || r.status === 201 || r.status === 202,
    [`${apiName} - contains ${expectedField}`]: (r) =>
      r.json(expectedField) !== undefined,
  })
  return res
}

// --- API Calls ---
export function getProductsApproved(headers) {
  const apiName = 'getProductsApproved'
  const url = buildUrl(PAYMENT_API.PRODUCTS, null, false)
  const res = http.get(url, { headers, tags: { apiName } })
  return validateResponse(apiName, res, 'content')
}

export function createBarCode(payload, headers) {
  const apiName = 'createBarCode'
  const url = buildUrl(PAYMENT_API.CREATE_BARCODE, null, true)
  const res = http.post(url, JSON.stringify(payload), {
    headers,
    tags: { apiName },
  })
  return validateResponse(apiName, res)
}

export function previewPayment(payload, headers) {
  const apiName = 'previewPayment'
  const url = buildUrl(PAYMENT_API.PREVIEW_PAYMENT, payload.discountCode, false)
  const res = http.put(url, JSON.stringify(payload), {
    headers,
    tags: { apiName },
  })
  return validateResponse(apiName, res)
}

export function authPayment(payload, headers) {
  const apiName = 'authPayment'
  const url = buildUrl(PAYMENT_API.AUTH_PAYMENT, payload.discountCode, false)
  const res = http.put(url, JSON.stringify(payload), {
    headers,
    tags: { apiName },
  })
  return validateResponse(apiName, res)
}
