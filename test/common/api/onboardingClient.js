import http from 'k6/http';
import { logResult } from '../dynamicScenarios/utils.js';

/**
 * Calls the PUT /onboarding endpoint.
 * @param {string} baseUrl - The base URL for the API.
 * @param {string} token - The Authorization Bearer token.
 * @param {string} initiativeId - The initiative ID.
 * @param {Object} payload - The request body payload.
 * @param {string} acceptLanguage - The language header (e.g., 'it-IT').
 * @returns {Object} - The response from the API.
 */
export function saveOnboarding(baseUrl, token, payload, acceptLanguage = 'it-IT') {
  const url = `${baseUrl}/onboarding`;

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept-Language': acceptLanguage,
  };

  const res = http.put(url, JSON.stringify(payload), { headers, tags: { apiName: 'saveOnboarding' } });

  logResult('saveOnboarding', res);

  if (res.status !== 200) {
    throw new Error(`API Error: ${res.status} - ${res.body}`);
  }

  return res.json();
}