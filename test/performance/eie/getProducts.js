import { group, sleep, check, fail } from 'k6'
import { getProducts } from '../../common/api/productRegister.js'
import { getJwtToken } from '../../common/api/tokenAuth.js'
import { assert, statusOk } from '../../common/assertions.js'
import defaultHandleSummaryBuilder from '../../common/handleSummaryBuilder.js'
import { defaultApiOptionsBuilder } from '../../common/dyanamicScenarios/defaultOptions.js'
import {
    getAllProductCategories,
    getAllProductStatuses,
    getProductNameByCategory
} from '../../common/utils.js'

const application = 'register'
const testName = 'getProducts'

export const options = defaultApiOptionsBuilder(application, testName)
export const handleSummary = defaultHandleSummaryBuilder(application, testName)

export function setup() {
    const res = getJwtToken()

    const success = check(res, {
        'JWT token received': (r) => r && r.status === 200
    })

    if (!success || !res.body) {
        console.error(`[SETUP] Failed to retrieve JWT token. Status: ${res?.status}, Body: ${res?.body}`)
        fail('[SETUP] Test aborted invalid token')
    }

    const token = res.body.replace(/"/g, '').trim()
    return { accessToken: token }
}

export default function (data) {
    const categories = getAllProductCategories()
    const statuses = getAllProductStatuses()

    group('Product Register API', () => {
        for (const category of categories) {
            for (const status of statuses) {
                const productName = getProductNameByCategory(category)

                group(`Category: ${category} | Status: ${status} | Name: ${productName}`, () => {
                    const params = {
                        category,
                        status,
                        productName,
                        organizationId: '390cea38-f2de-4bcb-a181-d6eef99fe528'
                    }

                    const res = getProducts(params, data.accessToken)

                    check(res, {
                        'Request succeeded': (r) => r && r.status === 200
                    })

                    assert(res, [statusOk()])
                })
            }
        }
    })

    sleep(1)
}