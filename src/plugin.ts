import type { BrsFile,
    BscFile,
    CompilerPlugin,
    Program, ProgramBuilder,
    TranspileObj,
    XmlFile } from 'brighterscript';
import { ClassFieldStatement,
    createStringLiteral,
    createToken,
    ParseMode,
    TokenKind,
    isBrsFile,
    isXmlFile } from 'brighterscript';

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
        // console.log('afp-----', file.pathAbsolute);
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
        // console.log('afv-----', file.pathAbsolute);
        if (!this.shouldParseFile(file)) {
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
    }

    beforeProgramValidate(program: Program) {
        // console.log('apv-----');
        for (let filePath of [...this.dirtyCompFilePaths.values()]) {
            let file = this.fileMap.allFiles.get(filePath);
            file.bscFile = this.builder.program.getFileByPathAbsolute(filePath);
            file.resetDiagnostics();
            this.bindingProcessor.validateBindings(file);
            if (file.isValid) {
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
                    let id = createToken(TokenKind.Identifier, '__className');
                    let classNameStatement = new ClassFieldStatement(undefined, id, undefined, undefined, createToken(TokenKind.Equal, '='), createStringLiteral('"' + cs.getName(ParseMode.BrighterScript)));
                    cs.body.push(classNameStatement);
                    cs.fields.push(classNameStatement);
                    cs.memberMap.__className = classNameStatement;
                }
            }
        }
    }

}

export default () => {
    return new MaestroPlugin();
};
