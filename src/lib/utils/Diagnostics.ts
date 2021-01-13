import { BrsFile, XmlFile, DiagnosticSeverity, Range } from 'brighterscript';


import { File } from '../files/File';

function addErrorDiagnostic(
  file: File,
  code: number,
  message: string,
  startLine: number = 0,
  startCol: number = 0,
  endLine: number = -1,
  endCol: number = 99999
) {
  endLine = endLine === -1 ? startLine : endLine;
  file.diagnostics.push(createDiagnostic(file.bscFile, code, message, startLine, startCol, endLine, endCol, DiagnosticSeverity.Error));
}
function addErrorDiagnosticForBinding(
  file: File,
  code: number,
  message: string,
  binding: Binding
) {
  file.diagnostics.push(createDiagnostic(file.bscFile, code, message, binding.line, binding.char, binding.line, binding.endChar, DiagnosticSeverity.Error));
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
  endLine = endLine < startLine ? startLine : endLine;

  const diagnostic = {
    code: code,
    message: message,
    range: Range.create(startLine, startCol, endLine, endCol),
    file: bscFile,
    severity: severity
  };
  return diagnostic;
}

function addDiagnosticWithFileOffset(
  file: File,
  code: number,
  message: string,
  startOffset: number,
  endOffset: number,
  severity: DiagnosticSeverity = DiagnosticSeverity.Error
) {

  let start = file.getPositionFromOffset(startOffset);
  let end = file.getPositionFromOffset(endOffset);
  file.diagnostics.push({
    code: code,
    message: message,
    range: Range.create(start.line, start.character, end.line, end.character),
    file: file.bscFile,
    severity: severity
  });
}

/**
 * Public methods
 */
export function addXmlBindingNoCodeBehind(file: File) {
  addErrorDiagnostic(
    file,
    6900,
    'This XML file has bindings; but there is no code behind file!',
  );
}

export function addXmlBindingCouldNotParseXML(file: File, message: string) {
  addErrorDiagnostic(
    file,
    6903,
    'Could not parse xml in file: ' + message,
  );

}

export function addXmlBindingParentHasDuplicateField(file: File, id: string, line: number = 0, col: number = 0) {
  addErrorDiagnostic(
    file,
    6904,
    'a parent of this xml file contains duplicate field id: ' + id,
    line,
    col
  );
}

export function addXmlBindingErrorValidatingBindings(file: File, message: string) {
  addErrorDiagnostic(
    file,
    6905,
    'Error while validating bindings' + message,
    0,
    0,
  );
}

export function addBuildTimeErrorImportMissingKey(file: XmlFile | BrsFile, buildKey: string, line: number = 0, col: number = 0) {
  file.addDiagnostics([createDiagnostic(file, 6906, `xml file imports a build time import key that was not defined in your config:file that cannot be found ${buildKey}`, line, col)]);
}

export function addBuildTimeErrorImportMissingPkg(file: XmlFile | BrsFile, pkg: string, line: number = 0, col: number = 0) {
  file.addDiagnostics([createDiagnostic(file, 6907, `xml file imports a build time import, which contains a pkg of a file that cannot be found ${pkg}`, line, col)]);
} import Binding from '../binding/Binding';
import { XMLTag } from '../binding/XMLTag';


export function addProjectFileMapErrorDuplicateXMLComp(file: File, duplicatePath: string) {
  addErrorDiagnostic(file, 6908, `Found duplicate named xml component ${file.componentName}. The name is already used by ${duplicatePath}`, 0, 0);
}

export function addXMLTagErrorCorruptXMLElement(file: File, tagText: string) {
  addErrorDiagnostic(file, 6909, `Received corrupt XMLElement`, 0, 0);
}

export function addXMLTagErrorCouldNotParseBinding(file: File, tagText: string, message: string, line: number, col: number = 9999) {
  addErrorDiagnostic(file, 6910, `Could not parse binding: ${message}`, line, col);
  file.failedBindings.push(file.diagnostics.pop());
}

export function addXMLTagErrorCouldNotParseBindingDetailsForField(file: File, partText: string, tagText: string, line: number, col: number = 99999) {
  addErrorDiagnostic(file, 6911,
    `Could not parse binding details`, line, col);
}

export function addXMLTagErrorCouldNotParseBindingModeDetailsForField(file: File, partText: string, tagText: string, line: number, col: number = 99999) {
  addErrorDiagnostic(file, 6912,
    `Could not parse binding mode`, line, col);
}

export function addXMLTagErrorCouldNotParseBindingTransformFunctionForField(file: File, partText: string, tagText: string, line: number, col: number = 99999) {
  addErrorDiagnostic(file, 6913,
    `Could not parse transformFunction"`, line, col);
  file.failedBindings.push(file.diagnostics.pop());
}

export function addXMLTagErrorCouldMissingEndBrackets(file: File, tagText: string, line: number, col: number = 99999) {
  addErrorDiagnostic(file, 6913,
    `Binding could not be parsed: Missing matching end brackets.`, line, col);
  file.failedBindings.push(file.diagnostics.pop());
}

export function addXMLTagErrorCouldNotParsefireOnSetForField(file: File, partText: string, tagText: string, line: number, col: number = 99999) {
  addErrorDiagnostic(file, 6914,
    `Could not parse fireOnSet for field`, line, col);
}

