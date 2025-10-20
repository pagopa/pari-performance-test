import { SharedArray } from 'k6/data';

/**
 * Carica un file CSV e restituisce un SharedArray con i valori filtrati.
 * @param {string} name - Nome identificativo del SharedArray.
 * @param {string} filePath - Percorso relativo del file CSV da leggere.
 * @returns {SharedArray} SharedArray contenente i dati.
 */
export function loadCsvArray(name, filePath) {
  return new SharedArray(name, () => {
    const csv = open(filePath);
    return csv
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line !== 'CF');
  });
}
