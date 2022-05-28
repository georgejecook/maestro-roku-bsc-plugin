import {
    isVariableExpression,
    CallExpression,
    createIdentifier,
    DottedGetExpression,
    ExpressionStatement,
    createVisitor,
    WalkMode,
    createStringLiteral,
    createToken,
    ParseMode,
    TokenKind,
    isBrsFile,
    isXmlFile,
    isDottedGetExpression,
    isVoidType,
    isDynamicType,
    isNewExpression,
    isIndexedGetExpression,
    isExpression,
    isLiteralExpression,
    isCallExpression,
    isCallfuncExpression,
    createInvalidLiteral,
    createVariableExpression,
    isFunctionStatement,
    createMethodStatement,
    isLiteralString,
    isMethodStatement,
    ClassFieldStatement
} from 'brighterscript';
import type {
    BrsFile,
    BscFile,
    ClassStatement,
    CompilerPlugin,
    FileObj,
    Program, ProgramBuilder,
    TranspileObj,
    XmlFile,
    Scope,
    CallableContainerMap,
    FunctionStatement,
    Statement,
    BeforeFileTranspileEvent,
    Expression
    ,
    ClassMethodStatement
    ,
    AstEditor
} from 'brighterscript';
import { ProjectFileMap } from './lib/files/ProjectFileMap';
import type { MaestroConfig } from './lib/files/MaestroConfig';
import { BindingProcessor } from './lib/binding/BindingProcessor';
import type { File } from './lib/files/File';
import * as minimatch from 'minimatch';
import { FileType } from './lib/files/FileType';
import ImportProcessor from './lib/importSupport/ImportProcessor';
import ReflectionUtil from './lib/reflection/ReflectionUtil';
import { FileFactory } from './lib/utils/FileFactory';
import NodeClassUtil from './lib/node-classes/NodeClassUtil';
import { RawCodeStatement } from './lib/utils/RawCodeStatement';
import { addClassFieldsNotFoundOnSetOrGet, addIOCNoTypeSupplied, addIOCWrongArgs, noCallsInAsXXXAllowed, functionNotImported, IOCClassNotInScope, namespaceNotImported, noPathForInject, noPathForIOCSync, unknownClassMethod, unknownConstructorMethod, unknownSuperClass, unknownType, wrongConstructorArgs, wrongMethodArgs, observeRequiresFirstArgumentIsField, observeRequiresFirstArgumentIsNotM, observeFunctionNameNotFound, observeFunctionNameWrongArgs } from './lib/utils/Diagnostics';
import { getAllAnnotations, getAllFields } from './lib/utils/Utils';
import { getSGMembersLookup } from './SGApi';
import { DynamicType } from 'brighterscript/dist/types/DynamicType';

interface FunctionInfo {
    minArgs: number;
    maxArgs: number;
    pkgPaths: { string: string };
}
interface NamespaceContainer {
    file: BscFile;
    fullName: string;
    nameRange: Range;
    lastPartName: string;
    statements: Statement[];
    classStatements: Record<string, ClassStatement>;
    functionStatements: Record<string, FunctionStatement>;
    namespaces: Record<string, NamespaceContainer>;
}

export class MaestroPlugin implements CompilerPlugin {
    public name = 'maestroPlugin';
    public fileMap: ProjectFileMap;
    public bindingProcessor: BindingProcessor;
    public fileFactory: FileFactory;
    public reflectionUtil: ReflectionUtil;
    public importProcessor: ImportProcessor;
    public nodeClassUtil: NodeClassUtil;
    public program: Program;
    public isFrameworkAdded = false;
    public maestroConfig: MaestroConfig;
    private mFilesToValidate = new Map<string, BrsFile>();
    private dirtyCompFilePaths = new Set<string>();
    private dirtyNodeClassPaths = new Set<string>();

    private skips = {
        '__classname': true,
        'addreplace': true,
        'lookup': true,
        'lookupci': true,
        'doesexist': true,
        'delete': true,
        'clear': true,
        'keys': true,
        'items': true,
        'setmodecasesensitive': true,
        'append': true,
        'count': true
    };

    private getConfig(config: any) {
        //ignore roku modules by default
        config = config?.maestro ?? {
            buildTimeImports: {}
        };
        config.excludeFilters = config.excludeFilters ?? ['**/roku_modules/**/*'];
        config.addFrameworkFiles = config.addFrameworkFiles ?? true;
        config.stripParamTypes = config.stripParamTypes ?? true;
        config.processXMLFiles = config.processXMLFiles ?? true;
        config.updateAsFunctionCalls = config.updateAsFunctionCalls ?? true;
        config.updateObserveCalls = config.updateObserveCalls ?? true;

        config.paramStripExceptions = config.paramStripExceptions ?? ['onKeyEvent'];
        config.applyStrictToAllClasses = config.applyStrictToAllClasses ?? true;
        config.nodeClasses = config.nodeClasses ?? {};
        config.buildTimeImports = config.buildTimeImports ?? {};
        config.nodeClasses.buildForIDE = config.buildForIDE; //legacy support
        config.nodeClasses.buildForIDE = config.nodeClasses.buildForIDE === undefined ? false : config.nodeClasses.buildForIDE;

        config.mvvm = config.mvvm ?? {};

        config.mvvm.insertXmlBindingsEarly = config.mvvm.insertXmlBindingsEarly === undefined ? false : config.mvvm.insertXmlBindingsEarly;
        config.mvvm.createCodeBehindFilesWhenNeeded = config.mvvm.createCodeBehindFilesWhenNeeded === undefined ? true : config.mvvm.createCodeBehindFilesWhenNeeded;
        config.mvvm.insertCreateVMMethod = config.mvvm.insertCreateVMMethod === undefined ? true : config.mvvm.insertCreateVMMethod;
        config.mvvm.callCreateVMMethodInInit = config.mvvm.callCreateVMMethodInInit === undefined ? true : config.mvvm.callCreateVMMethodInInit;
        config.mvvm.callCreateNodeVarsInInit = config.mvvm.callCreateNodeVarsInInit === undefined ? true : config.mvvm.callCreateNodeVarsInInit;

        config.reflection = config.refelection ?? {};
        config.reflection.generateReflectionFunctions = config.reflection.generateReflectionFunctions === undefined ? true : config.reflection.generateReflectionFunctions;
        config.reflection.excludeFilters = config.reflection.excludeFilters === undefined ? ['**/roku_modules/**/*', '**/*.spec.bs'] : config.reflection.excludeFilters;
        config.extraValidation = config.extraValidation ?? {};
        config.extraValidation.doExtraValidation = config.extraValidation.doExtraValidation === undefined ? true : config.extraValidation.doExtraValidation;
        config.extraValidation.doExtraImportValidation = config.extraValidation.doExtraImportValidation === undefined ? false : config.extraValidation.doExtraImportValidation;
        config.extraValidation.excludeFilters = config.extraValidation.excludeFilters === undefined ? [] : config.extraValidation.excludeFilters;
        return config;
    }

