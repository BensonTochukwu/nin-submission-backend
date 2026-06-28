export function normalizeStateCode(stateCode: string): string {
  return stateCode.trim().toUpperCase();
}

export function stateCodeToSafePdfFilename(stateCode: string): string {
  const safeName = normalizeStateCode(stateCode)
    .replace(/[^A-Z0-9]+/g, '');

  return `${safeName || 'STATE-CODE'}.pdf`;
}
