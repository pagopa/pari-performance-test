import { toTrimmedString } from './basicUtils.js'

const CONFIG_ROOT = '../../config'

export function loadEnvConfig(environmentId) {
    const normalizedEnv = toTrimmedString(environmentId, 'dev').toLowerCase()
    const filePath = resolveConfigFilePath(normalizedEnv)

    try {
        const config = parseConfigFile(filePath)
        assertValidConfig(config, filePath)
        return config
    } catch (err) {
        throw new Error(
            `Unable to load config for TARGET_ENV=${normalizedEnv}: ${err.message}`
        )
    }
}

function resolveConfigFilePath(normalizedEnv) {
    const resolvedPath = import.meta.resolve(`${CONFIG_ROOT}/${normalizedEnv}.json`)
    return resolvedPath.startsWith('file://') ? normalizeFileUrl(resolvedPath) : resolvedPath
}

function parseConfigFile(filePath) {
    const rawContents = open(filePath)
    return JSON.parse(rawContents)
}

function assertValidConfig(config, filePath) {
    if (!config || typeof config.pdvUrl !== 'string') {
        throw new Error(`config file ${filePath} missing pdvUrl property`)
    }
}

function normalizeFileUrl(fileUrl) {
    let path = fileUrl.slice('file://'.length)
    // k6 returns paths as file:///C:/... on Windows; drop the extra slash
    if (path.startsWith('/') && /^[A-Za-z]:/.test(path.slice(1))) {
        return path.slice(1)
    }
    return path
}
