import { group, sleep, check, fail } from 'k6'
import { getProducts } from '../../common/api/productRegisterDirect.js'
import { assert, statusOk } from '../../common/assertions.js'
import defaultHandleSummaryBuilder from '../../common/handleSummaryBuilder.js'
import { defaultApiOptionsBuilder } from '../../common/dynamicScenarios/defaultOptions.js'
import { getCategoryFromProductGroup } from '../../common/utils.js'
import { getOrgId } from '../../common/envOrgResolver.js'

const application = 'register'
const testName = 'getProducts'

export const options = defaultApiOptionsBuilder(application, testName)
export const handleSummary = defaultHandleSummaryBuilder(application, testName)

export function setup() {
    const operationAvailableEnvs = ['dev', 'uat']
    const organizationId = getOrgId(operationAvailableEnvs, 'eie')

    const fetchParams = { organizationId }

    const productRes = getProducts(fetchParams)
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
        .filter(p => p.organizationId)
        .map(p => ({
            productGroup: p.productGroup,
            organizationId: p.organizationId,
            gtinCode: p.gtinCode,
            category: p.category
        }))

    console.log(`[SETUP] Total products prepared for test: ${products.length}`)

    return { products }
}

export default function (data) {
    group('Product Register API - Direct Test', () => {
        for (const product of data.products) {
            const category = getCategoryFromProductGroup(product.productGroup, product)

            if (!category) {
                console.warn(`[SKIP] Unknown productGroup: ${product.productGroup}`)
                continue
            }

            const params = {
                organizationId: product.organizationId,
                category
            }

            group(`Search category: ${category}`, () => {
                const res = getProducts(params)
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