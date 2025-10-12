import * as fs from 'k6/experimental/fs'
import { toTrimmedString } from './basicUtils.js'

export function trimTrailingSlash(value) {
    return value ? value.replace(/\/$/, '') : value
}

export function normalizeAbsolutePath(value) {
    if (!value) {
        return ''
    }

    let normalized = value.replace(/\\/g, '/')

    normalized = normalized.replace(/\/{2,}/g, '/')
    normalized = normalized.replace(/\/$/, '')

    return normalized
}

export function isAbsolutePath(value) {
    if (!value) {
        return false
    }

    return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)
}

export function joinPaths(base, segment) {
    const left = base ? base.replace(/[\\/]+$/, '') : ''
    const right = segment ? segment.replace(/^[\\/]+/, '') : ''

    if (!left) {
        return right
    }

    if (!right) {
        return left
    }

    return `${left}/${right}`
}

export function resolveReportsDirectory({ providedDir, env } = {}) {
    const baseWorkspace = trimTrailingSlash(
        toTrimmedString(env?.K6_WORKDIR, env?.PWD || '')
    )

    const baseDir = baseWorkspace && baseWorkspace !== '.' ? baseWorkspace : ''

    const toAbsolute = (pathLike) => {
        const trimmed = trimTrailingSlash(pathLike)
        if (!trimmed) {
            return ''
        }

        if (isAbsolutePath(trimmed) || !baseDir) {
            return normalizeAbsolutePath(trimmed)
        }

        return normalizeAbsolutePath(joinPaths(baseDir, trimmed))
    }

    const provided = trimTrailingSlash(toTrimmedString(providedDir))
    if (provided) {
        const resolvedProvided = toAbsolute(provided)
        if (resolvedProvided) {
            return resolvedProvided
        }
    }

    const existing = trimTrailingSlash(env ? toTrimmedString(env.RESULTS_DIR) : '')
    if (existing) {
        const resolvedExisting = toAbsolute(existing)
        if (resolvedExisting) {
            return resolvedExisting
        }
    }

    if (baseDir) {
        return normalizeAbsolutePath(joinPaths(baseDir, 'reports'))
    }

    return 'reports'
}

export function statIsDirectory(statResult) {
    if (!statResult) {
        return false
    }

    if (typeof statResult.type === 'string') {
        const normalizedType = statResult.type.toLowerCase()
        return normalizedType === 'directory' || normalizedType === 'dir'
    }

    if (typeof statResult.isDirectory === 'function') {
        return statResult.isDirectory()
    }

    if (typeof statResult.isDir === 'function') {
        return statResult.isDir()
    }

    if (typeof statResult.is_directory === 'boolean') {
        return statResult.is_directory
    }

    if (typeof statResult.is_dir === 'boolean') {
        return statResult.is_dir
    }

    return false
}

function isMissingPathError(error) {
    if (!error) {
        return false
    }

    const message = String(error).toLowerCase()
    return message.includes('not found') || message.includes('no such file')
}

export function ensureReportsDirExists(path) {
    if (!path) {
        return false
    }

    const statFn = typeof fs.stat === 'function' ? fs.stat : undefined

    if (statFn) {
        try {
            const stats = statFn(path)
            if (statIsDirectory(stats)) {
                return true
            }
            return false
        } catch (error) {
            if (isMissingPathError(error)) {
                return false
            }
            return undefined
        }
    }

    return undefined
}
