import { BrsFile, Token, TokenKind, XmlFile } from 'brighterscript';
import { BrsType } from 'brighterscript/dist/brsTypes';
import * as path from 'path';

import { Position, Range } from 'vscode-languageserver';

// import { ProjectFileMap } from '../fileProcessing/ProjectFileMap';

export function spliceString(str: string, index: number, add?: string): string {
  // We cannot pass negative indexes directly to the 2nd slicing operation.
  if (index < 0) {
    index = str.length + index;
    if (index < 0) {
      index = 0;
    }
  }

  return (
    str.slice(0, index) + (add || '') + str.slice(index + (add || '').length)
  );
}

export function getRegexMatchesValues(input, regex, groupIndex): any[] {
  let values = [];
  let matches: any[];
  regex.lastIndex = 0;
  while ((matches = regex.exec(input))) {
    values.push(matches[groupIndex]);
  }
  return values;
}
export function getRegexMatchValue(input, regex, groupIndex): string {
  let matches: any[];
  while ((matches = regex.exec(input))) {
    if (matches.length > groupIndex) {
      return matches[groupIndex];
    }
  }
  return null;
}

export function addSetItems(setA, setB) {
  for (const elem of setB) {
    setA.add(elem);
  }
}

export function pad(pad: string, str: string, padLeft: number): string {
  if (typeof str === 'undefined') {
    return pad;
  }
  if (padLeft) {
    return (pad + str).slice(-pad.length);
  } else {
    return (str + pad).substring(0, pad.length);
  }
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export function getAlternateFileNames(fileName: string): string[] {
  if (fileName !== undefined && fileName.toLowerCase().endsWith('.brs')) {
    return [fileName.substring(0, fileName.length - 4) + '.xml'];
  } else if (fileName !== undefined && fileName.toLowerCase().endsWith('.bs')) {
    return [fileName.substring(0, fileName.length - 3) + '.xml'];
  } else if (
    fileName !== undefined &&
    fileName.toLowerCase().endsWith('.xml')
  ) {
    return [fileName.substring(0, fileName.length - 4) + '.brs',
      fileName.substring(0, fileName.length - 4) + '.bs'];
  } else {
    return [];
  }
}

// export function getAssociatedFile(file: XmlFile | BrsFile, fileMap: ProjectFileMap): File | undefined {
//   for (let filePath of getAlternateFileNames(file.pathAbsolute)) {
//     let mFile = fileMap.allFiles.get(filePath);
//     if (mFile) {
//       return mFile;
//     }
//   }
//   return undefined;
// }

export function createToken(kind: TokenKind, pos: Position, text?: string, literal?: BrsType): Token {
  return {
    kind: kind,
    text: text || kind.toString(),
    isReserved: !text || text === kind.toString(),
    range: createRange(pos),
    literal: literal
  };
}

export function createRange(pos: Position) {
  return Range.create(pos.line, pos.character, pos.line, pos.character);
}
