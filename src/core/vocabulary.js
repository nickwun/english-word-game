export function getBooks(vocabulary) {
  return vocabulary?.books ?? [];
}

export function getBookById(vocabulary, bookId) {
  return getBooks(vocabulary).find((book) => book.id === bookId);
}

export function getUnitsByBookId(vocabulary, bookId) {
  return getBookById(vocabulary, bookId)?.units ?? [];
}

export function getAllUnits(vocabulary) {
  return getBooks(vocabulary).flatMap((book) => book.units ?? []);
}

export function getUnits(vocabulary) {
  return getAllUnits(vocabulary);
}

export function getUnitById(vocabulary, unitId) {
  return getAllUnits(vocabulary).find((unit) => unit.id === unitId);
}

export function getLevelById(vocabulary, levelId) {
  return getAllUnits(vocabulary)
    .flatMap((unit) => unit.levels ?? [])
    .find((level) => level.id === levelId);
}

export function getWordById(vocabulary, wordId) {
  return getAllWords(vocabulary).find((word) => word.id === wordId);
}

export function getAllWords(vocabulary) {
  return getAllUnits(vocabulary).flatMap((unit) => getAllWordsForUnit(unit));
}

export function getWordsByUnitId(vocabulary, unitId) {
  return getAllWordsForUnit(getUnitById(vocabulary, unitId));
}

export function getLevelsByType(unit, type) {
  return (unit?.levels ?? [])
    .filter((level) => level.type === type)
    .sort((left, right) => left.order - right.order);
}

export function getAllWordsForUnit(unit) {
  return [
    ...(unit?.levels ?? []).flatMap((level) => level.words ?? []),
    ...(unit?.words ?? []),
  ];
}
