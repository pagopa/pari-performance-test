import { CONFIG } from './dynamicScenarios/envVars.js'
import { abort } from './utils.js'

export const DEV = 'dev'
export const UAT = 'uat'

export const VALID_ENVS = [DEV, UAT]

const SERVICES = JSON.parse(open('../../services/environments.json'))

export function isEnvValid(env) {
  return VALID_ENVS.includes(env)
}

export function isTestEnabledOnEnv(env, registeredEnvs) {
  return registeredEnvs.includes(env)
}

export function getBaseUrl(operationAvailableEnvs = VALID_ENVS) {
  const env = CONFIG.TARGET_ENV
  if (!isEnvValid(env) || !isTestEnabledOnEnv(env, operationAvailableEnvs)) {
    abort(`Environment "${env}" not allowed for this test`)
    return null
  }

  const service = SERVICES[env]

  if (!service || !service.baseUrl || !service.keycloakBaseUrl) {
    abort(`Missing baseUrl or keycloak config for environment "${env}" in services/environments.json`)
    return null
  }

  return service
}

