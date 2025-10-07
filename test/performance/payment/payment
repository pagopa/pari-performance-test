import { group, check } from 'k6'
import { getProductsApproved, createBarCode, previewPayment, authPayment } from '../../common/api/payment.js'
import defaultHandleSummaryBuilder from '../../common/handleSummaryBuilder.js'
import { defaultApiOptionsBuilder } from '../../common/dynamicScenarios/defaultOptions.js'
import { setupTokenIO, setupTokenKeycloak } from '../../common/setupUtils.js'

const application = 'payment'
const testName = 'previewAndAuthPayment'

export const options = defaultApiOptionsBuilder(application, testName)
export const handleSummary = defaultHandleSummaryBuilder(application, testName)

// --- Setup ---
export function setup() {
  const cf = __ENV.CF || "CF"
  const email = __ENV.USER_EMAIL || "email"
  const password = __ENV.USER_PASSWORD || "password"
  const userId = __ENV.USER_ID || "userId"
  const initiativeId = __ENV.INITIATIVE_ID || "initiativeId"

  const tokenIO = setupTokenIO(cf)
  const tokenKeycloak = setupTokenKeycloak(email, password)
  return { tokenIO, tokenKeycloak, userId, initiativeId }
}

// --- Main Flow ---
export default function (data) {
  group('Payment API - End-to-End Flow', () => {

    // --- Create Voucher ---
    let trxCode
    group('Create Voucher', () => {
      const barCodePayload = { initiativeId: data.initiativeId }
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.tokenIO}`,
      }

      const voucherRes = createBarCode(barCodePayload, headers)

      check(voucherRes, {
        'Voucher created (201)': (r) => r && r.status === 201,
      })

      trxCode = voucherRes.json('trxCode')
    })

    // --- Get Products ---
    let randomProduct
    group('Get Products', () => {
      const headersProducts = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.tokenKeycloak}`,
      }

      const productsRes = getProductsApproved(headersProducts)

      check(productsRes, {
        'Products retrieved (200)': (r) => r && r.status === 200,
      })

      const productList = productsRes.json('content') || []
      if (productList.length === 0) {
        throw new Error('❌ No products available for preview')
      }
      randomProduct = productList[Math.floor(Math.random() * productList.length)]
    })

    // --- Preview + Auth Payment ---
    group('Preview and Authorize Payment', () => {
      const previewPayload = {
        productGtin: randomProduct.gtinCode,
        productName: randomProduct.productName,
        amountCents: 1000,
        discountCode: trxCode,
      }

      const previewRes = previewPayment(previewPayload, {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.tokenKeycloak}`,
      })

      check(previewRes, {
        'Preview succeeded (200)': (r) => r && r.status === 200,
      })

      const authPayload = {
        additionalProperties: { productGtin: randomProduct.gtinCode },
        amountCents: 1000,
        discountCode: trxCode,
      }

      const authRes = authPayment(authPayload, {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.tokenKeycloak}`,
      })

      check(authRes, {
        'Auth succeeded (200)': (r) => r && r.status === 200,
      })
    })
  })
}
