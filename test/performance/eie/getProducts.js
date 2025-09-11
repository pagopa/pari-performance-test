import { group, sleep, check, fail } from 'k6'
import { getProducts } from '../../common/api/productRegister.js'
import { getJwtToken } from '../../common/api/tokenAuth.js'
import { assert, statusOk } from '../../common/assertions.js'
import defaultHandleSummaryBuilder from '../../common/handleSummaryBuilder.js'
import { defaultApiOptionsBuilder } from '../../common/dyanamicScenarios/defaultOptions.js'
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
        organizationId: '72c2c5f8-1c71-4614-a4b3-95e3aee71c3d'
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

    const products = productArray.map(p => ({
        productGroup: p.productGroup,
        organizationId: p.organizationId
    }))

    return { accessToken: token, products }
}

export default function (data) {
    group('Product Register API - Dynamic Test', () => {
        for (const product of data.products) {
            const groupKey = product.productGroup?.toLowerCase()
            const category = getCategoryFromProductGroup(product.productGroup)

            if (!category) {
                console.warn(`[SKIP] Unknown productGroup: ${product.productGroup}`)
                continue
            }

            group(`Category: ${category}`, () => {
                const params = {
                    organizationId: product.organizationId,
                    category
                }

                const res = getProducts(params, data.accessToken)

                check(res, {
                    'Request succeeded': (r) => r && r.status === 200,
                    'HTTP status is 200': (r) => r.status === 200
                })

                if (res.status !== 200 || !res.json()?.content?.length) {
                    console.warn(`[FAIL] No results for: ${JSON.stringify(params)}`)
                }

                assert(res, [statusOk()])
            })
        }
    })

    sleep(1)
}