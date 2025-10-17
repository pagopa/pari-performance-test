import * as fs from 'k6/experimental/fs'
import { toTrimmedString } from './basicUtils.js'

// Riconosce slash e backslash come separatori indipendenti dal sistema operativo.
function isPathSeparator(char) {
    return char === '/' || char === '\\'
}

// Rimuove separatori dallo start e/o dalla fine in modo lineare, evitando regex problematiche.
function stripSeparators(value, { leading = false, trailing = false } = {}) {
    if (!value) {
        return ''
    }

    let start = 0
    let end = value.length

    if (leading) {
        while (start < end && isPathSeparator(value[start])) {
            start += 1
        }
    }

    if (trailing) {
        while (end > start && isPathSeparator(value[end - 1])) {
            end -= 1
        }
    }

    return value.slice(start, end)
}

// Rimuove l'eventuale separatore finale per prevenire duplicazioni nei percorsi risultanti.
// Restituisce subito il valore originale quando è falsy così i call-site restano semplici.
export function trimTrailingSlash(value) {
    return value ? stripSeparators(value, { trailing: true }) : value
}

// Converte il percorso in stile POSIX sostituendo backslash e collassi multipli.
// Mantiene consistenti i confronti tra path a prescindere dal sistema operativo.
export function normalizeAbsolutePath(value) {
    if (!value) {
        return ''
    }

    let normalized = value.replace(/\\/g, '/')

    normalized = normalized.replace(/\/{2,}/g, '/')
    normalized = normalized.replace(/\/$/, '')

    return normalized
}

// Rileva se il path è assoluto gestendo formati Unix e Windows.
// Evita che risoluzioni successive provino a concatenare una base directory inutilmente.
export function isAbsolutePath(value) {
    if (!value) {
        return false
    }

    return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)
}

// Unisce due segmenti ripulendo i separatori attigui.
// Garantisce che il risultato abbia un unico slash tra base e segmento.
export function joinPaths(base, segment) {
    const left = base ? stripSeparators(base, { trailing: true }) : ''
    const right = segment ? stripSeparators(segment, { leading: true }) : ''

    if (!left) {
        return right
    }

    if (!right) {
        return left
    }

    return `${left}/${right}`
}

// Calcola la cartella dei report combinando env, input esplicito e fallback locale.
// Tutti i path vengono normalizzati per produrre output consistenti su ogni host.
export function resolveReportsDirectory({ providedDir, env } = {}) {
    const baseWorkspace = trimTrailingSlash(
        toTrimmedString(env?.K6_WORKDIR, env?.PWD || '')
    )

    const baseDir = baseWorkspace && baseWorkspace !== '.' ? baseWorkspace : ''

    // Converte qualunque input in path assoluto normalizzato partendo dal workspace dedotto.
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

// Interpreta il risultato di stat() riconoscendo formati diversi che rappresentano directory.
// Mantiene compatibilità con runtime e piattaforme che espongono API leggermente differenti.
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

// Separa errori dovuti a path mancanti da altre eccezioni durante l'accesso al filesystem.
// Consente al chiamante di reagire in modo differenziato rispetto ad altre failure.
function isMissingPathError(error) {
    if (!error) {
        return false
    }

    const message = String(error).toLowerCase()
    return message.includes('not found') || message.includes('no such file')
}

// Verifica l'esistenza della cartella report usando k6/experimental/fs senza tentare la creazione.
// Ritorna true/false quando lo stato è chiaro; undefined segnala che l'esito non è determinabile.
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
