import { group, sleep, check, fail } from 'k6'
import { getProducts } from '../../common/api/productRegister.js'
import { getJwtToken } from '../../common/api/tokenAuth.js'
import { assert, statusOk } from '../../common/assertions.js'
import defaultHandleSummaryBuilder from '../../common/handleSummaryBuilder.js'
import { defaultApiOptionsBuilder } from '../../common/dynamicScenarios/defaultOptions.js'
import { getCategoryFromProductGroup } from '../../common/utils.js'

const application = 'register'
const testName = 'getProducts'

export const options = defaultApiOptionsBuilder(application, testName)
export const handleSummary = defaultHandleSummaryBuilder(application, testName)

export function setup() {
    const tokenRes = getJwtToken()

    const success = check(tokenRes, {
        'JWT token received': (r) => r && r.status === 200
    })

    if (!success || !tokenRes.body) {
        console.error(`[SETUP] Failed to retrieve JWT token. Status: ${tokenRes?.status}, Body: ${tokenRes?.body}`)
        fail('[SETUP] Test aborted due to invalid token')
    }

    const token = tokenRes.body.replace(/"/g, '').trim()

    const fetchParams = {
        organizationId: '8bd31e63-a8e8-4cbc-b06d-bc69f32c3fde'
    }

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

    const products = productArray
        .filter(p => p.productGroup && p.organizationId)
        .map(p => ({
            productGroup: p.productGroup,
            organizationId: p.organizationId
        }))

    console.log(`[SETUP] Total products prepared for test: ${products.length}`)

    return { accessToken: token, products }
}

export default function (data) {
    group('Product Register API - Dynamic Test', () => {
        for (const product of data.products) {
            const category = getCategoryFromProductGroup(product.productGroup)

            if (!category) {
                console.warn(`[SKIP] Unknown productGroup: ${product.productGroup}`)
                continue
            }

            const params = {
                organizationId: product.organizationId,
                category
            }

            group(`Search category: ${category}`, () => {
                const res = getProducts(params, data.accessToken)
                const content = res.json()?.content || []

                const checks = check(res, {
                    'Request succeeded': (r) => r && r.status === 200,
                    'Content is array': (r) => Array.isArray(r.json()?.content)
                })

                if (res.status === 200) {
                    console.info(`[RESULT] ${category} → ${content.length} products`)
                } else {
                    console.warn(`[FAIL] ${category} → Status: ${res.status}`)
                }

                assert(res, [statusOk()])
            })
        }
    })

    sleep(1)
}