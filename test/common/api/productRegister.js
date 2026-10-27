import http from 'k6/http'
import { logResult } from '../dynamicScenarios/utils.js'
import { DEV, UAT, getBaseUrl } from '../envUrl.js'

export const PRODUCT_API_NAMES = {
    getProducts: 'register/products',
}

const REGISTERED_ENVS = [DEV, UAT]
const innerBaseUrl =  getBaseUrl(REGISTERED_ENVS).baseUrl
const API_PREFIX = '/register'

export function getProducts(params, initiativeId, accessToken) {
    const apiName = PRODUCT_API_NAMES.getProducts

    const requestParams = {
        headers: {
            'Content-Type': 'application/json',
            'x-organization-role': 'operatore',
            'Authorization': `Bearer ${accessToken}`
        }
    }

    const queryString = Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')

    const url = `${innerBaseUrl}${API_PREFIX}/initiatives/${initiativeId}/products?${queryString}`
    const res = http.get(url, requestParams)

    logResult(apiName, res)

    return res
}
