import { BrsFile, XmlFile, DiagnosticSeverity, Range } from 'brighterscript';


import { File } from '../fileProcessing/File';

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
}import Binding from '../bindingSupport/Binding';


export function addProjectFileMapErrorDuplicateXMLComp(file: File, duplicatePath: string) {
  addErrorDiagnostic(file, 6908, `Found duplicate named xml component ${file.componentName}. The name is already used by ${duplicatePath}`, 0, 0);
}

export function addXMLTagErrorCorruptXMLElement(file: File, tagText: string) {
  addErrorDiagnostic(file, 6909, `Received corrupt XMLElement`, 0, 0);
}

export function addXMLTagErrorCouldNotParseBinding(file: File, tagText: string, message: string, line: number, col: number = 9999) {
  addErrorDiagnostic(file, 6910, `Could not parse binding: ${message}`, line, col);
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
}

export function addXMLTagErrorCouldMissingEndBrackets(file: File, tagText: string, line: number, col: number = 99999) {
  addErrorDiagnostic(file, 6913,
    `Binding could not be parsed: Missing matching end brackets.`, line, col);
}

export function addXMLTagErrorCouldNotParsefireOnSetForField(file: File, partText: string, tagText: string, line: number, col: number = 99999) {
  addErrorDiagnostic(file, 6914,
    `Could not parse fireOnSet for field`, line, col);
}

export function addXMLTagErrorCouldNotParseIsFiringOnceForField(file: File, partText: string,line: number, col: number = 99999) {
  addErrorDiagnostic(file, 6915,
    `Could not parse biding setting "${partText}"`, line, col);
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
  addErrorDiagnostic(file, 6922, `The VMClass specified "${file.vmClassTag.VMClass}" was not found.`);
}

export function addXmlBindingVMFieldNotFound(file: File, binding: Binding) {
  addErrorDiagnosticForBinding(file, 6923, `The bound field "${binding.observerField}" was not found in class "${file.vmClassTag.VMClass}".`, binding);
}

export function addXmlBindingVMFunctionNotFound(file: File, binding: Binding) {
  addErrorDiagnosticForBinding(file, 6924, `The event handling function "${binding.observerField}" was not found in class "${file.vmClassTag.VMClass}".`, binding);

}

export function addXmlBindingVMFunctionWrongArgCount(file: File, binding: Binding, expected: number) {
  addErrorDiagnosticForBinding(file, 6925, `The event handling function "${binding.observerField}" is configured with wrong number of params. Was expecting the function call to have ${expected} parameters.`, binding);
}

export function addXmlBindingUnknownFunctionArgs(file: File, binding: Binding) {
  addErrorDiagnosticForBinding(file, 6925, `The event handling function "${binding.observerField}" has an incorrect signature. You can call vm functions with the (), (value), (node), or (value, node)`, binding);
}
