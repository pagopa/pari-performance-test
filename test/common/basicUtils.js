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

export function toFiniteNumber(value) {
    if (value === undefined || value === null) {
        return undefined
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}

export function formatTimestamp(date) {
    const pad = (value) => value.toString().padStart(2, '0')
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
        date.getDate()
    )}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

export function formatMs(value) {
    const number = toFiniteNumber(value)
    if (number === undefined) {
        return 'n/a'
    }

    return `${number.toFixed(2)} ms`
}

export function formatCount(value) {
    const number = toFiniteNumber(value)
    if (number === undefined) {
        return 'n/a'
    }

    return number.toString()
}

export function formatPercentage(value) {
    const number = toFiniteNumber(value)
    if (number === undefined) {
        return 'n/a'
    }

    return `${(number * 100).toFixed(2)} %`
}
