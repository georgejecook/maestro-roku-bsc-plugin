import type { BrsFile, ClassMethodStatement, ClassStatement, Expression, FunctionStatement, LiteralExpression, Statement } from 'brighterscript';
import { createVariableExpression } from 'brighterscript';

// eslint-disable-next-line @typescript-eslint/no-duplicate-imports
import * as brighterscript from 'brighterscript';

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
    let tokens = brighterscript.Lexer.scan(source).tokens;
    let { statements } = brighterscript.Parser.parse(tokens, { mode: brighterscript.ParseMode.BrighterScript });
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
    if (brighterscript.isClassStatement(statement)) {
        let classStatement = statement as ClassStatement;
        target.body.push(classStatement.methods[0]);
        return true;
    }
    return false;
}

export function changeClassMethodBody(target: ClassStatement, name: string, source: Statement[] | string): boolean {
    let method = target.methods.find((m) => m.name.text === name);
    if (brighterscript.isClassMethodStatement(method)) {
        changeFunctionBody(method, source);
        return true;
    }
    return false;
}

export function sanitizeBsJsonString(text: string) {
    return `"${text ? text.replace(/"/g, '\'') : ''}"`;
}

export function createIfStatement(condition: Expression, statements: Statement[]): brighterscript.IfStatement {
    let ifToken = brighterscript.createToken(brighterscript.TokenKind.If, 'if', brighterscript.Range.create(1, 1, 1, 999999));
    let thenBranch = new brighterscript.Block(statements, brighterscript.Range.create(1, 1, 1, 1));
    return new brighterscript.IfStatement({ if: ifToken, then: brighterscript.createToken(brighterscript.TokenKind.Then, '', brighterscript.Range.create(1, 1, 1, 999999)) }, condition, thenBranch);
}

export function createVarExpression(varName: string, operator: brighterscript.TokenKind, value: string): brighterscript.BinaryExpression {
    let variable = createVariableExpression(varName, brighterscript.Range.create(1, 1, 1, 999999));
    let v = brighterscript.createStringLiteral(value, brighterscript.Range.create(1, 1, 1, 999999));

    let t = brighterscript.createToken(operator, getTokenText(operator), brighterscript.Range.create(1, 1, 1, 999999));
    return new brighterscript.BinaryExpression(variable, t, v);
}

export function getTokenText(operator: brighterscript.TokenKind): string {
    switch (operator) {
        case brighterscript.TokenKind.Equal:
            return '=';
        case brighterscript.TokenKind.Plus:
            return '+';
        case brighterscript.TokenKind.Minus:
            return '-';
        case brighterscript.TokenKind.Less:
            return '<';
        case brighterscript.TokenKind.Greater:
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
    if (brighterscript.isUnaryExpression(expr) && brighterscript.isLiteralNumber(expr.right)) {
        return numberExpressionToValue(expr.right, expr.operator.text).toString();
    }
    if (brighterscript.isLiteralString(expr)) {
        //remove leading and trailing quotes
        return `"${expr.token.text.replace(/^"/, '').replace(/"$/, '')}"`;
    }
    if (brighterscript.isLiteralNumber(expr)) {
        return numberExpressionToValue(expr).toString();
    }

    if (brighterscript.isLiteralBoolean(expr)) {
        return expr.token.text.toLowerCase() === 'true' ? 'true' : 'false';
    }
    if (brighterscript.isArrayLiteralExpression(expr)) {
        return `[${expr.elements
            .filter(e => !brighterscript.isCommentStatement(e))
            .map(e => expressionToString(e))}]`;
    }
    if (brighterscript.isAALiteralExpression(expr)) {
        let text = `{${expr.elements.reduce((acc, e) => {
            if (!brighterscript.isCommentStatement(e)) {
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
    if (brighterscript.isUnaryExpression(expr) && brighterscript.isLiteralNumber(expr.right)) {
        return numberExpressionToValue(expr.right, expr.operator.text);
    }
    if (brighterscript.isLiteralString(expr)) {
        //remove leading and trailing quotes
        return expr.token.text.replace(/^"/, '').replace(/"$/, '');
    }
    if (brighterscript.isLiteralNumber(expr)) {
        return numberExpressionToValue(expr);
    }

    if (brighterscript.isLiteralBoolean(expr)) {
        return expr.token.text.toLowerCase() === 'true';
    }
    if (brighterscript.isArrayLiteralExpression(expr)) {
        return expr.elements
            .filter(e => !brighterscript.isCommentStatement(e))
            .map(e => expressionToValue(e));
    }
    if (brighterscript.isAALiteralExpression(expr)) {
        return expr.elements.reduce((acc, e) => {
            if (!brighterscript.isCommentStatement(e)) {
                acc[e.keyToken.text] = expressionToValue(e.value);
            }
            return acc;
        }, {});
    }
    return undefined;
}

function numberExpressionToValue(expr: LiteralExpression, operator = '') {
    if (brighterscript.isIntegerType(expr.type) || brighterscript.isLongIntegerType(expr.type)) {
        return parseInt(operator + expr.token.text);
    } else {
        return parseFloat(operator + expr.token.text);
    }
}

export function createImportStatement(pkgPath: string, range: brighterscript.Range) {
    let importToken = brighterscript.createToken(brighterscript.TokenKind.Import, 'import', range);
    let filePathToken = brighterscript.createToken(brighterscript.TokenKind.SourceFilePathLiteral, `"${sanitizePkgPath(pkgPath)}"`, range);
    return new brighterscript.ImportStatement(importToken, filePathToken);
}

export function addImport(file: BrsFile, pkgPath: string) {
    let existingImports = file.parser.ast.statements.find((el) => brighterscript.isImportStatement(el) && el.filePath === pkgPath);
    if (!existingImports) {
        let importStatement = createImportStatement(pkgPath, createRange(brighterscript.Position.create(1, 1)));
        file.parser.ast.statements = [importStatement, ...file.parser.ast.statements];
        file.parser.invalidateReferences();
        file.ownScriptImports.push({
            pkgPath: pkgPath,
            text: `import "${sanitizePkgPath(pkgPath)}"`,
            sourceFile: file
        });
        //re-attach the dependency graph which tells the xml file this has changed

        // eslint-disable-next-line @typescript-eslint/dot-notation
        let dg = file.program['dependencyGraph'];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        file.attachDependencyGraph(dg);
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

