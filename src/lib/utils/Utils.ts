import { Position, Range, BrsFile, Token, TokenKind, XmlFile, isClassMethodStatement, isClassStatement, ClassStatement, FunctionStatement, ClassMethodStatement, Statement, Parser, Lexer, ParseMode, Expression, Block, createToken, VariableExpression, createIdentifier, createStringLiteral, BinaryExpression, IfStatement } from 'brighterscript';
import * as path from 'path';

import { File } from '../files/File';
import { ProjectFileMap } from '../files/ProjectFileMap';
import { RawCodeStatement } from './RawCodeStatement';

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

export function getAssociatedFile(file: XmlFile | BrsFile, fileMap: ProjectFileMap): File | undefined {
  for (let filePath of getAlternateFileNames(file.pathAbsolute)) {
    let mFile = fileMap.allFiles.get(filePath);
    if (mFile) {
      return mFile;
    }
  }
  return undefined;
}


export function createRange(pos: Position) {
  return Range.create(pos.line, pos.character, pos.line, pos.character);
}

export function makeASTFunction(source: string): FunctionStatement | undefined {
  let tokens = Lexer.scan(source).tokens;
  let { statements, diagnostics } = Parser.parse(tokens, { mode: ParseMode.BrighterScript });
  if (statements && statements.length > 0) {
    return statements[0] as FunctionStatement;
  }
  return undefined;
}

export function getFunctionBody(source: string): Statement[] {
  let funcStatement = makeASTFunction(source);
  return funcStatement ? funcStatement.func.body.statements : [];
}

export function changeFunctionBody(statement: FunctionStatement | ClassMethodStatement, source: string) {
  let statements = statement.func.body.statements;
  statements.splice(0, statements.length);
  let newStatements = getFunctionBody(source);
  for (let newStatement of newStatements) {
    statements.push(newStatement);
  }
}

export function addOverriddenMethod(target: ClassStatement, name: string, source: string): boolean {
  let statement = makeASTFunction(`
  class wrapper
  override function ${name}()
    ${source}
  end function
  end class
  `);
  if (isClassStatement(statement)) {
    let classStatement = statement as ClassStatement;
    target.body.push(classStatement.methods[0]);
    return true;
  }
  return false;
}

export function changeClassMethodBody(target: ClassStatement, name: string, source: string): boolean {
  let method = target.methods.find((m) => m.name.text === name);
  if (isClassMethodStatement(method)) {
    changeFunctionBody(method, source);
    return true;
  }
  return false;
}

export function sanitizeBsJsonString(text: string) {
  return `"${text ? text.replace(/"/g, '\'') : ''}"`;
}

export function createIfStatement(condition: Expression, statements: Statement[]): IfStatement {
  let ifToken = createToken(TokenKind.If, 'else if', Range.create(1, 1, 1, 999999));
  ifToken.text = 'else if';
  let thenBranch = new Block(statements, Range.create(1, 1, 1, 1));
  return new IfStatement({if: ifToken, then: createToken(TokenKind.Then, '', Range.create(1, 1, 1, 999999))}, condition, thenBranch)
}

export function createVarExpression(varName: string, operator: TokenKind, value: string): BinaryExpression {
  let variable = createIdentifier(varName, Range.create(1, 1, 1, 999999));
  let v = createStringLiteral(value, Range.create(1, 1, 1, 999999));

  let t = createToken(operator, getTokenText(operator), Range.create(1, 1, 1, 999999));
  return new BinaryExpression(variable, t, v);
}

export function getTokenText(operator: TokenKind): string {
  switch (operator) {
    case TokenKind.Equal:
      return '=';
    case TokenKind.Plus:
      return '+';
    case TokenKind.Minus:
      return '-';
    case TokenKind.Less:
      return '<';
    case TokenKind.Greater:
      return '>';
  }
  return '';
}
