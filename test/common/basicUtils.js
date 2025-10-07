export function toPositiveNumber(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export function toNonNegativeNumber(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export function toTrimmedString(value, fallback = '') {
    const trimmed = (value || '').toString().trim()
    return trimmed || fallback
}

export function formatValueForMessage(value) {
    if (value === undefined) {
        return 'undefined'
    }
    if (value === null) {
        return 'null'
    }
    if (typeof value === 'string') {
        return value.length === 0 ? '"" (empty string)' : `"${value}"`
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
        return String(value)
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false'
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value)
        } catch {
            return '[object]'
        }
    }
    return String(value)
}
