import { group, check, fail } from 'k6'
import { getProducts } from '../../common/api/productRegister.js'
import { assert, statusOk } from '../../common/assertions.js'
import defaultHandleSummaryBuilder from '../../common/handleSummaryBuilder.js'
import { defaultApiOptionsBuilder } from '../../common/dynamicScenarios/defaultOptions.js'
import { setupWithProducts } from '../../common/setupUtils.js'

const application = 'register'
const testName = 'getProducts'

export const options = defaultApiOptionsBuilder(application, testName)
export const handleSummary = defaultHandleSummaryBuilder(application, testName)

export function setup() {
    return setupWithProducts()
}

export default function (data) {
    group('Product Register API - Test without category filter', () => {
        const params = {
            organizationId: data.products[0]?.organizationId
        }

        group('Search all products', () => {
            const res = getProducts(params, data.accessToken)
            const content = res.json()?.content || []

            const checks = check(res, {
                'Request succeeded': (r) => r && r.status === 200,
                'Content is array': (r) => Array.isArray(r.json()?.content)
            })

            if (res.status === 200) {
                console.info(`[RESULT] Found ${content.length} products`)
            } else {
                console.warn(`[FAIL] Status: ${res.status}`)
            }

            assert(res, [statusOk()])
        })
    })
}
