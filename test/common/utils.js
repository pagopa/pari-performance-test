import { randomString, randomIntBetween, } from 'https://jslib.k6.io/k6-utils/1.1.0/index.js'
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js'
import exec from 'k6/execution'
import { randomBytes } from 'k6/crypto';
import { CONFIG } from './dynamicScenarios/envVars.js'


export function randomFiscalCode() {
    '^([A-Za-z]{6}[0-9lmnpqrstuvLMNPQRSTUV]{2}[abcdehlmprstABCDEHLMPRST]{1}[0-9lmnpqrstuvLMNPQRSTUV]{2}[A-Za-z]{1}[0-9lmnpqrstuvLMNPQRSTUV]{3}[A-Za-z]{1})$'

    const name = randomString(6)
    const randDate = randomDate(new Date(1970, 0, 1), new Date(2000, 0, 1))
    const birth_y = randDate.getFullYear().toString().substring(2)
    const birth_m = getFiscalCodeMonth(randDate.getMonth() + 1)
    const isFemale = randomBytes(1)[0] < 0.5
    let birth_d = (randDate.getDay() + (isFemale ? 40 : 0) + 1).toString()
    birth_d = birth_d.length == 1 ? `0${birth_d}` : birth_d
    const final = [
        randomString(1),
        (100 + Math.floor(randomBytes(1)[0] * 899)).toString(),
        randomString(1),
    ].join('')
    return [name, birth_y, birth_m, birth_d, final].join('')
}

export function randomDate(start, end) {
    return new Date(
        start.getTime() + randomBytes(1)[0] * (end.getTime() - start.getTime())
    )
}

export function randomVatNumber() {
    return randomIntBetween(10000000000, 99999999999)
}

export function chooseRandomPanFromList(panList) {
    const index = randomIntBetween(0, panList.list.length - 1)
    return panList.list[index]
}

export function getRelativePathToRootFolder() {
    try {
        open('.')
    } catch (error) {
        const testFolderMatch = error.message.match('(?:\\\\|/)test(?:\\\\|/)')
        if (!testFolderMatch) {
            console.log(
                'WARNING! Unexpected folder structure, cannot found test folder'
            )
            return '../..'
        }
        const path = error.message.substr(testFolderMatch.index - 1)
        return path
            .match(/(\\\\|\/)/g)
            .map((x) => '..')
            .join('/')
    }
    return '../..'
}

export const csvDelimiter = coalesce(__ENV.CSV_DELIMITER, '') // NOSONAR

export function getCsvData(filePath, hasHeader) {
    if (hasHeader === undefined) {
        hasHeader = true
    }

    return papaparse
        .parse(open(filePath), {
            header: hasHeader,
            delimiter: csvDelimiter,
        })
        .data.filter((r) => Object.values(r)[0])
}

function getFiscalCodeMonth(month) {
    const monthDict = {
        1: 'A',
        2: 'B',
        3: 'C',
        4: 'D',
        5: 'E',
        6: 'H',
        7: 'L',
        8: 'M',
        9: 'P',
        10: 'R',
        11: 'S',
        12: 'T',
    }
    return monthDict[month]
}

export function coalesce(o1, o2) {
    return o1 !== undefined && o1 !== null ? o1 : o2
}

export function abort(description) {
    description = `Aborting execution due to: ${description}`
    if (exec) {
        console.error(description)
        exec.test.abort()
    } else {
        throw new Error(description)
    }
}

export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        let r = randomBytes(1)[0] % 16;
        let v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function getCategoryFromProductGroup(productGroup, product = {}) {
    const mapping = {
        washingmachines2019: 'WASHINGMACHINES',
        washerdriers2019: 'WASHERDRIERS',
        ovens: 'OVENS',
        rangehoods: 'RANGEHOODS',
        dishwashers2019: 'DISHWASHERS',
        tumbledryers20232534: 'TUMBLEDRYERS',
        refrigeratingappliances2019: 'REFRIGERATINGAPPL',
        cookinghobs: 'COOKINGHOBS'
    }

    const normalizedGroup = productGroup?.toLowerCase()
    if (normalizedGroup && mapping[normalizedGroup]) {
        return mapping[normalizedGroup]
    }

    const gtin = product.gtinCode?.toLowerCase() || ''
    const category = product.category?.toLowerCase() || ''

    if (gtin.includes('cookinghobs') || category.includes('piano cottura')) {
        return mapping['cookinghobs']
    }

    return null
}

const CategoriesEnum = {
    WASHINGMACHINES: 'WASHINGMACHINES',
    WASHERDRIERS: 'WASHERDRIERS',
    OVENS: 'OVENS',
    RANGEHOODS: 'RANGEHOODS',
    DISHWASHERS: 'DISHWASHERS',
    TUMBLEDRYERS: 'TUMBLEDRYERS',
    REFRIGERATINGAPPL: 'REFRIGERATINGAPPL',
    COOKINGHOBS: 'COOKINGHOBS'
};

export function getRandomCategory() {
    const categories = Object.values(CategoriesEnum);
    const randomIndex = Math.floor(Math.random() * categories.length); //NOSONAR
    return categories[randomIndex];
}

export const ORG_IDS = {
  dev_eie: '72c2c5f8-1c71-4614-a4b3-95e3aee71c3d',
  uat_eie: '8bd31e63-a8e8-4cbc-b06d-bc69f32c3fde'
}

export function getOrgId(operationAvailableEnvs, system) {
  const env = CONFIG.TARGET_ENV

  if (
    !operationAvailableEnvs.includes(env)
  ) {
    abort('Environment selected not allowed for orgId resolution')
    return null
  }

  const key = `${env}_${system}`
  const orgId = ORG_IDS[key]

  if (!orgId) {
    abort(`Missing orgId for key: ${key}`)
    return null
  }

  return orgId
}