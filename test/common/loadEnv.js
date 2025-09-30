import { toTrimmedString } from './utils.js'

export function loadEnvConfig(env) {
    const normalizedEnv = toTrimmedString(env, 'dev').toLowerCase()
    const path = `../../config/${normalizedEnv}.json`

    try {
        const raw = open(path)
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed.pdvUrl !== 'string') {
            throw new Error(`config file ${path} missing pdvUrl property`)
        }
        return parsed
    } catch (err) {
        throw new Error(`Unable to load config for TARGET_ENV=${normalizedEnv}: ${err.message}`)
    }
}