export function addXMLTagErrorCouldNotParseIsFiringOnceForField(file: File, partText: string, binding: Binding) {
  addErrorDiagnosticForBinding(file, 6915,
    `Could not parse binding setting "${partText}" - valid settings are 'once', 'fireonset' and 'transform'`, binding);
  file.failedBindings.push(file.diagnostics.pop());
}

export function addFileErrorCouldNotSave(file: File) {
  addErrorDiagnostic(file, 6916, `could not save file at path ${file.fullPath} - does the path exist?`);
}

export function addFileErrorCouldNotParseXML(file: File, message: string) {
  addErrorDiagnostic(file, 6917, 'Could not parse xml in file: ' + message);
}

export function addXmlBindingDuplicateTag(file: File, field: string, line: number, col: number = 9999) {
  addErrorDiagnostic(file, 6918, `Could not parse binding the id is already used in another xml element: ${field}`, line, col);
}

export function addXmlBindingDuplicateField(file: File, field: string, line: number, col: number = 9999) {
  addErrorDiagnostic(file, 6919, `Could not parse binding id is already used in another interface field: ${field}`, line, col);
}
export function addCorruptVMType(file: File, line: number, col: number = 9999) {
  addErrorDiagnostic(file, 6920, `Could not pass VMClass field`, line, col);
}

export function addXmlBindingNoVMClassDefined(file: File) {
  addErrorDiagnostic(file, 6921, `The VMClass field was not set. Please add a field "<field id='vmclass' type='string' value='YOUR_CLASS'/>" so that maestro can give you accurate binding validations.`);

}

export function addXmlBindingVMClassNotFound(file: File) {
  addDiagnosticWithFileOffset(file, 6922, `The VMClass specified "${file.vmClassName}" was not found.`, file.componentTag.startPosition, file.componentTag.endPosition);
}

export function addXmlBindingVMFieldNotFound(file: File, binding: Binding) {
  addErrorDiagnosticForBinding(file, 6923, `The bound field "${binding.observerField}" was not found in class "${file.vmClassName}".`, binding);
  file.failedBindings.push(file.diagnostics.pop());
}

export function addXmlBindingVMFunctionNotFound(file: File, binding: Binding) {
  addErrorDiagnosticForBinding(file, 6924, `The event handling function "${binding.observerField}" was not found in class "${file.vmClassName}".`, binding);
  file.failedBindings.push(file.diagnostics.pop());

}

export function addXmlBindingVMFunctionWrongArgCount(file: File, binding: Binding, expected: number, actualParams: number) {
  addErrorDiagnosticForBinding(file, 6925, `The event handling function "${binding.observerField}" is configured with wrong number of params. Expected ${expected} parameters; function declaration has ${actualParams}`, binding);
  file.failedBindings.push(file.diagnostics.pop());
}

export function addXmlBindingUnknownFunctionArgs(file: File, binding: Binding) {
  addErrorDiagnosticForBinding(file, 6926, `The event handling function "${binding.observerField}" has an incorrect signature. You can call vm functions with the (), (value), (node), or (value, node)`, binding);
  file.failedBindings.push(file.diagnostics.pop());
}


export function addBuildTimeErrorImportNoImports(file: XmlFile | BrsFile, buildKey: string, line: number = 0, col: number = 0) {
  file.addDiagnostics([createDiagnostic(file, 6927, `This file imports a build time import key that is defined in bsConfig; but does not include any imports: ${buildKey}`, line, col, line, 99999, DiagnosticSeverity.Warning)]);
}

export function addNodeClassNoNodeRunMethod(file: BrsFile, line: number = 0, col: number = 0) {
  file.addDiagnostics([createDiagnostic(file, 6928, `Node classes must declare a function name nodeRun(args), which returns dynamic`, line, col)]);

}

export function addNodeClassNoExtendNodeFound(file: BrsFile, line: number = 0, col: number = 0, name: string, extendsName: string) {
  file.addDiagnostics([createDiagnostic(file, 6929, `Node class "${name}" extends component ${extendsName}, which cannot be found in scope. You must extend a Node, Task, Group or a custom node`, line, col)]);
}

export function addNodeClassDuplicateName(file: BrsFile, line: number = 0, col: number = 0, name: string) {
  file.addDiagnostics([createDiagnostic(file, 6930, `Node class name "${name}" is already used`, line, col)]);
}

export function addNodeClassBadDeclaration(file: BrsFile, line: number = 0, col: number = 0, text: string) {
  file.addDiagnostics([createDiagnostic(file, 6931, `Could not interpret node class annotation "${text}". Should be "'@MNode|MTask [name] extends [baseCompName]`, line, col)]);
}

export function addNodeClassNeedsClassDeclaration(file: BrsFile, line: number = 0, col: number = 0) {
  file.addDiagnostics([createDiagnostic(file, 6932, `Node class annotation must immediately precede the target class; but no class statement was found`, line, col)]);
}

export function addNodeClassNeedsNewDeclaration(file: BrsFile, line: number = 0, col: number = 0) {
  file.addDiagnostics([createDiagnostic(file, 6933, `Node classes must define a constructor that takes 2 arguments (m.top, and m.top.data (i.e. the data passed into your node))`, line, col)]);
}

export function addXmlBindingVMFieldRequired(file: File, binding: Binding) {
  addErrorDiagnosticForBinding(file, 6924, `Field bindings are only available for vm fields. Cannot bind to vm function "${binding.observerField}" in class "${file.vmClassName}".`, binding);
  file.failedBindings.push(file.diagnostics.pop());
}
