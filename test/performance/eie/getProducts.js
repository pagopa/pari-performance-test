import { group, check, fail } from 'k6'
import { getProducts } from '../../common/api/productRegister.js'
import { assert, statusOk } from '../../common/assertions.js'
import defaultHandleSummaryBuilder from '../../common/handleSummaryBuilder.js'
import { defaultApiOptionsBuilder } from '../../common/dynamicScenarios/defaultOptions.js'
import { getRandomCategory } from '../../common/utils.js'
import { setupUtils } from '../../common/setupUtils.js'

const application = 'register'
const testName = 'getProducts'

export const options = defaultApiOptionsBuilder(application, testName)
export const handleSummary = defaultHandleSummaryBuilder(application, testName)

export function setup() {
    return setupUtils()
}

export default function (data) {
    group('Product Register API - Test with category filter', () => {
        const randomCategory = getRandomCategory()
        console.log(`[FILTER] Using random category: ${randomCategory}`)

        const params = {
            organizationId: data.products[0]?.organizationId,
            category: randomCategory
        }

        console.log(`[API CALL] Params being sent: ${JSON.stringify(params)}`)

        group(`Search products for category: ${randomCategory}`, () => {
            const res = getProducts(params, data.accessToken)
            const content = res.json()?.content || []

            console.log(`[API RESPONSE] Category: ${randomCategory}, Response: ${JSON.stringify(res.json(), null, 2)}`)

            const checks = check(res, {
                'Request succeeded': (r) => r && r.status === 200,
                'Content is array': (r) => Array.isArray(r.json()?.content)
            })

            if (res.status === 200) {
                console.info(`[RESULT] ${randomCategory} → ${content.length} products found`)
            } else {
                console.warn(`[FAIL] ${randomCategory} → Status: ${res.status}`)
            }

            assert(res, [statusOk()])
        })
    })
}