    afterProgramCreate(program: Program): void {
        this.program = program;
        if (!this.fileMap) {
            this.fileMap = new ProjectFileMap();
            this.fileFactory = new FileFactory(program);
            this.maestroConfig = this.getConfig(program.options as any);
            this.bindingProcessor = new BindingProcessor(this.fileMap, this.fileFactory, this.maestroConfig);
            this.reflectionUtil = new ReflectionUtil(this.fileMap, program, this.maestroConfig);
            this.importProcessor = new ImportProcessor(this.maestroConfig);
            this.nodeClassUtil = new NodeClassUtil(this.fileMap, this.fileFactory);
        }
        // console.log('MAESTRO apc-----');
        if (!this.isFrameworkAdded) {
            this.fileFactory.addFrameworkFiles();
            this.isFrameworkAdded = true;
        }
    }

    afterFileParse(file: (BrsFile | XmlFile)): void {
        // console.log('MAESTRO afp-----', file.pathAbsolute);
        let mFile = this.fileMap.allFiles[file.pathAbsolute];
        if (!mFile) {
            mFile = this.fileMap.createFile(file);
        }
        mFile.bscFile = file;

        if (file.pkgPath.startsWith('components/maestro/generated')) {

            // eslint-disable-next-line @typescript-eslint/dot-notation
            file['diagnostics'] = [];
            return;
        }
        if (isBrsFile(file)) {
            this.importProcessor.processDynamicImports(file, this.program);
            this.reflectionUtil.addFile(file);
            if (this.shouldParseFile(file)) {
                this.nodeClassUtil.addFile(file, mFile);
                if (this.maestroConfig.nodeClasses.buildForIDE) {
                    for (let nc of [...mFile.nodeClasses.values()]) {
                        nc.generateCode(this.fileFactory, this.program, this.fileMap, this.maestroConfig.nodeClasses.buildForIDE);
                    }
                    if (this.maestroConfig.nodeClasses.generateTestUtils) {
                        this.nodeClassUtil.generateTestCode(this.program);
                    }
                }
                if (mFile.nodeClasses.size > 0) {
                    this.dirtyNodeClassPaths.add(file.pathAbsolute);
                }
                this.mFilesToValidate.set(file.pkgPath, file);
            } else {
            }

        } else {
            mFile.loadXmlContents();
        }
    }

    beforeProgramValidate?: (program: Program) => void;

    afterFileValidate(file: BscFile) {
        // console.log('MAESTRO afv-----', file.pathAbsolute);
        if (!this.shouldParseFile(file)) {
            return;
        }
        if (file.pkgPath.startsWith('components/maestro/generated')) {
            // eslint-disable-next-line @typescript-eslint/dot-notation
            file['diagnostics'] = [];
            return;
        }
        // console.log('MAESTRO running stf.....');
        let compFile = this.fileMap.allFiles[file.pathAbsolute];
        if (this.maestroConfig.processXMLFiles) {

            if (compFile?.fileType === FileType.Xml && compFile?.vmClassName) {
                this.bindingProcessor.parseBindings(compFile);
                this.dirtyCompFilePaths.add(file.pathAbsolute);
            } else {
                for (let compFile of this.getCompFilesThatHaveFileInScope(file)) {
                    this.dirtyCompFilePaths.add(compFile.fullPath);
                }
            }
        }
        if (isBrsFile(file) && this.maestroConfig.updateAsFunctionCalls) {
            this.validateAsXXXCalls(file);
        }
    }

