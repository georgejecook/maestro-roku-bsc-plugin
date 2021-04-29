import type { BrsFile, BscFile, XmlFile } from 'brighterscript';
import { isBrsFile, isXmlFile, DiagnosticSeverity, Range } from 'brighterscript';
import type Binding from '../binding/Binding';


import type { File } from '../files/File';

function addErrorDiagnostic(
    file: any,
    code: number,
    message: string,
    startLine = 0,
    startCol = 0,
    endLine = -1,
    endCol = 99999
) {
    endLine = endLine === -1 ? startLine : endLine;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    let targetFile = isBrsFile(file) || isXmlFile(file) ? file : file.bscFile;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    targetFile.diagnostics.push(createDiagnostic(targetFile, code, message, startLine, startCol, endLine, endCol, DiagnosticSeverity.Error));
}
function addErrorDiagnosticForBinding(
    file: File,
    code: number,
    message: string,
    binding: Binding
) {
    (file.bscFile as any).diagnostics.push(createDiagnostic(file.bscFile, code, message, binding.range.start.line, binding.range.start.character, binding.range.end.line, binding.range.end.character, DiagnosticSeverity.Error));
}

function createDiagnostic(
    bscFile: BrsFile | XmlFile,
    code: number,
    message: string,
    startLine = 0,
    startCol = 99999,
    endLine = 0,
    endCol = 99999,
    severity: DiagnosticSeverity = DiagnosticSeverity.Error
) {
    endLine = endLine < startLine ? startLine : endLine;

    const diagnostic = {
        code: `MSTO${code}`,
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
        'This XML file has bindings; but there is no code behind file!'
    );
}

export function addXmlBindingCouldNotParseXML(file: File, message: string) {
    addErrorDiagnostic(
        file,
        6903,
        'Could not parse xml in file: ' + message
    );

}

export function addXmlBindingParentHasDuplicateField(file: File, id: string, line = 0, col = 0) {
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
        0
    );
}

export function addBuildTimeErrorImportMissingKey(file: BrsFile | XmlFile, buildKey: string, line = 0, col = 0) {
    file.addDiagnostics([createDiagnostic(file, 1006, `xml file imports a build time import key that was not defined in your config:file that cannot be found ${buildKey}`, line, col)]);
}

export function addBuildTimeErrorImportMissingPkg(file: BrsFile | XmlFile, pkg: string, buildKey: string, line = 0, col = 0) {
    file.addDiagnostics([createDiagnostic(file, 1007, `xml file imports a build time import '${buildKey}', which contains a pkg of a file that cannot be found '${pkg}'`, line, col)]);
}

export function addProjectFileMapErrorDuplicateXMLComp(file: File, duplicatePath: string) {
    addErrorDiagnostic(file, 1008, `Found duplicate named xml component ${file.componentName}. The name is already used by ${duplicatePath}`, 0, 0);
}

export function addXMLTagErrorCorruptXMLElement(file: File, tagText: string) {
    addErrorDiagnostic(file, 1009, `Received corrupt XMLElement`, 0, 0);
}

export function addXMLTagErrorCouldNotParseBinding(file: File, tagText: string, message: string, range: Range) {
    addErrorDiagnostic(file, 1010, `Could not parse binding: ${message}`, range.start.line, range.start.character);
}

export function addXMLTagErrorCouldNotParseBindingDetailsForField(file: File, partText: string, tagText: string, range: Range) {
    addErrorDiagnostic(file, 1011,
        `Could not parse binding details`, range.start.line, range.start.character);
}

export function addXMLTagErrorCouldNotParseBindingModeDetailsForField(file: File, partText: string, tagText: string, line: number, range: Range) {
    addErrorDiagnostic(file, 1012,
        `Could not parse binding mode`, range.start.line, range.start.character);
}

export function addXMLTagErrorCouldNotParseBindingTransformFunctionForField(file: File, partText: string, tagText: string, range: Range) {
    addErrorDiagnostic(file, 1013,
        `Could not parse transformFunction"`, range.start.line, range.start.character);
}

export function addXMLTagErrorCouldMissingEndBrackets(file: File, tagText: string, range: Range) {
    addErrorDiagnostic(file, 1013,
        `Binding could not be parsed: Missing matching end brackets.`, range.start.line, range.start.character);
}

export function addXMLTagErrorCouldNotParseeagerForField(file: File, partText: string, tagText: string, range: Range) {
    addErrorDiagnostic(file, 1014,
        `Could not parse eager for field`, range.start.line, range.start.character);
}

export function addXMLTagErrorCouldNotParseIsFiringOnceForField(file: File, partText: string, binding: Binding) {
    addErrorDiagnosticForBinding(file, 1015,
        `Could not parse binding setting "${partText}" - valid settings are 'once', 'eager', 'lazy' and 'transform'`, binding);
}

