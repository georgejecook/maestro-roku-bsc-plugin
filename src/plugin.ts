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
    VariableExpression } from 'brighterscript';
import type { BrsFile,
    BscFile,
    ClassStatement,
    CompilerPlugin,
    FileObj,
    Program, ProgramBuilder,
    TranspileObj,
    XmlFile,
    Scope,
    CallableContainerMap } from 'brighterscript';

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
import { addClassFieldsNotFocundOnSetOrGet, addIOCNoTypeSupplied, addIOCWrongArgs, IOCClassNotInScope } from './lib/utils/Diagnostics';
import { getAllAnnotations, getAllFields } from './lib/utils/Utils';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

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
    private dirtyCompFilePaths = new Set<string>();
    private dirtyNodeClassPaths = new Set<string>();

    beforeProgramCreate(builder: ProgramBuilder): void {
        if (!this.fileMap) {
            this.fileMap = new ProjectFileMap();
            this.bindingProcessor = new BindingProcessor(this.fileMap);
            this.fileFactory = new FileFactory(this.builder);
            this.reflectionUtil = new ReflectionUtil(this.fileMap, builder);
            this.maestroConfig = (builder.options as any).maestro || {};

            //ignore roku modules by default
            if (this.maestroConfig.excludeFilters === undefined) {
                this.maestroConfig.excludeFilters = ['**/roku_modules/**/*'];
            }

            this.importProcessor = new ImportProcessor(this.maestroConfig);
            this.nodeClassUtil = new NodeClassUtil(this.fileMap, builder, this.fileFactory);
            this.builder = builder;
        }
    }

    afterProgramCreate(program: Program): void {
        // console.log('apc-----');
        if (!this.isFrameworkAdded) {
            this.fileFactory.addFrameworkFiles(program);
            this.isFrameworkAdded = true;
        }
    }

    afterFileParse(file: (BrsFile | XmlFile)): void {
        console.log('afp-----', file.pathAbsolute);
        let mFile = this.fileMap.allFiles.get(file.pathAbsolute);
        if (!mFile) {
            mFile = this.fileMap.createFile(file);
        }
        mFile.bscFile = file;

        if (file.pkgPath.startsWith('components/maestro/generated')) {
            return;
        }
        if (isBrsFile(file)) {
            this.importProcessor.processDynamicImports(file, this.builder.program);
            this.reflectionUtil.addFile(file);
            if (this.shouldParseFile(file)) {
                this.nodeClassUtil.addFile(file);
                if (this.fileMap.nodeClassesByPath.has(file.pathAbsolute)) {
                    this.dirtyNodeClassPaths.add(file.pathAbsolute);
                }
                // console.log(`processing file ${file.pkgPath}`);
            } else {
                // console.log(`skipping file ${file.pkgPath}`);
            }

        } else {
            mFile.loadXmlContents();
        }
    }

    afterFileValidate(file: BscFile) {
        console.log('afv-----', file.pathAbsolute);
        if (!this.shouldParseFile(file)) {
            return;
        }
        if (file.pkgPath.startsWith('components/maestro/generated')) {
            return;
        }
        let compFile = this.fileMap.allFiles.get(file.pathAbsolute);
        if (compFile?.fileType === FileType.Xml && compFile?.vmClassName) {
            this.bindingProcessor.parseBindings(compFile);
            this.dirtyCompFilePaths.add(file.pathAbsolute);
        } else {
            for (let compFile of this.getCompFilesThatHaveFileInScope(file)) {
                this.dirtyCompFilePaths.add(compFile.fullPath);
            }
        }
        if (isBrsFile(file)) {
            let mFile = this.fileMap.allFiles.get(file.pathAbsolute);
            if (mFile) {
                this.checkMReferences(mFile);
            } else {
                console.error('could not find MFile for path ', file.pathAbsolute);
            }
        }
    }

    beforeProgramValidate(program: Program) {
        console.log('apv-----');
        for (let filePath of [...this.dirtyCompFilePaths.values()]) {
            let file = this.fileMap.allFiles.get(filePath);
            file.bscFile = this.builder.program.getFileByPathAbsolute(filePath);
            file.resetDiagnostics();
            this.bindingProcessor.validateBindings(file);
            if (this.maestroConfig.insertXmlBindingsEarly && file.isValid) {
                console.log('adding xml transpiled code for ', file.bscFile.pkgPath);
                this.bindingProcessor.generateCodeForXMLFile(file);
            }
        }

        for (let filePath of [...this.dirtyNodeClassPaths.values()]) {
            for (let nc of this.fileMap.nodeClassesByPath.get(filePath)) {
                nc.validate();
                if (nc.file.getDiagnostics().length === 0) {
                    nc.generateCode(this.fileFactory, this.builder.program, this.fileMap);
                }
            }
        }

        this.dirtyCompFilePaths.clear();
        this.dirtyNodeClassPaths.clear();
    }

    afterProgramValidate(program: Program) {
        for (let f of Object.values(this.builder.program.files).filter((f) => f.pkgPath.startsWith('components/maestro/generated'))) {
            (f as any).diagnostics = [];
            if (isXmlFile(f)) {
                let s = f.program.getScopeByName(f.pkgPath);
                // eslint-disable-next-line @typescript-eslint/dot-notation
                s['diagnostics'] = [];
            }
        }
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
            for (let filter of this.maestroConfig.excludeFilters) {
                if (minimatch(file.pathAbsolute, filter)) {
                    return false;
                }
            }
        }
        return true;
    }

    beforeFileTranspile (entry: TranspileObj) {
        if (isBrsFile(entry.file)) {
            let classes = entry.file.parser.references.classStatements;
            for (let cs of classes) {
                if (!cs.memberMap.__className) {
                    let id = createToken(TokenKind.Identifier, '__className', cs.range);
                    let p = createToken(TokenKind.Public, 'public', cs.range);
                    let a = createToken(TokenKind.As, 'as', cs.range);
                    let s = createToken(TokenKind.String, 'string', cs.range);

                    let classNameStatement = new ClassFieldStatement(p, id, a, s, createToken(TokenKind.Equal, '=', cs.range), createStringLiteral('"' + cs.getName(ParseMode.BrighterScript), cs.range));
                    cs.body.push(classNameStatement);
                    cs.fields.push(classNameStatement);
                    cs.memberMap.__className = classNameStatement;
                }
                let allClassAnnotations = getAllAnnotations(this.fileMap, cs);
                // eslint-disable-next-line @typescript-eslint/dot-notation
                if (allClassAnnotations['usesetfield']) {
                    this.updateFieldSets(cs);
                }
                this.injectIOCCode(cs, entry.file);
            }
        }
    }

    beforeProgramTranspile(program: Program, entries: TranspileObj[]) {
        if (!this.maestroConfig.insertXmlBindingsEarly) {
            console.log('injecting binding code into files with vms');

            for (let entry of entries) {
                if (isXmlFile(entry.file)) {
                    let mFile = this.fileMap.allFiles.get(entry.file.pathAbsolute);
                    if (mFile.isValid) {
                        console.log('adding xml transpiled code for ', entry.file.pkgPath);
                        this.bindingProcessor.generateCodeForXMLFile(mFile);
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
                if (isVariableExpression(ds.obj) && ds.obj.name.text === 'm') {
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

        for (let cs of (file.bscFile as BrsFile).parser.references.classStatements) {
            // eslint-disable-next-line @typescript-eslint/dot-notation
            if (!getAllAnnotations(this.fileMap, cs)['strict']) {
                continue;
            }

            let fieldMap = getAllFields(this.fileMap, cs);
            let funcMap = file.getAllFuncs(cs);
            let skips = {
                'loginfo': true,
                'logwarn': true,
                'logverbose': true,
                'logerror': true,
                'logmethod': true,
                'logdebug': true,
                'setfield': true
            };
            cs.walk(createVisitor({
                DottedSetStatement: (ds) => {
                    if (isVariableExpression(ds.obj) && ds.obj.name.text === 'm') {
                        let lowerName = ds.name.text.toLowerCase();
                        if (!fieldMap[lowerName] && !skips[lowerName]) {
                            addClassFieldsNotFocundOnSetOrGet(file, `${ds.obj.name.text}.${ds.name.text}`, cs.name.text, ds.range);
                        }
                    }
                },
                DottedGetExpression: (ds) => {
                    if (isVariableExpression(ds.obj) && ds.obj.name.text === 'm') {
                        let lowerName = ds.name.text.toLowerCase();
                        if (!fieldMap[lowerName] && !funcMap[lowerName] && !skips[lowerName]) {
                            addClassFieldsNotFocundOnSetOrGet(file, `${ds.obj.name.text}.${ds.name.text}`, cs.name.text, ds.range);
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
        for (let f of cs.fields) {
            let annotation = (f.annotations || []).find((a) => a.name === 'inject' || a.name === 'injectClass' || a.name === 'createClass');
            if (annotation) {
                let args = annotation.getArguments();
                let wf = f as Writeable<ClassFieldStatement>;
                if (annotation.name === 'inject') {
                    if (args.length === 1) {
                        wf.initialValue = new RawCodeStatement(`mioc_getInstance("${args[0].toString()}")`, file, f.range);
                    } else if (args.length === 2) {
                        wf.initialValue = new RawCodeStatement(`mioc_getInstance("${args[0].toString()}", "${args[1].toString()}")`, file, f.range);
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
}


export default () => {
    return new MaestroPlugin();
};
