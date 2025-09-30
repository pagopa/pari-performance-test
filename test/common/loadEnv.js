import { toTrimmedString } from './basicUtils.js'

export function loadEnvConfig(env) {
    const normalizedEnv = toTrimmedString(env, 'dev').toLowerCase()
    const resolvedPath = import.meta.resolve(`../../config/${normalizedEnv}.json`)
    const filePath = resolvedPath.startsWith('file://')
        ? normalizeFileUrl(resolvedPath)
        : resolvedPath

    try {
        const raw = open(filePath)
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed.pdvUrl !== 'string') {
            throw new Error(
                `config file ${filePath} missing pdvUrl property`
            )
        }
        return parsed
    } catch (err) {
        throw new Error(
            `Unable to load config for TARGET_ENV=${normalizedEnv}: ${err.message}`
        )
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
