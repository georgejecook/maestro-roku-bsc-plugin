import * as assert from 'assert';
import chalk from 'chalk';
import type { Diagnostic, DiagnosticRelatedInformation, DiagnosticSeverity, DiagnosticTag, Range } from 'vscode-languageserver';
import { firstBy } from 'thenby';
import { getDiagnosticLine } from 'brighterscript/dist/diagnosticUtils';
import type { BsDiagnostic, BrsFile } from 'brighterscript';
import { expect } from 'chai';

type DiagnosticCollection = Diagnostic[] | { diagnostics?: Diagnostic[] } | { getDiagnostics(): Array<Diagnostic> };

function getDiagnostics(arg: DiagnosticCollection): BsDiagnostic[] {
    if (Array.isArray(arg)) {
        return arg as BsDiagnostic[];
    } else if ((arg as any).getDiagnostics) {
        return (arg as any).getDiagnostics();
    } else if ((arg as any).diagnostics) {
        return (arg as any).diagnostics;
    } else {
        throw new Error('Cannot derive a list of diagnostics from ' + JSON.stringify(arg));
    }
}

function sortDiagnostics(diagnostics: BsDiagnostic[]) {
    return diagnostics.sort(
        firstBy<BsDiagnostic>('code')
            .thenBy<BsDiagnostic>('message')
            .thenBy<BsDiagnostic>((a, b) => (a.range?.start?.line ?? 0) - (b.range?.start?.line ?? 0))
            .thenBy<BsDiagnostic>((a, b) => (a.range?.start?.character ?? 0) - (b.range?.start?.character ?? 0))
            .thenBy<BsDiagnostic>((a, b) => (a.range?.end?.line ?? 0) - (b.range?.end?.line ?? 0))
            .thenBy<BsDiagnostic>((a, b) => (a.range?.end?.character ?? 0) - (b.range?.end?.character ?? 0))
    );
}

function cloneObject<TOriginal, TTemplate>(original: TOriginal, template: TTemplate, defaultKeys: Array<keyof TOriginal>) {
    const clone = {} as Partial<TOriginal>;
    let keys = Object.keys(template ?? {}) as Array<keyof TOriginal>;
    //if there were no keys provided, use some sane defaults
    keys = keys.length > 0 ? keys : defaultKeys;

    //copy only compare the specified keys from actualDiagnostic
    for (const key of keys) {
        clone[key] = original[key];
    }
    return clone;
}

interface PartialDiagnostic {
    range?: Range;
    severity?: DiagnosticSeverity;
    code?: number | string;
    codeDescription?: Partial<{ uri: string }>;
    source?: string;
    message?: string;
    tags?: Partial<DiagnosticTag>[];
    relatedInformation?: Partial<DiagnosticRelatedInformation>[];
    data?: unknown;
    file?: Partial<File>;
}

/**
 *  Helper function to clone a Diagnostic so it will give partial data that has the same properties as the expected
 */
function cloneDiagnostic(actualDiagnosticInput: BsDiagnostic, expectedDiagnostic: BsDiagnostic) {
    const actualDiagnostic = cloneObject(
        actualDiagnosticInput,
        expectedDiagnostic,
        ['message', 'code', 'range', 'severity', 'relatedInformation']
    );
    //deep clone relatedInformation if available
    if (actualDiagnostic.relatedInformation) {
        for (let j = 0; j < actualDiagnostic.relatedInformation.length; j++) {
            actualDiagnostic.relatedInformation[j] = cloneObject(
                actualDiagnostic.relatedInformation[j],
                expectedDiagnostic?.relatedInformation[j],
                ['location', 'message']
            ) as any;
        }
    }
    //deep clone file info if available
    if (actualDiagnostic.file) {
        actualDiagnostic.file = cloneObject(
            actualDiagnostic.file,
            expectedDiagnostic?.file,
            ['srcPath', 'pkgPath', 'destPath', 'pkgPath'] as any[]
        ) as any;
    }
    return actualDiagnostic;
}


/**
 * Ensure the DiagnosticCollection exactly contains the data from expected list.
 * @param arg - any object that contains diagnostics (such as `Program`, `Scope`, or even an array of diagnostics)
 * @param expected an array of expected diagnostics. if it's a string, assume that's a diagnostic error message
 */