export function addFileErrorCouldNotSave(file: File) {
    addErrorDiagnostic(file, 1016, `could not save file at path ${file.fullPath} - does the path exist?`);
}

export function addFileErrorCouldNotParseXML(file: File, message: string) {
    addErrorDiagnostic(file, 1017, 'Could not parse xml in file: ' + message);
}

export function addXmlBindingDuplicateTag(file: File, field: string, line: number, col = 9999) {
    addErrorDiagnostic(file, 1018, `Could not parse binding the id is already used in another xml element: ${field}`, line, col);
}

export function addXmlBindingDuplicateField(file: File, field: string, line: number, col = 9999) {
    addErrorDiagnostic(file, 1019, `Could not parse binding id is already used in another interface field: ${field}`, line, col);
}
export function addCorruptVMType(file: File, line: number, col = 9999) {
    addErrorDiagnostic(file, 1020, `Could not pass vm field`, line, col);
}

export function addXmlBindingNoVMClassDefined(file: File) {
    addErrorDiagnostic(file, 1021, `The vm attribute was not set. Please add the 'vm' attribute to your component. e.g.  '<Component name='MyScreen' extends 'BaseScreen' vm='fully.namespaced.className'/>" so that maestro can give you accurate binding validations.`);
}

export function addXmlBindingVMClassNotFound(file: File) {
    addErrorDiagnostic(file, 1022, `The VMClass specified "${file.vmClassName}" was not found.`, file.componentTag.range.start.line, file.componentTag.range.start.character);
}

export function addXmlBindingVMFieldNotFound(file: File, binding: Binding) {
    addErrorDiagnosticForBinding(file, 1023, `The bound field "${binding.observerField}" was not found in class "${file.vmClassName}".`, binding);
}

export function addXmlBindingVMFunctionNotFound(file: File, binding: Binding) {
    addErrorDiagnosticForBinding(file, 1024, `Function "${binding.observerField}" was not found in class "${file.vmClassName}".`, binding);

}

export function addXmlBindingVMFunctionWrongArgCount(file: File, binding: Binding, minArgs: number, maxArgs: number, actualParams: number) {
    let expectedText = minArgs !== maxArgs ? `${minArgs} - ${maxArgs}` : `${minArgs}`;
    addErrorDiagnosticForBinding(file, 1025, `Binding invokes "${binding.observerField}" with ${actualParams} params when ${expectedText} params was expected`, binding);
}

export function addXmlBindingUsingFunctionAsField(file: File, binding: Binding) {
    addErrorDiagnosticForBinding(file, 1026, `Binding "${binding.observerField}" is configured as a field binding; but points to a function. Either use a field as the target of this binding, or indicate the function call signature: e.g. (), (value), (node), or (value, node)`, binding);
}

export function addBuildTimeErrorImportNoImports(file: BrsFile | XmlFile, buildKey: string, line = 0, col = 0) {
    file.addDiagnostics([createDiagnostic(file, 1027, `This file imports a build time import key that is defined in bsConfig; but does not include any imports: ${buildKey}`, line, col, line, 99999, DiagnosticSeverity.Warning)]);
}

export function addNodeClassNoExecuteMethod(file: BrsFile, line = 0, col = 0) {
    file.addDiagnostics([createDiagnostic(file, 1028, `Node classes must declare a function name execute(args as assoccarray), which returns dynamic`, line, col)]);
}

export function addNodeClassNoExtendNodeFound(file: BrsFile, name: string, extendsName: string, line = 0, col = 0) {
    file.addDiagnostics([createDiagnostic(file, 1029, `Node class "${name}" extends component ${extendsName}, which cannot be found in scope. You must extend a valid SG Node, or Custom node`, line, col)]);
}

export function addNodeClassDuplicateName(file: BrsFile, name: string, line = 0, col = 0) {
    file.addDiagnostics([createDiagnostic(file, 1030, `Node class name "${name}" is already used`, line, col)]);
}

export function addNodeClassBadDeclaration(file: BrsFile, text: string, line = 0, col = 0) {
    file.addDiagnostics([createDiagnostic(file, 1031, `Could not interpret node class annotation "${text}". Should be "'@node|@task ([name],[baseCompName])`, line, col)]);
}

export function addNodeClassNeedsClassDeclaration(file: BrsFile, line = 0, col = 0) {
    file.addDiagnostics([createDiagnostic(file, 1032, `Node class annotation must immediately precede the target class; but no class statement was found`, line, col)]);
}

export function addNodeClassWrongNewSignature(file: BrsFile, line = 0, col = 0) {
    file.addDiagnostics([createDiagnostic(file, 1033, `Node classes constructors must take 0 arguments`, line, col)]);
}