    private validateAsXXXCalls(file: BrsFile) {
        if (this.maestroConfig.updateAsFunctionCalls && this.shouldDoExtraValidationsOnFile(file)) {
            for (let functionScope of file.functionScopes) {
                // event.file.functionCalls
                for (let callExpression of functionScope.func.callExpressions) {
                    let regex = /as(Any|Array|AA|Boolean|Float|Integer|Node|Point|String)/i;
                    if (isVariableExpression(callExpression.callee) && isExpression(callExpression.args[0])) {
                        let name = callExpression.callee.name.text;
                        if (regex.test(name)) {
                            try {
                                let value = callExpression.args[0] as DottedGetExpression;
                                this.getStringPathFromDottedGet(value);
                                this.getRootValue(value);
                            } catch (error) {
                                if (error.message === 'unsupportedValue') {
                                    file.addDiagnostics([{
                                        ...noCallsInAsXXXAllowed(error.functionName),
                                        range: error.range,
                                        file: file
                                    }]);

                                } else {
                                    console.error('could not update asXXX function call, due to unexpected error', error);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    afterProgramValidate(program: Program) {
        // console.log('MAESTRO bpv-----');
        if (this.maestroConfig.processXMLFiles) {
            for (let filePath of [...this.dirtyCompFilePaths.values()]) {
                // console.time('Validate bindings');
                let file = this.fileMap.allFiles[filePath];
                file.bscFile = this.program.getFileByPathAbsolute(filePath);
                file.resetDiagnostics();
                this.bindingProcessor.validateBindings(file);
                if (this.maestroConfig.mvvm.insertXmlBindingsEarly && file.isValid) {
                    console.log('adding xml transpiled code for ', file.bscFile.pkgPath);
                    this.bindingProcessor.generateCodeForXMLFile(file, this.program);
                }
                // console.timeEnd('Validate bindings');
            }
        }

        if (!this.maestroConfig.nodeClasses.buildForIDE) {
            console.time('Build node classes');
            for (let nc of Object.values(this.fileMap.nodeClasses)) {
                nc.generateCode(this.fileFactory, this.program, this.fileMap, false);
            }
            if (this.maestroConfig.nodeClasses.generateTestUtils) {
                this.nodeClassUtil.generateTestCode(this.program);
            }
            console.timeEnd('Build node classes');
        }
        this.dirtyCompFilePaths.clear();
        this.afterProgramValidate2(program);
    }

    //note this is moved because of changes in how the bsc plugin system worked
    //TODO - revisit and see if there's some other tidying up we can do in here
    afterProgramValidate2(program: Program) {
        for (let f of Object.values(this.program.files)) {
            if (f.pkgPath.startsWith('components/maestro/generated')) {
                (f as any).diagnostics = [];
                if (isXmlFile(f)) {
                    let s = f.program.getScopeByName(f.pkgPath);
                    // eslint-disable-next-line @typescript-eslint/dot-notation
                    s['diagnostics'] = [];
                }
            }
        }

        let runtimeFile = this.program.getFile<BrsFile>('source/roku_modules/maestro/reflection/Reflection.brs');
        if (runtimeFile) {
            // eslint-disable-next-line @typescript-eslint/dot-notation
            runtimeFile['diagnostics'] = [];
        }

        if (this.maestroConfig.extraValidation.doExtraValidation) {
            console.time('Do additional validations');
            for (let f of [...this.mFilesToValidate.values()]) {
                let mFile = this.fileMap.allFiles[f.pathAbsolute];
                if (mFile && this.shouldDoExtraValidationsOnFile(f)) {
                    this.checkMReferences(mFile);
                    this.doExtraValidations(f);
                }
            }
            console.timeEnd('Do additional validations');

            this.mFilesToValidate.clear();
            console.time('Validate node classes');
            for (let filePath of [...this.dirtyNodeClassPaths.values()]) {
                for (let nc of this.fileMap.nodeClassesByPath[filePath]) {
                    if (this.shouldDoExtraValidationsOnFile(nc.file)) {
                        nc.validate();
                        nc.validateBaseComponent(this.fileMap);
                    }
                }
            }
            console.timeEnd('Validate node classes');
        }
        this.dirtyNodeClassPaths.clear();
    }

    getCompFilesThatHaveFileInScope(file: BscFile): File[] {
        let compFiles = [];
        let lowerPath = file.pkgPath.toLowerCase();
        for (let compFile of Object.values(this.fileMap.allFiles).filter((f) => f.fileType === FileType.Xml && f.vmClassName)) {
            let xmlFile = compFile.bscFile as XmlFile;
            if (xmlFile.getAllDependencies().includes(lowerPath)) {
                compFiles.push(compFile);
            }
        }
        return compFiles;
    }

    shouldParseFile(file: BscFile) {
        if (this.maestroConfig.excludeFilters) {
            for (let filter of [...this.maestroConfig.excludeFilters, '**/components/maestro/generated/*']) {
                if (minimatch(file.pathAbsolute, filter)) {
                    return false;
                }
            }
        }
        return true;
    }
    shouldDoExtraValidationsOnFile(file: BscFile) {
        if (!this.maestroConfig.extraValidation.doExtraValidation) {
            return false;
        }
        if (!this.shouldParseFile(file)) {
            return false;
        }
        if (this.maestroConfig.extraValidation.excludeFilters) {
            for (let filter of [...this.maestroConfig.extraValidation.excludeFilters, '**/components/maestro/generated/*']) {
                if (minimatch(file.pathAbsolute, filter)) {
                    return false;
                }
            }
        }
        return true;
    }

    beforeFileTranspile(event: BeforeFileTranspileEvent) {
        if (!this.shouldParseFile(event.file)) {
            return;
        }
        if (isBrsFile(event.file) && this.shouldParseFile(event.file)) {
            let classes = event.file.parser.references.classStatements;
            for (let cs of classes) {
                //force bsc to add an empty `new` method before doing ast edits
                // eslint-disable-next-line @typescript-eslint/dot-notation
                cs['ensureConstructorFunctionExists']?.();
                //do class updates in here
                let fieldMap = getAllFields(this.fileMap, cs);
                let id = createToken(TokenKind.Identifier, '__classname', cs.range);
                if (!fieldMap.has('__classname')) {
                    let p = createToken(TokenKind.Public, 'public', cs.range);
                    let a = createToken(TokenKind.As, 'as', cs.range);
                    let s = createToken(TokenKind.String, 'string', cs.range);

                    let classNameStatement = new ClassFieldStatement(p, id, a, s, createToken(TokenKind.Equal, '=', cs.range), createStringLiteral('"' + cs.getName(ParseMode.BrighterScript), cs.range));
                    event.editor.arrayPush(cs.body, classNameStatement);
                    event.editor.arrayPush(cs.fields, classNameStatement);
                    event.editor.setProperty(cs.memberMap, '__className', classNameStatement);
                } else {
                    //this is more complicated, have to add this to the constructor
                    let s = new RawCodeStatement(`m.__className = "${cs.getName(ParseMode.BrighterScript)}"`, event.file, cs.range);
                    let constructor = cs.memberMap.new as ClassMethodStatement;

                    //if there's no constructor, add one
                    if (!constructor) {
                        constructor = createMethodStatement('new', TokenKind.Sub);
                        //TODO handle injecting a `super` call for child classes (and handle parent constructor arguments somehow...)
                        // constructor.func.body.statements.push(
                        //     new ExpressionStatement(
                        //         createCall(
                        //             createVariableExpression('super')
                        //         )
                        //     )
                        // );
                        event.editor.arrayUnshift(cs.body, constructor);
                    }
                    event.editor.arrayPush(constructor.func.body.statements, s);
                }
                let allClassAnnotations = getAllAnnotations(this.fileMap, cs);
                // eslint-disable-next-line @typescript-eslint/dot-notation
                if (allClassAnnotations['usesetfield']) {
                    this.updateFieldSets(cs);
                }
                this.injectIOCCode(cs, event);
                this.updateObserveCalls(cs, event);
            }
            if (this.maestroConfig.stripParamTypes) {
                for (let func of event.file.parser.references.functionExpressions) {
                    if (func.returnType && !isVoidType(func.returnType) && !isDynamicType(func.returnType)) {
                        const name = func.functionStatement?.name?.text ?? func.parentFunction?.functionStatement?.name?.text?.toLowerCase();
                        if (!this.maestroConfig.paramStripExceptions.find(x => x.toLowerCase() === name)) {
                            event.editor.setProperty(func, 'returnType', new DynamicType());
                        }
                    }
                    for (let param of func.parameters) {
                        event.editor.setProperty(param, 'asToken', undefined);
                        event.editor.setProperty(param, 'typeToken', undefined);
                    }
                }
            }
            this.updateAsFunctionCalls(event);
            this.autoInjectNamespaceFunctionCalls(event.file);
        }
        for (let nc of Object.values(this.fileMap.nodeClasses)) {
            nc.replacePublicMFieldRefs(this.fileMap, event.editor as AstEditor);
        }
    }

    private updateAsFunctionCalls(event: BeforeFileTranspileEvent) {
        if (this.maestroConfig.updateAsFunctionCalls) {
            for (let functionScope of event.file.functionScopes) {

                // event.file.functionCalls
                for (let callExpression of functionScope.func.callExpressions) {
                    let regex = /^as(Any|Array|AA|Boolean|Float|Integer|Node|Point|String)/i;
                    if (isVariableExpression(callExpression.callee) && isExpression(callExpression.args[0])) {
                        let name = callExpression.callee.name.text;
                        if (regex.test(name)) {
                            try {
                                let value = event.editor.arrayShift(callExpression.args) as DottedGetExpression;
                                let stringPath = this.getStringPathFromDottedGet(value);
                                name = `mc_get${name.match(regex)[1]}`;
                                event.editor.setProperty(callExpression.callee.name, 'text', name);
                                if (stringPath) {
                                    event.editor.arrayUnshift(callExpression.args, stringPath);
                                } else {
                                    event.editor.arrayUnshift(callExpression.args, createInvalidLiteral());
                                }
                                let rootValue = this.getRootValue(value);
                                event.editor.arrayUnshift(callExpression.args, rootValue);
                            } catch (error) {
                                if (error.message !== 'unsupportedValue') {
                                    console.error('could not update asXXX function call, due to unexpected error', error);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private autoInjectNamespaceFunctionCalls(file: BrsFile) {
        if (this.maestroConfig.updateAsFunctionCalls && Object.keys(this.fileMap.allAutoInjectedNamespaceMethods).length > 0) {
            for (let functionScope of file.functionScopes) {

                // event.file.functionCalls
                for (let callExpression of functionScope.func.callExpressions) {
                    //1. get the namespace
                    //2. check if all params are called
                    //3. if tag
                    //4.   get defaults for missing params
                    //5.   add m


                    try {
                        let dg = callExpression.callee as DottedGetExpression;
                        let parts = this.getAllDottedGetParts(dg);
                        if (parts.length > 1) {

                            let fullPathName = this.getAllDottedGetParts(dg).join('.');

                            let nsFunc = this.fileMap.allAutoInjectedNamespaceMethods[fullPathName];

                            //is a namespace?
                            if (isFunctionStatement(nsFunc) && callExpression.args.length < nsFunc.func.parameters.length) {
                                for (let i = callExpression.args.length; i < nsFunc.func.parameters.length - 1; i++) {
                                    let param = nsFunc.func.parameters[i];
                                    if (param.defaultValue) {
                                        callExpression.args.push(param.defaultValue);
                                    } else {
                                        callExpression.args.push(createInvalidLiteral());
                                    }
                                }
                                callExpression.args.push(createVariableExpression('m'));
                            }
                        }
                    } catch (error) {
                        if (error.message !== 'unsupportedValue') {
                            console.error('could not update asXXX function call, due to unexpected error', error);
                        }
                    }

                }
            }
        }
    }

    private updateObserveCalls(cs: ClassStatement, event: BeforeFileTranspileEvent) {
        if (this.maestroConfig.updateObserveCalls) {
            for (let method of cs.methods) {
                for (let callExpression of method.func.callExpressions) {
                    if (isDottedGetExpression(callExpression.callee) && isDottedGetExpression(callExpression.args[0])) {
                        let [, name] = /^(observe|unobserve)$/i.exec(callExpression.callee.name.text) ?? [];
                        if (name) {
                            try {
                                const arg0 = event.editor.arrayShift(callExpression.args) as DottedGetExpression;
                                event.editor.arrayUnshift(callExpression.args, createStringLiteral(arg0.name.text));
                                event.editor.arrayUnshift(callExpression.args, arg0.obj);
                                event.editor.setProperty(callExpression.callee.name, 'text', `${name}NodeField`);
                            } catch (error) {
                                if (error.message !== 'unsupportedValue') {
                                    console.error('could not update asXXX function call, due to unexpected error', error);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private getRootValue(value: DottedGetExpression) {
        let root;
        if (isDottedGetExpression(value) || isIndexedGetExpression(value)) {

            root = value.obj;
            while (root.obj) {
                root = root.obj;
            }
        } else {
            root = value;
        }

        return root;
    }

    private getStringPathFromDottedGet(value: DottedGetExpression) {
        let parts = [this.getPathValuePartAsString(value)];
        let root;
        root = value.obj;
        while (root) {
            if (isCallExpression(root) || isCallfuncExpression(root)) {
                throw this.getWrongAsXXXFunctionPartError(root);
            }
            if (root.obj) {
                parts.push(`${this.getPathValuePartAsString(root)}`);
            }
            root = root.obj;
        }
        let joinedParts = parts.reverse().join('.');
        return joinedParts === '' ? undefined : createStringLiteral(joinedParts);
    }

    private getWrongAsXXXFunctionPartError(expr: Expression) {
        let error = new Error('unsupportedValue');
        // eslint-disable-next-line @typescript-eslint/dot-notation
        error['range'] = expr.range;
        if (isCallExpression(expr)) {
            if (isDottedGetExpression(expr.callee)) {
                // eslint-disable-next-line @typescript-eslint/dot-notation
                error['functionName'] = expr.callee.name.text;
            } else {
                // eslint-disable-next-line @typescript-eslint/dot-notation
                error['functionName'] = '#unknown#';
            }
        } else if (isCallfuncExpression(expr)) {
            // eslint-disable-next-line @typescript-eslint/dot-notation
            error['functionName'] = expr.methodName.text;
        }
        return error;
    }
    private getPathValuePartAsString(expr: Expression) {
        if (isCallExpression(expr) || isCallfuncExpression(expr)) {
            throw this.getWrongAsXXXFunctionPartError(expr);
        }
        if (!expr) {
            return undefined;
        }
        if (isDottedGetExpression(expr)) {
            return expr.name.text;
        } else if (isIndexedGetExpression(expr)) {
            if (isLiteralExpression(expr.index)) {
                return `${expr.index.token.text.replace(/^"/, '').replace(/"$/, '')}`;
            } else if (isVariableExpression(expr.index)) {
                return `${expr.index.name.text}`;
            }
        }

    }

    beforeProgramTranspile(program: Program, entries: TranspileObj[]) {
        // console.log('++++++', this.maestroConfig.processXMLFiles);
        if (!this.maestroConfig.mvvm.insertXmlBindingsEarly && this.maestroConfig.processXMLFiles) {
            console.time('Inject bindings into xml files');

            for (let entry of entries) {
                if (isXmlFile(entry.file)) {
                    let mFile = this.fileMap.allFiles[entry.file.pathAbsolute];
                    // eslint-disable-next-line @typescript-eslint/dot-notation
                    if (mFile.isValid) {
                        //it's a binding file
                        this.bindingProcessor.generateCodeForXMLFile(mFile, program, entry);
                        // console.log('generating code for bindings ', entry.file.pkgPath);
                        //it's a binding file
                    } else if (mFile.bindings.length === 0 && this.shouldParseFile(entry.file)) {
                        //check if we should add bindings to this anyhow)
                        // console.log('getting ids for regular xml file ', entry.file.pkgPath);
                        this.bindingProcessor.addNodeVarsMethodForRegularXMLFile(mFile);
                        //check if we should add bindings to this anyhow)
                    } else {
                        // console.log('not passing file through binding processor', entry.file.pkgPath);

                    }
                }
            }
            console.timeEnd('Inject bindings into xml files');
        }
    }

    beforePublish(builder: ProgramBuilder, files: FileObj[]) {
        console.time('Update reflection runtime file');
        this.reflectionUtil.updateRuntimeFile();
        console.timeEnd('Update reflection runtime file');
    }


    public updateFieldSets(cs: ClassStatement) {
        let fieldMap = getAllFields(this.fileMap, cs, TokenKind.Public);

        cs.walk(createVisitor({
            DottedSetStatement: (dottedSet) => {
                if (isVariableExpression(dottedSet.obj) && dottedSet.obj?.name?.text === 'm') {
                    let lowerName = dottedSet.name.text.toLowerCase();
                    if (fieldMap.has(lowerName)) {
                        let callE = new CallExpression(
                            new DottedGetExpression(
                                dottedSet.obj,
                                createIdentifier('setField', dottedSet.range),
                                createToken(TokenKind.Dot, '.', dottedSet.range)),
                            createToken(TokenKind.LeftParen, '(', dottedSet.range),
                            createToken(TokenKind.RightParen, ')', dottedSet.range),
                            [
                                createStringLiteral(`"${dottedSet.name.text}"`, dottedSet.range),
                                dottedSet.value
                            ],
                            null);
                        let callS = new ExpressionStatement(callE);
                        return callS;
                    }
                }
            }
        }), { walkMode: WalkMode.visitAllRecursive });

        // cs.walk(createVisitor{
        //   }, { walkMode: WalkMode.visitAllRecursive });

    }

    private checkMReferences(file: File) {
        for (let cs of (file.bscFile as BrsFile).parser.references.classStatements) {
            // eslint-disable-next-line @typescript-eslint/dot-notation
            if (!this.maestroConfig.applyStrictToAllClasses && !getAllAnnotations(this.fileMap, cs)['strict']) {
                continue;
            }
            // eslint-disable-next-line @typescript-eslint/dot-notation
            let isNodeClass = cs['_isNodeClass'];
            let fieldMap = getAllFields(this.fileMap, cs);
            let funcMap = file.getAllFuncs(cs);
            cs.walk(createVisitor({
                DottedSetStatement: (ds) => {
                    if (isVariableExpression(ds.obj) && ds.obj?.name?.text === 'm') {
                        let lowerName = ds.name.text.toLowerCase();
                        if (!fieldMap.has(lowerName) && !this.skips[lowerName]) {
                            if (!isNodeClass || (lowerName !== 'top' && lowerName !== 'global')) {
                                addClassFieldsNotFoundOnSetOrGet(file, `${ds.obj.name.text}.${ds.name.text}`, cs.name.text, ds.range);
                            }
                        }
                    }
                },
                DottedGetExpression: (ds) => {
                    if (isVariableExpression(ds.obj) && ds?.obj?.name.text === 'm') {
                        //TODO - make this not get dotted get's in function calls
                        let lowerName = ds.name.text.toLowerCase();
                        if (!fieldMap.has(lowerName) && !funcMap[lowerName] && !this.skips[lowerName]) {
                            if (!isNodeClass || (lowerName !== 'top' && lowerName !== 'global')) {
                                addClassFieldsNotFoundOnSetOrGet(file, `${ds.obj.name.text}.${ds.name.text}`, cs.name.text, ds.range);
                            }
                        }
                    }
                }
            }), { walkMode: WalkMode.visitAllRecursive });

        }


    }


    afterScopeValidate(scope: Scope, files: BscFile[], callables: CallableContainerMap) {
        if (!this.maestroConfig?.extraValidation?.doExtraValidation) {
            return;
        }
        //validate the ioc calls
        let classMap = scope.getClassMap();
        for (let mapItem of [...classMap.values()]) {
            let cs = mapItem.item;
            let file = mapItem.file;
            if (file.pkgPath.startsWith('components/maestro/generated')) {
                continue;
            }
            if (!this.shouldDoExtraValidationsOnFile(file)) {
                // console.log('skipping validation on ', file.pathAbsolute);
                continue;
            }

            for (let f of cs.fields) {
                let annotation = (f.annotations || []).find((a) => a.name === 'inject' || a.name === 'injectClass' || a.name === 'createClass');
                if (annotation) {
                    let args = annotation.getArguments();
                    if (args.length === 0 || args[0].toString().trim() === '') {
                        addIOCWrongArgs(file, `${f.name.text}`, cs.name.text, f.range);
                    } else if (annotation.name === 'inject') {
                        if (args.length === 0 || args.length > 2) {
                            addIOCNoTypeSupplied(file, `${f.name.text}`, cs.name.text, f.range);
                        }
                    } else if (annotation.name === 'injectClass') {
                        if (args.length !== 1) {
                            addIOCWrongArgs(file, `${f.name.text}`, cs.name.text, f.range);
                        } else {
                            let targetClass = classMap.get(args[0].toString().toLowerCase());
                            if (!targetClass) {
                                IOCClassNotInScope(file, args[0].toString(), `${f.name.text}`, cs.name.text, f.range);
                            }
                        }
                    } else if (annotation.name === 'createClass') {
                        if (args.length < 1) {
                            addIOCWrongArgs(file, `${cs.name.text}.${f.name.text}`, cs.name.text, f.range);
                        } else {
                            let targetClass = classMap.get(args[0].toString().toLowerCase());
                            if (!targetClass) {
                                IOCClassNotInScope(file, args[0].toString(), `${f.name.text}`, cs.name.text, f.range);
                            } //
                            // TODO - check constructor arg length
                            //
                        }
                    }
                }
            }
        }
    }

    private injectIOCCode(cs: ClassStatement, event: BeforeFileTranspileEvent) {
        const { file } = event;
        // eslint-disable-next-line @typescript-eslint/dot-notation
        let isNodeClass = cs['_isNodeClass'] === true;

        for (let field of cs.fields) {
            let annotation = (field.annotations || []).find((a) => a.name.toLowerCase() === 'inject' || a.name.toLowerCase() === 'injectclass' || a.name.toLowerCase() === 'createclass');
            if (annotation) {
                let args = annotation.getArguments();
                if (annotation.name === 'inject') {
                    if (args.length < 1) {
                        file.addDiagnostics([{
                            ...noPathForInject(),
                            range: cs.range,
                            file: file
                        }]);
                        continue;
                    }
                    let syncAnnotation = (field.annotations || []).find((a) => a.name.toLowerCase() === 'sync');
                    if (syncAnnotation && args.length < 2) {
                        file.addDiagnostics([{
                            ...noPathForIOCSync(),
                            range: cs.range,
                            file: file
                        }]);
                        continue;
                    }
                    let args1 = args[0].toString().split('.');
                    let iocKey;
                    let iocPath;
                    let observeField;
                    let observePath;
                    if (args1.length > 1) {
                        iocKey = args1.splice(0);
                        iocPath = args1.join('.');
                    } else {
                        iocKey = args1;
                        iocPath = args.length === 2 ? args[1].toString() : undefined;
                    }

                    if (syncAnnotation && !iocPath) {
                        file.addDiagnostics([{
                            ...noPathForIOCSync(),
                            range: cs.range,
                            file: file
                        }]);
                        continue;
                    }
                    if (iocPath) {
                        let observeParts = iocPath.split('.');
                        if (observeParts.length > 1) {
                            observeField = observeParts.pop();
                            observePath = observeParts.join('.');
                        } else {
                            observeField = observeParts[0];
                            observePath = '';
                        }
                    }

                    if (isNodeClass && (field.accessModifier?.kind === TokenKind.Public)) {
                        if (syncAnnotation) {
                            file.addDiagnostics([{
                                ...noPathForIOCSync(),
                                range: cs.range,
                                file: file
                            }]);
                            continue;
                        }

                        if (args.length === 1) {
                            //TODO unit test
                            event.editor.setProperty(field, 'initialValue', new RawCodeStatement(`__m_setTopField("${field.name.text}", mioc_getInstance("${iocKey}"))`, file, field.range));
                        } else if (args.length === 2) {
                            //TODO unit test
                            event.editor.setProperty(field, 'initialValue', new RawCodeStatement(`__m_setTopField("${field.name.text}", mioc_getInstance("${iocKey}", "${iocPath}"))`, file, field.range));
                        }
                    } else {
                        //check for observer field in here..

                        let observerAnnotation = (field.annotations || []).find((a) => a.name.toLowerCase() === 'observer');
                        if (observerAnnotation || syncAnnotation) {
                            let funcName = 'invalid';
                            if (observerAnnotation) {
                                let observerArgs = observerAnnotation?.getArguments() ?? [];
                                funcName = `m.${(observerArgs[0] as string).toLowerCase()}`;
                                //TODO add validation
                                // let observerFunc = members.get((observerArgs[0] as string).toLowerCase());
                                // if (observerArgs.length > 0) {
                                //     let observerFunc = members.get((observerArgs[0] as string).toLowerCase());
                                //     if (isClassMethodStatement(observerFunc)) {
                                //         f.numArgs = observerFunc?.func?.parameters?.length;
                                //     }
                                // }
                            }

                            // (fieldName as string, instanceName as string, path as string, observedPath as string, observedField as string, callback = invalid as function)

                            if (!iocPath) {
                                file.addDiagnostics([{
                                    ...noPathForIOCSync(),
                                    range: cs.range,
                                    file: file
                                }]);
                            } else {
                                event.editor.setProperty(field, 'initialValue', new RawCodeStatement(`m._addIOCObserver("${field.name.text}", "${iocKey}", "${iocPath}", "${observePath}", "${observeField}", ${funcName})`, file, field.range));
                            }
                        } else {
                            if (!iocPath) {
                                event.editor.setProperty(field, 'initialValue', new RawCodeStatement(`mioc_getInstance("${iocKey}")`, file, field.range));
                            } else {
                                //TODO unit test
                                event.editor.setProperty(field, 'initialValue', new RawCodeStatement(`mioc_getInstance("${iocKey}", "${iocPath}")`, file, field.range));
                            }
                        }
                    }
                } else if (annotation.name === 'injectClass') {
                    event.editor.setProperty(field, 'initialValue', new RawCodeStatement(`mioc_getClassInstance("${args[0].toString()}")`, file, field.range));
                } else if (annotation.name === 'createClass') {
                    let instanceArgs = [];
                    for (let i = 1; i < args.length - 1; i++) {
                        if (args[i]) {
                            instanceArgs.push(args[i].toString());
                        }
                    }
                    if (instanceArgs.length > 0) {
                        //TODO unit test
                        event.editor.setProperty(field, 'initialValue', new RawCodeStatement(`mioc_createClassInstance("${args[0].toString()}", [${instanceArgs.join(',')}])`, file, field.range));
                    } else {
                        event.editor.setProperty(field, 'initialValue', new RawCodeStatement(`mioc_createClassInstance("${args[0].toString()}")`, file, field.range));
                    }
                }
                event.editor.setProperty(field, 'equal', createToken(TokenKind.Equal, '=', field.range));
            }
        }
    }

    doExtraValidations(file: BrsFile) {
        //ensure we have all lookups
        let scopeNamespaces = new Map<string, NamespaceContainer>();
        let classMethodLookup: Record<string, FunctionInfo | boolean> = {};
        for (let scope of this.program.getScopesForFile(file)) {
            let scopeMap = this.getNamespaceLookup(scope);
            scopeNamespaces = new Map<string, NamespaceContainer>([...Array.from(scopeMap.entries())]);
            classMethodLookup = { ...this.buildClassMethodLookup(scope), ...classMethodLookup };
        }
        this.validateFunctionCalls(file, scopeNamespaces, classMethodLookup);
    }

    public validateFunctionCalls(file: BrsFile, nsLookup, methodLookup) {
        // file.parser.references.importStatements
        // for now we're only validating classes

        let importedPkgPaths = (file.program as any).dependencyGraph.getAllDependencies(file.dependencyGraphKey).map((d) => d.replace('.d.bs', '.bs'));
        importedPkgPaths.push(file.pkgPath.toLowerCase());
        for (let cs of file.parser.references.classStatements) {
            if (cs.parentClassName && this.maestroConfig.extraValidation.doExtraImportValidation) {
                let name = cs.parentClassName.getName(ParseMode.BrighterScript);
                if (!methodLookup[name]) {
                    // console.log('>> ' + name);
                    file.addDiagnostics([{
                        ...unknownSuperClass(`${name}`),
                        range: cs.range,
                        file: file
                    }]);
                } else {
                    let member = methodLookup[name] as FunctionInfo;
                    if (typeof member !== 'boolean') {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        if (!this.isImported(member, importedPkgPaths)) {
                            file.addDiagnostics([{
                                ...unknownSuperClass(`${name}`),
                                range: cs.range,
                                file: file
                            }]);
                        }
                    }
                }
            }
            cs.walk(createVisitor({
                NewExpression: (ne) => {
                    if (this.maestroConfig.extraValidation.doExtraImportValidation) {

                        let name = ne.className.getName(ParseMode.BrighterScript);
                        if (!methodLookup[name]) {
                            // console.log('>> ' + name);
                            file.addDiagnostics([{
                                ...unknownConstructorMethod(`${name}`, this.name),
                                range: ne.range,
                                file: file
                            }]);
                        } else {
                            let member = methodLookup[name] as FunctionInfo;
                            if (typeof member !== 'boolean') {
                                let numArgs = ne.call.args.length;
                                if (numArgs < member.minArgs || numArgs > member.maxArgs) {
                                    file.addDiagnostics([{
                                        ...wrongConstructorArgs(`${name}`, numArgs, member.minArgs, member.maxArgs),
                                        range: ne.range,
                                        file: file
                                    }]);
                                }
                                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                                if (!this.isImported(member, importedPkgPaths)) {
                                    file.addDiagnostics([{
                                        ...unknownConstructorMethod(`${name}`, this.name),
                                        range: ne.range,
                                        file: file
                                    }]);
                                }
                            }
                        }
                    }
                },
                CallExpression: (ce, parent) => {
                    if (isNewExpression(parent)) {
                        return;
                    }
                    let dg = ce.callee as DottedGetExpression;
                    let nameParts = this.getAllDottedGetParts(dg);
                    let name = nameParts.pop();

                    if (name) {

                        //is a namespace?
                        if (nameParts[0] && nsLookup.has(nameParts[0].toLowerCase())) {
                            //then it must reference something we know
                            let fullPathName = nameParts.join('.').toLowerCase();
                            let ns = nsLookup.get(fullPathName);
                            if (!ns) {
                                //look it up minus the tail

                                file.addDiagnostics([{
                                    ...unknownType(`${fullPathName}.${name}`, this.name),
                                    range: ce.range,
                                    file: file
                                }]);
                            } else if (!ns.functionStatements[name.toLowerCase()] && !ns.classStatements[name.toLowerCase()]) {
                                file.addDiagnostics([{
                                    ...unknownType(`${fullPathName}.${name}`, this.name),
                                    range: ce.range,
                                    file: file
                                }]);
                                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                            } else {
                                let member = ns.functionStatements[name.toLowerCase()];
                                if (member) {
                                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                                    if (this.maestroConfig.extraValidation.doExtraImportValidation && !this.isNamespaceImported(ns, importedPkgPaths)) {
                                        file.addDiagnostics([{
                                            ...namespaceNotImported(`${fullPathName}.${name}`),
                                            range: ce.range,
                                            file: file
                                        }]);
                                    }
                                    let numArgs = ce.args.length;
                                    let minArgs = member.func.parameters.filter((p) => !p.defaultValue).length;
                                    let maxArgs = member.func.parameters.length;
                                    if (numArgs < minArgs || numArgs > maxArgs) {
                                        file.addDiagnostics([{
                                            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                                            ...wrongMethodArgs(`${name}`, numArgs, minArgs, maxArgs),
                                            range: ce.range,
                                            file: file
                                        }]);
                                    }

                                }
                            }
                        } else if (nameParts.length > 0) {
                            //is a class method?
                            if (this.maestroConfig.extraValidation.doExtraImportValidation && !methodLookup[name.toLowerCase()]) {
                                // console.log('>> ' + name.toLowerCase());
                                file.addDiagnostics([{
                                    ...unknownClassMethod(`${name}`, this.name),
                                    range: ce.range,
                                    file: file
                                }]);
                            } else {
                                let member = methodLookup[name.toLowerCase()] as FunctionInfo;
                                if (member && typeof member !== 'boolean') {
                                    let numArgs = ce.args.length;
                                    if (numArgs < member.minArgs || numArgs > member.maxArgs) {
                                        file.addDiagnostics([{
                                            ...wrongMethodArgs(`${name}`, numArgs, member.minArgs, member.maxArgs),
                                            range: ce.range,
                                            file: file
                                        }]);
                                    }
                                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                                    if (this.maestroConfig.extraValidation.doExtraImportValidation && !this.isImported(member, importedPkgPaths)) {
                                        file.addDiagnostics([{
                                            ...functionNotImported(`${name}`),
                                            range: ce.range,
                                            file: file
                                        }]);
                                    }
                                }
                                if (this.maestroConfig.updateObserveCalls) {
                                    //CHECK that first argument of observe function is a dotted get
                                    if (name === 'observe') {
                                        if (!isDottedGetExpression(ce.args[0])) {
                                            file.addDiagnostics([{
                                                ...observeRequiresFirstArgumentIsField(),
                                                range: ce.range,
                                                file: file
                                            }]);
                                        } else {
                                            let arg0 = ce.args[0];
                                            let objectName = isVariableExpression(arg0.obj) ? arg0.obj.name.text : '';
                                            let fieldName;
                                            let name;
                                            if (isDottedGetExpression(ce.args[1]) && isVariableExpression(ce.args[1].obj)) {
                                                fieldName = ce.args[1].obj.name.text;
                                                name = ce.args[1].name.text;
                                            }
                                            if (objectName === 'm') {
                                                file.addDiagnostics([{
                                                    ...observeRequiresFirstArgumentIsNotM(),
                                                    range: ce.range,
                                                    file: file
                                                }]);
                                            } else if (fieldName) {
                                                let memberStatement = cs.memberMap[name.toLowerCase()];
                                                if (isMethodStatement(memberStatement)) {
                                                    let numArgs = memberStatement.func.parameters.length;
                                                    let sendMode = isLiteralString(ce.args[2]) ? ce.args[2].token.text : '"value"';
                                                    let expectedArgs = 0;
                                                    if (sendMode === '"none"') {
                                                        expectedArgs = 0;
                                                    } else if (sendMode === '"value"' || sendMode === '"node"') {
                                                        expectedArgs = 1;
                                                    } else {
                                                        expectedArgs = 2;
                                                    }
                                                    if (numArgs !== expectedArgs) {
                                                        file.addDiagnostics([{
                                                            ...observeFunctionNameWrongArgs(name, objectName, fieldName, sendMode, expectedArgs, numArgs),
                                                            range: ce.range,
                                                            file: file
                                                        }]);
                                                    }
                                                } else {
                                                    file.addDiagnostics([{
                                                        ...observeFunctionNameNotFound(name, objectName),
                                                        range: ce.range,
                                                        file: file
                                                    }]);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }


                }
            }), { walkMode: WalkMode.visitAllRecursive });
        }

    }

    private isImported(info: FunctionInfo, importedPkgPaths: string[]) {
        for (let s of importedPkgPaths) {
            if (info.pkgPaths?.[s]) {
                return true;
            }
        }
        return false;
    }
    private isNamespaceImported(ns: NamespaceContainer, importedPkgPaths: string[]) {
        let nsPathLookup = this.fileMap.pathsByNamespace[ns.fullName.toLowerCase()];
        for (let s of importedPkgPaths) {
            if (nsPathLookup?.[s]) {
                return true;
            }
        }
        return false;
    }

    public getNamespaceLookup(scope: Scope): Map<string, NamespaceContainer> {
        // eslint-disable-next-line @typescript-eslint/dot-notation
        return scope['cache'].getOrAdd('namespaceLookup', () => scope.buildNamespaceLookup() as any);
    }

    /**
     * Dictionary of all class members
     */
    public getClassMemberLookup(scope: Scope) {
        // eslint-disable-next-line @typescript-eslint/dot-notation
        return scope['cache'].getOrAdd('classMemberLookup', () => this.buildClassMethodLookup(scope));
    }

    public buildClassFieldLookup(scope: Scope): Record<string, boolean> {
        let lookup = getSGMembersLookup();
        let filesSearched = new Set<BscFile>();
        //TODO -needs ALL known SG functions!
        for (const file of scope.getAllFiles()) {
            if (isXmlFile(file) || filesSearched.has(file)) {
                continue;
            }
            filesSearched.add(file);
            for (let cs of file.parser.references.classStatements) {
                for (let s of [...cs.fields]) {
                    let lowerName = s.name.text.toLowerCase();
                    lookup[lowerName] = s;
                }
            }
        }
        return lookup;
    }
    public buildClassMethodLookup(scope: Scope): Record<string, FunctionInfo | boolean> {
        let lookup = getSGMembersLookup();
        let filesSearched = new Set<BscFile>();
        //TODO -needs ALL known SG functions!
        for (const file of scope.getAllFiles()) {
            if (isXmlFile(file) || filesSearched.has(file)) {
                continue;
            }
            filesSearched.add(file);
            for (let cs of file.parser.references.classStatements) {
                let hasNew = false;
                for (let s of [...cs.methods]) {
                    let lowerName = s.name.text.toLowerCase();
                    let currentInfo = lookup[lowerName];
                    if (lowerName === 'new') {
                        lowerName = cs.getName(ParseMode.BrighterScript);
                        hasNew = true;
                    }
                    if (!currentInfo) {
                        let pkgPaths = {};
                        pkgPaths[file.pkgPath.toLowerCase().replace('.d.bs', '.bs')] = true;
                        lookup[lowerName] = {
                            minArgs: s.func.parameters.filter((p) => !p.defaultValue).length,
                            maxArgs: s.func.parameters.length,
                            pkgPaths: pkgPaths
                        };
                    } else if (typeof currentInfo !== 'boolean') {
                        let minArgs = s.func.parameters.filter((p) => !p.defaultValue).length;
                        let maxArgs = s.func.parameters.length;
                        currentInfo.minArgs = minArgs < currentInfo.minArgs ? minArgs : currentInfo.minArgs;
                        currentInfo.maxArgs = maxArgs > currentInfo.maxArgs ? maxArgs : currentInfo.maxArgs;
                        if (!currentInfo.pkgPaths) {
                            currentInfo.pkgPaths = {};
                        }
                        currentInfo.pkgPaths[file.pkgPath.toLowerCase().replace('.d.bs', '.bs')] = true;
                    }
                }
                if (!hasNew) {
                    let pkgPaths = {};
                    pkgPaths[file.pkgPath.toLowerCase().replace('.d.bs', '.bs')] = true;
                    lookup[cs.getName(ParseMode.BrighterScript)] = {
                        minArgs: 0,
                        maxArgs: 0,
                        pkgPaths: pkgPaths
                    };
                }
            }
        }
        return lookup;
    }

    getAllDottedGetParts(dg: DottedGetExpression) {
        let parts = [dg?.name?.text];
        let nextPart = dg.obj;
        while (isDottedGetExpression(nextPart) || isVariableExpression(nextPart)) {
            parts.push(nextPart?.name?.text);
            nextPart = isDottedGetExpression(nextPart) ? nextPart.obj : undefined;
        }
        return parts.reverse();
    }

}

export default () => {
    return new MaestroPlugin();
};
