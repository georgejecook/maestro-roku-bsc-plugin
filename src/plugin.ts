import { isVariableExpression,
    CallExpression,
    createIdentifier,
    DottedGetExpression,
    ExpressionStatement,
    createVisitor,
    WalkMode,
    ClassFieldStatement,
    createStringLiteral,
    createToken,
    ParseMode,
    TokenKind,
    isBrsFile,
    isXmlFile,
    VariableExpression,
    isDottedGetExpression,
    DottedSetStatement,
    isVoidType,
    isDynamicType } from 'brighterscript';
import type { BrsFile,
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
    ClassMethodStatement } from 'brighterscript';

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
import { addClassFieldsNotFoundOnSetOrGet, addIOCNoTypeSupplied, addIOCWrongArgs, IOCClassNotInScope, unknownClassMethod, unknownType, wrongMethodArgs } from './lib/utils/Diagnostics';
import { getAllAnnotations, getAllFields, getAllMethods, makeASTFunction } from './lib/utils/Utils';
import { getSGMembersLookup } from './SGApi';
import { DependencyGraph } from 'brighterscript/dist/DependencyGraph';
import { debug } from 'node:console';
import { DynamicType } from 'brighterscript/dist/types/DynamicType';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };
interface FunctionInfo {
    minArgs: number;
    maxArgs: number;
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
    public builder: ProgramBuilder;
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
        config = config?.maestro || {
            buildTimeImports: {}
        };
        config.excludeFilters = config.excludeFilters || ['**/roku_modules/**/*'];
        config.addFrameworkFiles = config.addFrameworkFiles || true;
        config.stripParamTypes = config.stripParamTypes || true;
        config.applyStrictToAllClasses = config.applyStrictToAllClasses || true;
        config.nodeClasses = config.nodeClasses || {};
        config.nodeClasses.buildForIDE = config.buildForIDE; //legacy support
        config.nodeClasses.buildForIDE = config.nodeClasses.buildForIDE === undefined ? false : config.nodeClasses.buildForIDE;

        config.mvvm = config.mvvm || {};

        config.mvvm.insertXmlBindingsEarly = config.mvvm.insertXmlBindingsEarly === undefined ? false : config.mvvm.insertXmlBindingsEarly;
        config.mvvm.createCodeBehindFilesWhenNeeded = config.mvvm.createCodeBehindFilesWhenNeeded === undefined ? true : config.mvvm.createCodeBehindFilesWhenNeeded;
        config.mvvm.insertCreateVMMethod = config.mvvm.insertCreateVMMethod === undefined ? true : config.mvvm.insertCreateVMMethod;
        config.mvvm.callCreateVMMethodInInit = config.mvvm.callCreateVMMethodInInit === undefined ? true : config.mvvm.callCreateVMMethodInInit;
        config.mvvm.callCreateNodeVarsInInit = config.mvvm.callCreateNodeVarsInInit === undefined ? true : config.mvvm.callCreateNodeVarsInInit;

