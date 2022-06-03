import type { AstEditor, BrsFile, ClassMethodStatement, ClassStatement, DottedGetExpression, Expression, FunctionStatement, LiteralExpression, Statement } from 'brighterscript';
import { Range, createVariableExpression, isDottedGetExpression, isVariableExpression, BinaryExpression, Block, createStringLiteral, createToken, IfStatement, ImportStatement, isAALiteralExpression, isArrayLiteralExpression, isClassMethodStatement, isClassStatement, isCommentStatement, isImportStatement, isIntegerType, isLiteralBoolean, isLiteralNumber, isLiteralString, isLongIntegerType, isUnaryExpression, Lexer, ParseMode, Parser, Position, TokenKind } from 'brighterscript';
import * as rokuDeploy from 'roku-deploy';
import { createRange } from './utils/Utils';

export function spliceString(str: string, index: number, count: number, add: string): string {
    // We cannot pass negative indexes directly to the 2nd slicing operation.
    if (index < 0) {
        index = str.length + index;
        if (index < 0) {
            index = 0;
        }
    }

    return str.slice(0, index) + (add || '') + str.slice(index + count);
}

export function getRegexMatchesValues(input, regex, groupIndex): any[] {
    let values = [];
    let matches: any[];
    // eslint-disable-next-line
    while (matches = regex.exec(input)) {
        values.push(matches[groupIndex]);
    }
    return values;
}
export function getRegexMatchValue(input, regex, groupIndex): string {
    let matches: any[];
    // eslint-disable-next-line
    while (matches = regex.exec(input)) {
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

export function makeASTFunction(source: string): FunctionStatement | undefined {
    let tokens = Lexer.scan(source).tokens;
    let { statements } = Parser.parse(tokens, { mode: ParseMode.BrighterScript });
    if (statements && statements.length > 0) {
        return statements[0] as FunctionStatement;
    }
    return undefined;
}

export function getFunctionBody(source: string): Statement[] {
    let funcStatement = makeASTFunction(source);
    return funcStatement ? funcStatement.func.body.statements : [];
}

export function changeFunctionBody(statement: ClassMethodStatement | FunctionStatement, source: Statement[] | string) {
    let statements = statement.func.body.statements;
    statements.splice(0, statements.length);
    let newStatements = (typeof source === 'string') ? getFunctionBody(source) : source;
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

export function changeClassMethodBody(target: ClassStatement, name: string, source: Statement[] | string): boolean {
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
    let ifToken = createToken(TokenKind.If, 'if', Range.create(1, 1, 1, 999999));
    let thenBranch = new Block(statements, Range.create(1, 1, 1, 1));
    return new IfStatement({ if: ifToken, then: createToken(TokenKind.Then, '', Range.create(1, 1, 1, 999999)) }, condition, thenBranch);
}

export function createVarExpression(varName: string, operator: TokenKind, value: string): BinaryExpression {
    let variable = createVariableExpression(varName, Range.create(1, 1, 1, 999999));
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
        default:
            return '';
    }
}

/**
 * A tagged template literal function for standardizing the path. This has to be defined as standalone function since it's a tagged template literal function,
 * we can't use `object.tag` syntax.
 */
export function standardizePath(stringParts, ...expressions: any[]) {
    let result = [];
    for (let i = 0; i < stringParts.length; i++) {
        result.push(stringParts[i], expressions[i]);
    }
    return driveLetterToLower(
        rokuDeploy.standardizePath(
            result.join('')
        )
    );
}

function driveLetterToLower(fullPath: string) {
    if (fullPath) {
        let firstCharCode = fullPath.charCodeAt(0);
        if (
            //is upper case A-Z
            firstCharCode >= 65 && firstCharCode <= 90 &&
            //next char is colon
            fullPath[1] === ':'
        ) {
            fullPath = fullPath[0].toLowerCase() + fullPath.substring(1);
        }
    }
    return fullPath;
}


// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export function expressionToString(expr: Expression): string {
    if (!expr) {
        return 'invalid';
    }
    if (isUnaryExpression(expr) && isLiteralNumber(expr.right)) {
        return numberExpressionToValue(expr.right, expr.operator.text).toString();
    }
    if (isLiteralString(expr)) {
        //remove leading and trailing quotes
        return `"${expr.token.text.replace(/^"/, '').replace(/"$/, '')}"`;
    }
    if (isLiteralNumber(expr)) {
        return numberExpressionToValue(expr).toString();
    }

    if (isLiteralBoolean(expr)) {
        return expr.token.text.toLowerCase() === 'true' ? 'true' : 'false';
    }
    if (isArrayLiteralExpression(expr)) {
        return `[${expr.elements
            .filter(e => !isCommentStatement(e))
            .map(e => expressionToString(e))}]`;
    }
    if (isAALiteralExpression(expr)) {
        let text = `{${expr.elements.reduce((acc, e) => {
            if (!isCommentStatement(e)) {
                const sep = acc === '' ? '' : ', ';
                acc += `${sep}${e.keyToken.text}: ${expressionToString(e.value)}`;
            }
            return acc;
        }, '')}}`;
        return text;
    }
    return 'invalid';
}
export function expressionToValue(expr: Expression): any | undefined {
    if (!expr) {
        return undefined;
    }
    if (isUnaryExpression(expr) && isLiteralNumber(expr.right)) {
        return numberExpressionToValue(expr.right, expr.operator.text);
    }
    if (isLiteralString(expr)) {
        //remove leading and trailing quotes
        return expr.token.text.replace(/^"/, '').replace(/"$/, '');
    }
    if (isLiteralNumber(expr)) {
        return numberExpressionToValue(expr);
    }

    if (isLiteralBoolean(expr)) {
        return expr.token.text.toLowerCase() === 'true';
    }
    if (isArrayLiteralExpression(expr)) {
        return expr.elements
            .filter(e => !isCommentStatement(e))
            .map(e => expressionToValue(e));
    }
    if (isAALiteralExpression(expr)) {
        return expr.elements.reduce((acc, e) => {
            if (!isCommentStatement(e)) {
                acc[e.keyToken.text] = expressionToValue(e.value);
            }
            return acc;
        }, {});
    }
    return undefined;
}

function numberExpressionToValue(expr: LiteralExpression, operator = '') {
    if (isIntegerType(expr.type) || isLongIntegerType(expr.type)) {
        return parseInt(operator + expr.token.text);
    } else {
        return parseFloat(operator + expr.token.text);
    }
}

export function createImportStatement(pkgPath: string, range: Range) {
    let importToken = createToken(TokenKind.Import, 'import', range);
    let filePathToken = createToken(TokenKind.SourceFilePathLiteral, `"${sanitizePkgPath(pkgPath)}"`, range);
    return new ImportStatement(importToken, filePathToken);
}

export function addImport(file: BrsFile, pkgPath: string, editor: AstEditor) {
    let existingImports = file.parser.ast.statements.find((el) => isImportStatement(el) && el.filePath === pkgPath);
    if (!existingImports) {
        let importStatement = createImportStatement(pkgPath, createRange(Position.create(1, 1)));
        editor.arrayUnshift(file.parser.ast.statements, importStatement);
        file.parser.invalidateReferences();
        //re-attach the dependency graph which tells the xml file this has changed
        file.attachDependencyGraph(
            // eslint-disable-next-line @typescript-eslint/dot-notation
            file.program['dependencyGraph']
        );
    }
}

/**
 * Handles replacing windows `\` with `/`. Also handles v0->v1 compatibility by prepending `pkg:/` if missing
 * @param pkgPath the full pkgPath of a file (with or without `pkg:/`). This MUST NOT be a relative path
 */
export function sanitizePkgPath(pkgPath: string) {
    pkgPath = pkgPath.replace(/[\\/]+/g, '/');
    if (!pkgPath.startsWith('pkg:/')) {
        pkgPath = `pkg:/${pkgPath}`;
    }
    return pkgPath;
}

export function getAllDottedGetParts(dg: DottedGetExpression) {
    let parts = [dg?.name?.text];
    let nextPart = dg.obj;
    while (isDottedGetExpression(nextPart) || isVariableExpression(nextPart)) {
        parts.push(nextPart?.name?.text);
        nextPart = isDottedGetExpression(nextPart) ? nextPart.obj : undefined;
    }
    return parts.reverse();
}


