import { CONFIG } from './dynamicScenarios/envVars.js'
import { abort } from './utils.js'
import { loadEnvConfig } from './loadEnv.js'

export const DEV = 'dev'
export const UAT = 'uat'

export const VALID_ENVS = [DEV, UAT]

// Pre-loaded at init stage: k6's `open()` (used by loadEnvConfig) is only
// available during init, not when getBaseUrl() runs later (e.g. in setup()).
const CONFIGS = Object.fromEntries(
  VALID_ENVS.map((env) => {
    try {
      return [env, loadEnvConfig(env)]
    } catch (err) {
      return [env, null]
    }
  })
)

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

  const config = CONFIGS[env]

  if (!config || !config.apimUrl || !config.keycloakUrl) {
    abort(`Missing apimUrl or keycloakUrl config for environment "${env}" in config/${env}.json`)
    return null
  }

  return { baseUrl: config.apimUrl, keycloakBaseUrl: config.keycloakUrl }
}

export function getInitiativeId(name) {
  if (name === undefined) {
    if (CONFIG.INITIATIVE_ID) {
      return CONFIG.INITIATIVE_ID
    }
    name = 'bonus_elettrodomestici'
  }

  const env = CONFIG.TARGET_ENV
  const initiativeId = CONFIGS[env]?.initiatives?.[name]?.id

  if (!initiativeId) {
    abort(`Missing initiatives.${name}.id config for environment "${env}" in config/${env}.json`)
    return null
  }

  return initiativeId
}

export function getInitiativeOrganizationId(name = 'bonus_elettrodomestici') {
  const env = CONFIG.TARGET_ENV
  const organizationId = CONFIGS[env]?.initiatives?.[name]?.organization_id

  if (!organizationId) {
    abort(`Missing initiatives.${name}.organization_id config for environment "${env}" in config/${env}.json`)
    return null
  }

  return organizationId
}

