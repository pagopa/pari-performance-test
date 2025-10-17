// Converte input generico in numero positivo; restituisce undefined se non valido.
// Utile per validare configurazioni numeriche (es. rate, durata) prima dell'uso in k6.
export function toPositiveNumber(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

// Converte input generico in numero non negativo; scarta NaN o valori inferiori a zero.
// Serve per parametri che accettano zero come valore legittimo (es. VUs minimi).
export function toNonNegativeNumber(value) {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

// Normalizza input stringa applicando trim e fallback opzionale quando il risultato è vuoto.
// Mantiene coerenti i confronti di stringhe provenienti da env o configurazioni JSON.
export function toTrimmedString(value, fallback = '') {
    const trimmed = (value || '').toString().trim()
    return trimmed || fallback
}

// Rende presentabile qualunque valore in messaggi di log o errori.
// Aggiunge virgolette alle stringhe, serializza oggetti e gestisce undefined/null in modo esplicito.
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

// Converte input in numero finito scartando null, undefined e valori non numerici.
// Ritorna undefined per mantenere semplice la successiva propagazione di fallback.
export function toFiniteNumber(value) {
    if (value === undefined || value === null) {
        return undefined
    }

    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
}

// Serializza una data in formato compatto YYYYMMDDHHmmss per usare nei nomi file.
// Evita separatori così i report risultano facilmente ordinabili e compatibili con ogni FS.
export function formatTimestamp(date) {
    const pad = (value) => value.toString().padStart(2, '0')
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
        date.getDate()
    )}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

// Converte metriche numeriche in stringhe con unità millisecondi, mostrando "n/a" quando assenti.
// Usa toFiniteNumber così valori non numerici non rompono il layout dei report.
export function formatMs(value) {
    const number = toFiniteNumber(value)
    if (number === undefined) {
        return 'n/a'
    }

    return `${number.toFixed(2)} ms`
}

// Converte conteggi in stringhe assicurando un fallback "n/a" per input mancanti.
// Impedisce che undefined finisca nei log di riepilogo rendendoli più leggibili.
export function formatCount(value) {
    const number = toFiniteNumber(value)
    if (number === undefined) {
        return 'n/a'
    }

    return number.toString()
}

// Calcola una percentuale formattata al 2° decimale partendo da un ratio (0..1).
// Quando il dato è assente restituisce "n/a" mantenendo uniforme la reportistica.
export function formatPercentage(value) {
    const number = toFiniteNumber(value)
    if (number === undefined) {
        return 'n/a'
    }

    return `${(number * 100).toFixed(2)} %`
}

// Restituisce true quando ogni carattere della stringa è una cifra (0..9).
// Usa una regex ancorata e senza quantificatori annidati, quindi non è soggetta a ReDoS.
// Esempio: isDigitsOnly("123") => true; isDigitsOnly("12a") => false.
function isDigitsOnly(value) {
    if (!value) {
        return false
    }
    return /^[0-9]+$/.test(value)
}

// Analizza chiavi come "p(95)" o "p(99.90)" in modo sicuro e leggibile.
// Esempi:
//   parsePercentileKey("p(95)") => 95
//   parsePercentileKey("p(99.9)") => 99.9
//   parsePercentileKey("p(foo)") => undefined
function parsePercentileKey(key) {
    if (typeof key !== 'string' || key.length < 4) {
        return undefined
    }

    if (!key.startsWith('p(') || key[key.length - 1] !== ')') {
        return undefined
    }

    const body = key.slice(2, -1)
    if (!body) {
        return undefined
    }

    const segments = body.split('.')
    if (segments.length > 2) {
        return undefined
    }

    if (!segments.every((segment) => isDigitsOnly(segment))) {
        return undefined
    }

    const numeric = Number(body)
    return Number.isFinite(numeric) ? numeric : undefined
}

// Restituisce il valore di percentile per una metrica trend se disponibile.
export function pickTrendPercentileValue(values, targetPercentile) {
    if (!values) {
        return undefined
    }

    const direct = toFiniteNumber(values[`p(${targetPercentile})`])
    if (direct !== undefined) {
        return direct
    }

    let candidatePercentile
    let candidateValue

    for (const [key, rawValue] of Object.entries(values)) {
        const percentile = parsePercentileKey(key)
        if (percentile === undefined) {
            continue
        }

        const value = toFiniteNumber(rawValue)

        if (!Number.isFinite(percentile) || value === undefined) {
            continue
        }

        const isBetterMatch =
            percentile >= targetPercentile &&
            (candidatePercentile === undefined || percentile < candidatePercentile)

        if (isBetterMatch) {
            candidatePercentile = percentile
            candidateValue = value
        }
    }

    return candidateValue
}

// Formatta un rate di richieste al secondo con due decimali.
export function formatRequestsRatePerSecond(rateValue) {
    const rate = toFiniteNumber(rateValue)
    if (rate === undefined) {
        return 'n/a'
    }

    return `${rate.toFixed(2)} req/s`
}
