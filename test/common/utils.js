import { randomString, randomIntBetween, } from 'https://jslib.k6.io/k6-utils/1.1.0/index.js'
import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js'
import exec from 'k6/execution'
import { randomBytes } from 'k6/crypto';


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

export function getAllProductCategories() {
    return [
        'WASHINGMACHINES',
        'WASHERDRIERS',
        'OVENS',
        'RANGEHOODS',
        'DISHWASHERS',
        'TUMBLEDRYERS',
        'REFRIGERATINGAPPL',
        'COOKINGHOBS'
    ]
}

export function getAllProductStatuses() {
    return [
        'APPROVED',
        'SUPERVISED',
        'REJECTED',
        'UPLOADED',
        'WAIT_APPROVED'
    ]
}

export function getProductNameByCategory(category) {
    const productNamesByCategory = {
        WASHINGMACHINES: ['Lavatrice EcoWash', 'Lavatrice TurboSpin', 'Lavatrice SmartClean'],
        WASHERDRIERS: ['Lavasciuga DualCare', 'Lavasciuga CompactDry', 'Lavasciuga SteamPlus'],
        OVENS: ['Forno AirBake', 'Forno MaxHeat', 'Forno SmartCook'],
        RANGEHOODS: ['Cappa SilentFlow', 'Cappa PowerAir', 'Cappa SlimLine'],
        DISHWASHERS: ['Lavastoviglie AquaJet', 'Lavastoviglie EcoRinse', 'Lavastoviglie SmartDry'],
        TUMBLEDRYERS: ['Asciugatrice QuickDry', 'Asciugatrice HeatPump', 'Asciugatrice EcoSoft'],
        REFRIGERATINGAPPL: ['Frigorifero CoolTech', 'Frigorifero IceBox', 'Frigorifero SmartFreeze'],
        COOKINGHOBS: ['PianoCottura InductionPro', 'PianoCottura FlameMaster', 'PianoCottura FlexZone']
    }

    const names = productNamesByCategory[category]
    if (!names) return 'ProdottoGenerico'

    const index = Math.floor(Math.random() * names.length)
    return names[index]
}