import { getJwtToken } from './api/tokenAuth.js'
import { getProducts } from './api/productRegister.js'
import { check, fail } from 'k6'

export function setupUtils() {
    const { tokenRes, organizationId } = getJwtToken()

    const success = check(tokenRes, {
        'JWT token received': (r) => r && r.status === 200
    })

    if (!success || !tokenRes.body) {
        console.error(`[SETUP] Failed to retrieve JWT token. Status: ${tokenRes?.status}, Body: ${tokenRes?.body}`)
        fail('[SETUP] Test aborted due to invalid token')
    }

    const token = tokenRes.body.replace(/"/g, '').trim()
    const fetchParams = { organizationId }

    const productRes = getProducts(fetchParams, token)
    const body = productRes.json()

    console.log(`[SETUP] Response body: ${JSON.stringify(body, null, 2)}`)

    const productArray = Array.isArray(body?.content) ? body.content : []

    const productSuccess = check(productRes, {
        'Fetched initial products': () => productArray.length > 0
    })

    if (!productSuccess) {
        console.error(`[SETUP] No products found or API failed. Status: ${productRes?.status}`)
        fail('[SETUP] Test aborted due to missing product data')
    }

    console.log(`[SETUP] Total products found: ${productArray.length}`)

    return { accessToken: token, products: productArray }
}
