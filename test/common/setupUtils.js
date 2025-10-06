import { getTokenIO, getTokenRegister, getTokenKeycloak } from './api/tokenAuth.js'
import { getProducts } from './api/productRegister.js'
import { check, fail } from 'k6'

export function setupTokenKeycloak(email, password){
  const { tokenKeycloakResponse } = getTokenKeycloak(email, password)
  const successKeycloak = check(tokenKeycloakResponse, { 'Keycloak token received': (r) => r && r.status === 200 })
  if (!successKeycloak || !tokenKeycloakResponse.body) {
    console.error('[setupToken] Failed to retrieve keycloak token', { status: tokenKeycloakResponse?.status })
    fail('[setupToken] Aborting: invalid IO token')
  }

  const accessToken = tokenKeycloakResponse.json('access_token')
  return accessToken
}

export function setupTokenIO(cf = ''){
  const { tokenIOResponse } = getTokenIO(cf)

  const successIo = check(tokenIOResponse, { 'IO token received': (r) => r && r.status === 200 })
  if (!successIo || !tokenIOResponse.body) {
    console.error('[setupToken] Failed to retrieve IO token', { status: tokenIOResponse?.status })
    fail('[setupToken] Aborting: invalid IO token')
  }

  const ioToken = String(tokenIOResponse.body).replace(/"/g, '').trim()
  return ioToken
}

export function setupTokenRegister() {
  const { tokenResponse, organizationId } = getTokenRegister()

  const successJwt = check(tokenResponse, { 'JWT token received': (r) => r && r.status === 200 })
  if (!successJwt || !tokenResponse.body) {
    console.error('[setupToken] Failed to retrieve JWT token', { status: tokenResponse?.status })
    fail('[setupToken] Aborting: invalid JWT token')
  }

  const accessToken = String(tokenResponse.body).replace(/"/g, '').trim()

  return { accessToken, organizationId }
}

export function setupWithProducts() {
  const { accessToken, organizationId } = setupTokenRegister()

  const fetchParams = { organizationId }
  const productRes = getProducts(fetchParams, accessToken)

  if (!productRes) {
    console.error('[setupWithProducts] getProducts returned falsy response')
    fail('[setupWithProducts] Aborting: failed to fetch products')
  }

  const body = (() => {
    try {
      return productRes.json()
    } catch (err) {
      console.error('[setupWithProducts] Failed parsing products response', err)
      return {}
    }
  })()

  const productArray = Array.isArray(body?.content) ? body.content : []

  const productSuccess = check(productRes, {
    'Fetched initial products': () => productArray.length > 0,
  })

  if (!productSuccess) {
    console.error('[setupWithProducts] No products found or API failed', { status: productRes?.status })
    fail('[setupWithProducts] Aborting: missing product data')
  }

  return { accessToken, products: productArray, organizationId }
}