export function addXmlBindingVMFieldRequired(file: File, binding: Binding) {
    addErrorDiagnosticForBinding(file, 1034, `Field bindings are only available for vm fields. Cannot bind to vm function "${binding.observerField}" in class "${file.vmClassName}".`, binding);
}

export function addNodeClassFieldNoFieldType(file: BrsFile, name: string, line = 0, col = 0) {
    file.addDiagnostics([createDiagnostic(file, 1035, `Node class field "${name}" type cannot be ascertained. Set a reasonable default value, or add an as clause. For a default node type, use as 'mc.Node' `, line, col)]);
}

export function addNodeClassCallbackNotFound(file: BrsFile, name: string, callbackName: string, className: string, line = 0, col = 0) {
    file.addDiagnostics([createDiagnostic(file, 1036, `Node class field "${name}" specifies observer function ${callbackName} which is not found in class ${className}`, line, col)]);

}
export function addNodeClassCallbackNotDefined(file: BrsFile, name: string, line = 0, col = 0) {
    file.addDiagnostics([createDiagnostic(file, 1037, `Node class field "${name}" does not specify the observer function name. Syntax is 'observe("CALLBACK_NAME")`, line, col)]);
}

export function addNodeClassCallbackWrongParams(file: BrsFile, name: string, callbackName: string, className: string, line = 0, col = 0) {
    file.addDiagnostics([createDiagnostic(file, 1038, `Node class field "${name}" specifies observer function ${callbackName}, in class ${className}, which must have zero, or one param (which is the value of the updated field, if specified)`, line, col)]);

}

export function addXMLTagErrorCouldNotParseBindingBadPart(file: File, partText: string, range: Range) {
    addErrorDiagnostic(file, 1039,
        `Could not parse unknown binding part "${partText}"`, range.start.line, range.start.character);
}

export function addClassFieldsNotFoundOnSetOrGet(file: File, text: string, className: string, range: Range) {
    addErrorDiagnostic(file, 1040,
        `class field: "${text}" was not found on ${className} or it's parent classes`, range.start.line, range.start.character);
}

export function addIOCNoTypeSupplied(file: any, text: string, className: string, range: Range) {
    addErrorDiagnostic(file, 1041,
        `Cannot inject: ${className}.${text}. Wrong arguments valid arts are: (type, optional subPath)`, range.start.line, range.start.character);
}

export function addIOCWrongArgs(file: any, text: string, className: string, range: Range) {
    addErrorDiagnostic(file, 1042,
        `Inject annotation on ${className}.${text} must supply one argument`, range.start.line, range.start.character);
}

export function IOCClassNotInScope(file: any, wrongclass: string, text: string, className: string, range: Range) {
    addErrorDiagnostic(file, 1043,
        `cannot inject ${wrongclass} into field ${className}.${text}. It is not in scope`, range.start.line, range.start.character);
}
export function IOCClassWrongArgs(file: any, wrongclass: string, text: string, className: string, range: Range) {
    addErrorDiagnostic(file, 1044,
        `Cannot inject ${wrongclass} into field  ${className}.${text}. Constructor arg mistmatch.`, range.start.line, range.start.character);
}

export function addXmlBindingCantParseFunctionCall(file: File, tagText: string, range: Range) {
    addErrorDiagnostic(file, 1045, `Binding observer ${tagText} is configured as a function binding; but with an incorrect signature. Either use a field as the target of this binding, or indicate the function call signature: e.g. (), (value), (node), or (value, node).`, range.start.line, range.start.character);

}

export function unknownType(name: string, scopeName: string) {
    return { message: `Cannot find namespaced function or class with name '${name}' when this file is included in scope '${scopeName}'`,
        code: `MSTO${1046}`,
        severity: DiagnosticSeverity.Error };
}

export function unknownClassMethod(name: string, scopeName: string) {
    return { message: `Cannot find class method with name '${name}' when this file is included in scope '${scopeName}'`,
        code: `MSTO${1047}`,
        severity: DiagnosticSeverity.Error };
}

export function unknownClassField(name: string, scopeName: string) {
    return { message: `Cannot find class field with name '${name}' when this file is included in scope '${scopeName}'`,
        code: `MSTO${1048}`,
        severity: DiagnosticSeverity.Error };
}

export function wrongMethodArgs(name: string, numArgs: number, minArgs: number, maxArgs?: number) {
    return { message: maxArgs
        ? `Invoking '${name}' with wrong number of args. Received ${numArgs} instead of expceted ${minArgs} to ${maxArgs}'`
        : `Invoking '${name}' with wrong number of args. Received ${numArgs} instead of expected ${minArgs}'`,
    code: `MSTO${1049}`,
    severity: DiagnosticSeverity.Error };
}
