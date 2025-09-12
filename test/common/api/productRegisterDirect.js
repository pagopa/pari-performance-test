import http from 'k6/http'
import { logResult } from '../dynamicScenarios/utils.js'
import { DEV, UAT, getBaseUrl } from '../envUrl.js'

export const PRODUCT_API_NAMES = {
    getProducts: 'register/products',
}

const REGISTERED_ENVS = [DEV, UAT]
const innerBaseUrl = `${getBaseUrl(REGISTERED_ENVS, 'direct_eie')}`
const API_PREFIX = '/register'

export function getProducts(params) {
    const apiName = PRODUCT_API_NAMES.getProducts

    const headers = {
        headers: {
            'Content-Type': 'application/json',
            'x-organization-role': 'operatore',
            'x-organization-id': params.organizationId
        }
    }

    const queryString = Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&')

    const url = `${innerBaseUrl}${API_PREFIX}/products?${queryString}`

    const res = http.get(url, headers, { tags: { apiName } })

    logResult(apiName, res)

    return res
}