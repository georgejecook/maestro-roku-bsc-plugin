import { BrsFile, FunctionStatement, Statement, XmlFile } from 'brighterscript';
import { head } from 'lodash';

import { DiagnosticSeverity, Range } from 'vscode-languageserver';

function addDiagnostic(
  file: BrsFile,
  code: number,
  message: string,
  startLine: number = 0,
  startCol: number = 0,
  endLine: number = -1,
  endCol: number = 99999,
  severity: DiagnosticSeverity = DiagnosticSeverity.Error
) {
  endLine = endLine === -1 ? startLine : endLine;
  file.addDiagnostics([createDiagnostic(file, code, message, startLine, startCol, endLine, endCol, severity)]);
}

function addDiagnosticForStatement(
  file: BrsFile,
  code: number,
  message: string,
  statement: Statement,
  severity: DiagnosticSeverity = DiagnosticSeverity.Error
) {
  let line = statement.range.start.line;
  let col = statement.range.start.character;
  file.addDiagnostics([createDiagnostic(file, code, message, line, col, line, 999999, severity)]);
}

function createDiagnostic(
  bscFile: BrsFile | XmlFile,
  code: number,
  message: string,
  startLine: number = 0,
  startCol: number = 99999,
  endLine: number = 0,
  endCol: number = 99999,
  severity: DiagnosticSeverity = DiagnosticSeverity.Error
) {
  const diagnostic = {
    code: code,
    message: message,
    range: Range.create(startLine, startCol, endLine, endCol),
    file: bscFile,
    severity: severity
  };
  return diagnostic;
}

/**
 * Public methods
 */

export function diagnosticWrongAnnotation(file: BrsFile, statement: Statement, message: string) {
  addDiagnosticForStatement(
    file,
    2200,
    'Wrong kind of annotation.' + message,
    statement
  );
}

export function diagnosticNoGroup(file: BrsFile, statement: Statement) {
  addDiagnosticForStatement(
    file,
    2201,
    'Found test outside of a test group',
    statement
  );
}

export function diagnosticWrongParameterCount(file: BrsFile, statement: FunctionStatement, expectedParamCount = 0) {
  addDiagnosticForStatement(
    file,
    2201,
    `Function ${statement.name} defined with wrong number of params: expected ${expectedParamCount}`,
    statement
  );
}
