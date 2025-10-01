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
