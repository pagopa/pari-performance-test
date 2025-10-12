import * as fs from 'k6/experimental/fs'
import { toTrimmedString } from './basicUtils.js'

// Rimuove l'eventuale slash finale per evitare duplicazioni nei percorsi.
// Restituisce subito il valore originale quando è falsy così i call-site restano semplici.
export function trimTrailingSlash(value) {
    return value ? value.replace(/\/$/, '') : value
}

// Converte il percorso in formato POSIX eliminando slash e backslash duplicati.
// Serve a mantenere coerenti i confronti di path indipendentemente dal sistema operativo.
export function normalizeAbsolutePath(value) {
    if (!value) {
        return ''
    }

    let normalized = value.replace(/\\/g, '/')

    normalized = normalized.replace(/\/{2,}/g, '/')
    normalized = normalized.replace(/\/$/, '')

    return normalized
}

// Identifica se un path è già assoluto gestendo sia Unix che Windows.
// Riduce branching a valle quando dobbiamo decidere se concatenare la base directory.
export function isAbsolutePath(value) {
    if (!value) {
        return false
    }

    return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)
}

// Unisce due segmenti di path eliminando slash superflui alle estremità.
// Garantisce che il risultato abbia un solo separatore tra base e segmento.
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

// Risolve il percorso finale usato per i report combinando input esplicito e variabili d'ambiente.
// Normalizza gli slash e cade su "reports" locale se non trova indicazioni coerenti.
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

// Interpreta il risultato di stat() verificando i vari formati che indicano "directory".
// Supporta signature differenti così il codice resta portabile tra runtime e piattaforme.
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

// Identifica errori legati a path inesistente per distinguere tra mancanza reale e altri problemi.
// Restituisce false per eccezioni generiche lasciando al chiamante la scelta su come gestirle.
function isMissingPathError(error) {
    if (!error) {
        return false
    }

    const message = String(error).toLowerCase()
    return message.includes('not found') || message.includes('no such file')
}

// Verifica se la cartella report è presente usando k6/experimental/fs; non tenta la creazione.
// Restituisce true/false quando riesce a determinare lo stato, oppure undefined se il check fallisce.
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