        config.reflection = config.refelection || {};
        config.reflection.generateReflectionFunctions = config.reflection.generateReflectionFunctions === undefined ? false : config.reflection.generateReflectionFunctions;
        config.reflection.excludeFilters = config.reflection.excludeFilters === undefined ? ['**/roku_modules/**/*', '**/*.spec.bs'] : config.reflection.excludeFilters;
        return config;
    }

    beforeProgramCreate(builder: ProgramBuilder): void {
        if (!this.fileMap) {
            this.fileMap = new ProjectFileMap();
            this.fileFactory = new FileFactory(this.builder);
            this.maestroConfig = this.getConfig(builder.options as any);
            this.bindingProcessor = new BindingProcessor(this.fileMap, this.fileFactory, this.maestroConfig);
            this.reflectionUtil = new ReflectionUtil(this.fileMap, builder, this.maestroConfig);

            this.importProcessor = new ImportProcessor(this.maestroConfig);
            this.nodeClassUtil = new NodeClassUtil(this.fileMap, builder, this.fileFactory);
            this.builder = builder;
        }
    }

    afterProgramCreate(program: Program): void {
        // console.log('MAESTRO apc-----');
        if (!this.isFrameworkAdded) {
            this.fileFactory.addFrameworkFiles(program);
            this.isFrameworkAdded = true;
        }
    }

    afterFileParse(file: (BrsFile | XmlFile)): void {
        // console.log('MAESTRO afp-----', file.pathAbsolute);
        let mFile = this.fileMap.allFiles.get(file.pathAbsolute);
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
            this.importProcessor.processDynamicImports(file, this.builder.program);
            this.reflectionUtil.addFile(file);
            if (this.shouldParseFile(file)) {
                this.nodeClassUtil.addFile(file, mFile);
                if (this.maestroConfig.nodeClasses.buildForIDE) {
                    for (let nc of [...mFile.nodeClasses.values()]) {
                        nc.generateCode(this.fileFactory, this.builder.program, this.fileMap, this.maestroConfig.nodeClasses.buildForIDE);
                    }
                    if (this.maestroConfig.nodeClasses.generateTestUtils) {
                        this.nodeClassUtil.generateTestCode(this.builder.program);
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
        let compFile = this.fileMap.allFiles.get(file.pathAbsolute);
        if (compFile?.fileType === FileType.Xml && compFile?.vmClassName) {
            this.bindingProcessor.parseBindings(compFile);
            this.dirtyCompFilePaths.add(file.pathAbsolute);
        } else {
            for (let compFile of this.getCompFilesThatHaveFileInScope(file)) {
                this.dirtyCompFilePaths.add(compFile.fullPath);
            }
        }
    }

    beforeProgramValidate(program: Program) {
        // console.log('MAESTRO bpv-----');
        for (let filePath of [...this.dirtyCompFilePaths.values()]) {
            let file = this.fileMap.allFiles.get(filePath);
            file.bscFile = this.builder.program.getFileByPathAbsolute(filePath);
            file.resetDiagnostics();
            this.bindingProcessor.validateBindings(file);
            if (this.maestroConfig.mvvm.insertXmlBindingsEarly && file.isValid) {
                // console.log('adding xml transpiled code for ', file.bscFile.pkgPath);
                this.bindingProcessor.generateCodeForXMLFile(file, this.builder.program);
            }
        }

        if (!this.maestroConfig.nodeClasses.buildForIDE) {
            console.log('building all comp files...');
            for (let nc of [...this.fileMap.nodeClasses.values()]) {
                nc.generateCode(this.fileFactory, this.builder.program, this.fileMap, false);
            }
            if (this.maestroConfig.nodeClasses.generateTestUtils) {
                this.nodeClassUtil.generateTestCode(this.builder.program);
            }
        }
        this.dirtyCompFilePaths.clear();
    }

    afterProgramValidate(program: Program) {
        for (let f of Object.values(this.builder.program.files)) {
            if (f.pkgPath.startsWith('components/maestro/generated')) {
                (f as any).diagnostics = [];
                if (isXmlFile(f)) {
                    let s = f.program.getScopeByName(f.pkgPath);
                    // eslint-disable-next-line @typescript-eslint/dot-notation
                    s['diagnostics'] = [];
                }
            }
        }
        for (let f of [...this.mFilesToValidate.values()]) {
            let mFile = this.fileMap.allFiles.get(f.pathAbsolute);
            if (mFile) {
                this.checkMReferences(mFile);
                this.doExtraValidations(f);
            }
        }

        this.mFilesToValidate.clear();
        for (let filePath of [...this.dirtyNodeClassPaths.values()]) {
            for (let nc of this.fileMap.nodeClassesByPath.get(filePath)) {
                nc.validate();
                nc.validateBaseComponent(this.builder, this.fileMap);
            }
        }
        this.dirtyNodeClassPaths.clear();
    }

    getCompFilesThatHaveFileInScope(file: BscFile): File[] {
        let compFiles = [];
        let lowerPath = file.pkgPath.toLowerCase();
        for (let compFile of [...this.fileMap.allFiles.values()].filter((f) => f.fileType === FileType.Xml && f.vmClassName)) {
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

    beforeFileTranspile (entry: TranspileObj) {
        if (isBrsFile(entry.file) && this.shouldParseFile(entry.file)) {
            let classes = entry.file.parser.references.classStatements;
            for (let cs of classes) {
                let fieldMap = getAllFields(this.fileMap, cs);
                let id = createToken(TokenKind.Identifier, '__classname', cs.range);
                // eslint-disable-next-line @typescript-eslint/dot-notation
                if (!fieldMap['__classname']) {
                    let p = createToken(TokenKind.Public, 'public', cs.range);
                    let a = createToken(TokenKind.As, 'as', cs.range);
                    let s = createToken(TokenKind.String, 'string', cs.range);

                    let classNameStatement = new ClassFieldStatement(p, id, a, s, createToken(TokenKind.Equal, '=', cs.range), createStringLiteral('"' + cs.getName(ParseMode.BrighterScript), cs.range));
                    cs.body.push(classNameStatement);
                    cs.fields.push(classNameStatement);
                    cs.memberMap.__className = classNameStatement;
                } else {
                    //this is more complicated, have to add this to the constructor
                    let s = new RawCodeStatement(`m.__className = "${cs.getName(ParseMode.BrighterScript)}"`, entry.file, cs.range);

                    let constructor = cs.memberMap.new as ClassMethodStatement;
                    if (constructor) {
                        constructor.func.body.statements.push(s);
                    } else {
                        //have to create a constructor, with same args as parent..
                        // console.log('TBD: create a constructor to inject for ', cs.name.text);
                    }
                }
                let allClassAnnotations = getAllAnnotations(this.fileMap, cs);
                // eslint-disable-next-line @typescript-eslint/dot-notation
                if (allClassAnnotations['usesetfield']) {
                    this.updateFieldSets(cs);
                }
                this.injectIOCCode(cs, entry.file);
            }
            if (this.maestroConfig.stripParamTypes) {
                for (let fs of entry.file.parser.references.functionExpressions) {
                    if (fs.returnType && !isVoidType(fs.returnType) && !isDynamicType(fs.returnType)) {
                        fs.returnType = new DynamicType();
                    }
                    for (let param of fs.parameters) {
                        param.asToken = null;
                    }
                }
            }
        }
        for (let nc of this.fileMap.nodeClasses.values()) {
            nc.replacePublicMFieldRefs(this.fileMap);
        }

    }

    beforeProgramTranspile(program: Program, entries: TranspileObj[]) {
        if (!this.maestroConfig.mvvm.insertXmlBindingsEarly) {
            console.log('injecting binding code into files with vms...');

            for (let entry of entries) {
                if (isXmlFile(entry.file)) {
                    let mFile = this.fileMap.allFiles.get(entry.file.pathAbsolute);
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
        }
    }

    beforePublish(builder: ProgramBuilder, files: FileObj[]) {
        this.reflectionUtil.updateRuntimeFile();
    }

    public updateFieldSets(cs: ClassStatement) {
        let fieldMap = getAllFields(this.fileMap, cs, TokenKind.Public);

        cs.walk(createVisitor({
            DottedSetStatement: (ds) => {
                if (isVariableExpression(ds.obj) && ds.obj?.name?.text === 'm') {
                    let lowerName = ds.name.text.toLowerCase();
                    if (fieldMap[lowerName]) {
                        let callE = new CallExpression(
                            new DottedGetExpression(
                                ds.obj,
                                createIdentifier('setField', ds.range).name,
                                createToken(TokenKind.Dot, '.', ds.range)),
                            createToken(TokenKind.LeftParen, '(', ds.range),
                            createToken(TokenKind.RightParen, ')', ds.range),
                            [
                                createStringLiteral(`"${ds.name.text}"`, ds.range),
                                ds.value
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
        // console.log('>>>', file.fullPath);

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
                        if (!fieldMap[lowerName] && !this.skips[lowerName]) {
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
                        if (!fieldMap[lowerName] && !funcMap[lowerName] && !this.skips[lowerName]) {
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
        //validate the ioc calls
        let classMap = scope.getClassMap();
        for (let mapItem of [...classMap.values()]) {
            let cs = mapItem.item;
            let file = mapItem.file;
            if (file.pkgPath.startsWith('components/maestro/generated')) {
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

    private injectIOCCode(cs: ClassStatement, file: BrsFile) {

        // eslint-disable-next-line @typescript-eslint/dot-notation
        let isNodeClass = cs['_isNodeClass'] === true;

        for (let f of cs.fields) {
            let annotation = (f.annotations || []).find((a) => a.name === 'inject' || a.name === 'injectClass' || a.name === 'createClass');
            if (annotation) {
                let args = annotation.getArguments();
                let wf = f as Writeable<ClassFieldStatement>;
                if (annotation.name === 'inject') {
                    if (isNodeClass && (f.accessModifier || f.accessModifier.kind === TokenKind.Public)) {
                        if (args.length === 1) {
                            wf.initialValue = new RawCodeStatement(`__m_setTopField("${f.name.text}", mioc_getInstance("${args[0].toString()}"))`, file, f.range);
                        } else if (args.length === 2) {
                            wf.initialValue = new RawCodeStatement(`__m_setTopField("${f.name.text}", mioc_getInstance("${args[0].toString()}", "${args[1].toString()}"))`, file, f.range);
                        }
                    } else {
                        if (args.length === 1) {
                            wf.initialValue = new RawCodeStatement(`mioc_getInstance("${args[0].toString()}")`, file, f.range);
                        } else if (args.length === 2) {
                            wf.initialValue = new RawCodeStatement(`mioc_getInstance("${args[0].toString()}", "${args[1].toString()}")`, file, f.range);
                        }
                    }
                } else if (annotation.name === 'injectClass') {
                    wf.initialValue = new RawCodeStatement(`mioc_getClassInstance("${args[0].toString()}")`, file, f.range);
                } else if (annotation.name === 'createClass') {
                    let instanceArgs = [];
                    for (let i = 1; i < args.length - 1; i++) {
                        if (args[i]) {
                            instanceArgs.push(args[i].toString());
                        }
                    }
                    if (instanceArgs.length > 0) {
                        wf.initialValue = new RawCodeStatement(`mioc_createClassInstance("${args[0].toString()}", [${instanceArgs.join(',')}])`, file, f.range);
                    } else {
                        wf.initialValue = new RawCodeStatement(`mioc_createClassInstance("${args[0].toString()}")`, file, f.range);

                    }
                }
                wf.equal = createToken(TokenKind.Equal, '=', f.range);
            }
        }
    }

    doExtraValidations(file: BrsFile) {
        //ensure we have all lookups
        let scopeNamespaces: Record<string, any> = {};
        let classMemberLookup: Record<string, FunctionInfo | boolean> = {};
        for (let scope of this.builder.program.getScopesForFile(file)) {
            scopeNamespaces = { ...this.getNamespaceLookup(scope), ...scopeNamespaces };
            classMemberLookup = { ...this.buildClassMemberLookup(scope), ...classMemberLookup };
            this.validateFunctionCalls(file, scopeNamespaces, classMemberLookup);
        }
    }

    public validateFunctionCalls(file: BrsFile, nsLookup, memberLookup) {
        // for now we're only validating classes
        for (let cs of file.parser.references.classStatements) {

            cs.walk(createVisitor({
                CallExpression: (ce) => {

                    let dg = ce.callee as DottedGetExpression;
                    let nameParts = this.getAllDottedGetParts(dg);
                    let name = nameParts.pop();

                    if (name) {

                        //is a namespace?
                        if (nameParts[0] && nsLookup[nameParts[0].toLowerCase()]) {
                            //then it must reference something we know
                            let fullPathName = nameParts.join('.').toLowerCase();
                            let ns = nsLookup[fullPathName];
                            if (!ns) {
                                //look it up minus the tail

                                // eslint-disable-next-line @typescript-eslint/dot-notation
                                file['diagnostics'].push({
                                    ...unknownType(`${fullPathName}.${name}`, this.name),
                                    range: ce.range,
                                    file: file
                                });
                            } else if (!ns.functionStatements[name.toLowerCase()] && !ns.classStatements[name.toLowerCase()]) {
                                // eslint-disable-next-line @typescript-eslint/dot-notation
                                file['diagnostics'].push({
                                    ...unknownType(`${fullPathName}.${name}`, this.name),
                                    range: ce.range,
                                    file: file
                                });
                            } else {
                                let member = ns.functionStatements[name.toLowerCase()];
                                if (member) {
                                    let numArgs = ce.args.length;
                                    let minArgs = member.func.parameters.filter((p) => !p.defaultValue).length;
                                    let maxArgs = member.func.parameters.length;
                                    if (numArgs < minArgs || numArgs > maxArgs) {
                                        // eslint-disable-next-line @typescript-eslint/dot-notation
                                        file['diagnostics'].push({
                                            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                                            ...wrongMethodArgs(`${name}`, numArgs, minArgs, maxArgs),
                                            range: ce.range,
                                            file: file
                                        });
                                    }

                                }
                            }
                        } else if (nameParts.length > 0) {
                            //is a class method?
                            if (!memberLookup[name.toLowerCase()]) {
                                // console.log('>> ' + name.toLowerCase());
                                // eslint-disable-next-line @typescript-eslint/dot-notation
                                file['diagnostics'].push({
                                    ...unknownClassMethod(`${name}`, this.name),
                                    range: ce.range,
                                    file: file
                                });
                            } else {
                                let member = memberLookup[name.toLowerCase()] as FunctionInfo;
                                if (typeof member !== 'boolean') {
                                    let numArgs = ce.args.length;
                                    if (numArgs < member.minArgs || numArgs > member.maxArgs) {
                                        // eslint-disable-next-line @typescript-eslint/dot-notation
                                        file['diagnostics'].push({
                                            ...wrongMethodArgs(`${name}`, numArgs, member.minArgs, member.maxArgs),
                                            range: ce.range,
                                            file: file
                                        });
                                    }

                                }
                            }
                        }
                    }


                }
            }), { walkMode: WalkMode.visitAllRecursive });
        }

    }
    public getNamespaceLookup(scope: Scope) {
        // eslint-disable-next-line @typescript-eslint/dot-notation
        return scope['cache'].getOrAdd('namespaceLookup', () => scope.buildNamespaceLookup());
    }

    /**
     * Dictionary of all class members
     */
    public getClassMemberLookup(scope: Scope) {
        // eslint-disable-next-line @typescript-eslint/dot-notation
        return scope['cache'].getOrAdd('classMemberLookup', () => this.buildClassMemberLookup(scope));
    }

    public buildClassMemberLookup(scope: Scope): Record<string, FunctionInfo | boolean> {
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
                for (let s of [...cs.methods]) {
                    let lowerName = s.name.text.toLowerCase();
                    let currentInfo = lookup[lowerName];
                    if (!currentInfo) {
                        lookup[lowerName] = {
                            minArgs: s.func.parameters.filter((p) => !p.defaultValue).length,
                            maxArgs: s.func.parameters.length
                        };
                    } else if (typeof currentInfo !== 'boolean') {
                        let minArgs = s.func.parameters.filter((p) => !p.defaultValue).length;
                        let maxArgs = s.func.parameters.length;
                        currentInfo.minArgs = minArgs < currentInfo.minArgs ? minArgs : currentInfo.minArgs;
                        currentInfo.maxArgs = maxArgs > currentInfo.maxArgs ? maxArgs : currentInfo.maxArgs;
                    }
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
