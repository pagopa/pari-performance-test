import http from 'k6/http'

/**
 * Calls the onboarding status endpoint.
 * @param {string} baseUrl - The base URL for the API.
 * @param {string} initiativeId - The initiative ID.
 * @param {string} token - The Bearer token for authorization.
 * @returns {Response} - The k6 HTTP response object.
 */
export function getOnboardingStatus(baseUrl, initiativeId, token) {
    const url = `${baseUrl}/onboarding/${initiativeId}/status`
    const headers = {
        'X-Api-Version': 'v1',
        Accept: 'application/json',
        'Accept-Language': 'it-IT',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    }
    return http.get(url, { headers })
}