export function expectDiagnostics(arg: DiagnosticCollection, expected: Array<PartialDiagnostic | number | string>) {
    const actualDiagnostics = sortDiagnostics(
        getDiagnostics(arg)
    );
    const expectedDiagnostics = sortDiagnostics(
        expected.map(x => {
            let result = x;
            if (typeof x === 'string') {
                result = { message: x };
            } else if (typeof x === 'number') {
                result = { code: x };
            }
            return result as unknown as BsDiagnostic;
        })
    );

    const actual = [] as BsDiagnostic[];
    for (let i = 0; i < actualDiagnostics.length; i++) {
        const expectedDiagnostic = expectedDiagnostics[i];
        const actualDiagnostic = cloneDiagnostic(actualDiagnostics[i], expectedDiagnostic);
        actual.push(actualDiagnostic as any);
    }
    expect(actual).to.eql(expectedDiagnostics);
}

/**
 * Ensure the DiagnosticCollection includes data from expected list (note - order does not matter).
 * @param arg - any object that contains diagnostics (such as `Program`, `Scope`, or even an array of diagnostics)
 * @param expected an array of expected diagnostics. if it's a string, assume that's a diagnostic error message
 */
export function expectDiagnosticsIncludes(arg: DiagnosticCollection, expected: Array<PartialDiagnostic | number | string>) {
    const actualDiagnostics = [...getDiagnostics(arg)];
    const expectedDiagnostics =
        expected.map(x => {
            let result = x;
            if (typeof x === 'string') {
                result = { message: x };
            } else if (typeof x === 'number') {
                result = { code: x };
            }
            return result as unknown as BsDiagnostic;
        });

    let foundCount = 0;

    const misses = [];

    for (const expectedDiagnostic of expectedDiagnostics) {
        const index = actualDiagnostics.findIndex((actualDiag) => {
            const actualDiagnosticClone = cloneDiagnostic(actualDiag, expectedDiagnostic);
            return JSON.stringify(actualDiagnosticClone) === JSON.stringify(expectedDiagnostic);
        });
        if (index > -1) {
            actualDiagnostics.splice(index, 1);
            foundCount++;
        } else {
            misses.push(expectedDiagnostic);
        }
    }
    //if we didn't find some of the expected diagnostics, show a nicer error message
    if (misses.length > 0) {
        expect(
            //clone every diagnostic with the shape of the first miss, so it looks prettier
            actualDiagnostics.map(x => cloneDiagnostic(x, misses[0]))
        ).to.deep.include(
            misses[0]
        );
    }
    expect(foundCount).to.eql(expectedDiagnostics.length);
}

/**
 * Test that the given object has zero diagnostics. If diagnostics are found, they are printed to the console in a pretty fashion.
 */
export function expectZeroDiagnostics(arg: DiagnosticCollection) {
    const diagnostics = getDiagnostics(arg);
    if (diagnostics.length > 0) {
        let message = `Expected 0 diagnostics, but instead found ${diagnostics.length}:`;
        for (const diagnostic of diagnostics) {
            //escape any newlines
            diagnostic.message = diagnostic.message.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
            message += `\n        • bs${diagnostic.code} "${diagnostic.message}" at ${diagnostic.file?.srcPath ?? ''}#(${diagnostic.range.start.line}:${diagnostic.range.start.character})-(${diagnostic.range.end.line}:${diagnostic.range.end.character})`;
            //print the line containing the error (if we can find it)srcPath
            const line = (diagnostic.file as BrsFile)?.fileContents?.split(/\r?\n/g)?.[diagnostic.range.start.line];
            if (line) {
                message += '\n' + getDiagnosticLine(diagnostic as any, line, chalk.red);
            }
        }
        assert.fail(message);
    }
}

/**
 * Test if the arg has any diagnostics. This just checks the count, nothing more.
 * @param diagnosticsCollection a collection of diagnostics
 * @param length if specified, checks the diagnostic count is exactly that amount. If omitted, the collection is just verified as non-empty
 */
export function expectHasDiagnostics(diagnosticsCollection: DiagnosticCollection, length: number = null) {
    const diagnostics = getDiagnostics(diagnosticsCollection);
    if (length) {
        expect(diagnostics).lengthOf(length);
    } else {
        expect(diagnostics).not.empty;
    }
}
