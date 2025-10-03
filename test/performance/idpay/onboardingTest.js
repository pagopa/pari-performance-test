import { SharedArray } from 'k6/data';
import { getMockLogin } from '../../common/api/mockIOLogin.js';
import { saveOnboarding } from '../../common/api/onboardingClient.js';

// Load the list of 10M CFs from a CSV file
const fiscalCodes = new SharedArray('fiscalCodes', () => {
  const csv = open(__ENV.CF_LIST_PATH || 'fiscal_codes.csv');
  return csv.split('\n').map(line => line.trim()).filter(line => line);
});

const usedFiscalCodes = new Set();

export const options = {
  scenarios: {
    onboardingTest: {
      executor: 'shared-iterations',
      iterations: fiscalCodes.length, // Ensure each CF is used exactly once
      vus: __ENV.VUS || 10, // Number of virtual users
    },
  },
};

const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || '')
if (!baseUrl) {
  throw new Error(`Missing APIM_URL for environment: ${targetEnv}`)
}

const initiativeId = '68de7fc681ce9e35a476e985'

export default function () {
  // Get a unique fiscal code for this iteration
  const fiscalCode = fiscalCodes[__ITER];
  if (usedFiscalCodes.has(fiscalCode)) {
    console.error(`Fiscal code already used: ${fiscalCode}`);
    return;
  }
  usedFiscalCodes.add(fiscalCode);

  // Generate token using mockIOLogin
  const tokenResponse = getMockLogin(fiscalCode);
  if (tokenResponse.status !== 200) {
    console.error(`Failed to generate token for CF: ${fiscalCode} - Status: ${tokenResponse.status}`);
    return;
  }
  const token = tokenResponse.body;

  const payload = {
    initiativeId: initiativeId,
    confirmedTos: true,
    pdndAccept: true,
    selfDeclarationList: [
      {
        code: 'ISEE',
        value: '15000',
      },
      {
        code: 'RESIDENCE',
        value: 'Rome',
      },
    ],
  };

  try {
    const response = saveOnboarding(baseUrl, token, payload);
    console.log(`Onboarding successful for CF: ${fiscalCode}`);
  } catch (error) {
    console.error(`Onboarding failed for CF: ${fiscalCode} - ${error.message}`);
  }
}