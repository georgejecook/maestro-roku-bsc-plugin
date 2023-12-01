import type { BrsFile, BscFile, ClassStatement, FunctionStatement, XmlFile } from 'brighterscript';
import { isFunctionStatement } from 'brighterscript';
import * as brighterscript from 'brighterscript';

import { MaestroFile } from './MaestroFile';
import { FileType } from './FileType';

import { addProjectFileMapErrorDuplicateXMLComp } from '../utils/Diagnostics';
import type { NodeClass } from '../node-classes/NodeClass';

export class ProjectFileMap {

    addProvidedFiles(event: brighterscript.ProvideFileEvent) {
        for (const file of event.files) {
            if (brighterscript.isBrsFile(file) || brighterscript.isXmlFile(file)) {
                // afp(file: (BrsFile | XmlFile)): void {
                // console.log('MAESTRO afp-----', file.srcPath);
                let mFile = this.allFiles[file.srcPath];
                if (!mFile) {
                    mFile = this.createFile(file);
                }
                mFile.bscFile = file;
            }
        }
    }

    constructor() {
        this.allFiles = {};
        this.allXMLComponentFiles = {};
        this.allClassNames = new Set<string>();
    }

    public allClasses: Record<string, ClassStatement> = {};
    public allClassNames: Set<string>;
    public allClassFiles = {};
    public allXMLComponentFiles: Record<string, MaestroFile>;
    public allFiles: Record<string, MaestroFile>;
    public nodeClasses: Record<string, NodeClass> = {};
    public nodeClassesByPath: Record<string, NodeClass[]> = {};
    public pathsByNamespace: Record<string, Record<string, boolean>> = {};
    public allAutoInjectedNamespaceMethods: Record<string, FunctionStatement> = {};

    get XMLComponentNames(): string[] {
        return Object.keys(this.allXMLComponentFiles);
    }

    get files(): MaestroFile[] {
        return Object.values(this.allFiles);
    }

    get classNames(): string[] {
        return [...this.allClassNames.values()];
    }

    public validComps = new Set<string>(
        ['Animation',
            'AnimationBase',
            'ArrayGrid',
            'Audio',
            'BusySpinner',
            'Button',
            'ButtonGroup',
            'ChannelStore',
            'CheckList',
            'ColorFieldInterpolator',
            'ComponentLibrary',
            'ContentNode',
            'Dialog',
            'FloatFieldInterpolator',
            'Font',
            'GridPanel',
            'Group',
            'Keyboard',
            'KeyboardDialog',
            'Label',
            'LabelList',
            'LayoutGroup',
            'ListPanel',
            'MarkupGrid',
            'MarkupList',
            'MaskGroup',
            'MiniKeyboard',
            'Node',
            'Overhang',
            'OverhangPanelSetScene',
            'Panel',
            'PanelSet',
            'ParallelAnimation',
            'ParentalControlPinPad',
            'PinDialog',
            'PinPad',
            'Poster',
            'PosterGrid',
            'ProgressDialog',
            'RadioButtonList',
            'Rectangle',
            'RowList',
            'Scene',
            'ScrollableText',
            'ScrollingLabel',
            'SequentialAnimation',
            'SimpleLabel',
            'SoundEffect',
            'TargetGroup',
            'TargetList',
            'TargetSet',
            'Task',
            'TextEditBox',
            'TimeGrid',
            'Timer',
            'Vector2DFieldInterpolator',
            'Video',
            'ZoomRowList']
    );


    public addXMLComponent(file: MaestroFile) {
        if (file.fileType === FileType.Xml) {
            if (!this.allXMLComponentFiles[file.componentName] || file.fullPath === this.allXMLComponentFiles[file.componentName].fullPath) {
                this.allXMLComponentFiles[file.componentName] = file;
            } else {
                const duplicateFile = this.allXMLComponentFiles[file.componentName];
                addProjectFileMapErrorDuplicateXMLComp(file, duplicateFile.fullPath);
            }
        }
    }

    public addClass(classStatement: ClassStatement, mFile: MaestroFile) {
        let className = classStatement.getName(brighterscript.ParseMode.BrighterScript);
        this.allClassNames.add(className);
        this.allClassFiles[className] = mFile;
        this.allClasses[className] = classStatement;
        mFile.classNames.add(className);
    }
    public addNamespaces(file: BrsFile) {

        for (let ns of file.parser.references.namespaceStatements) {
            let nsName = ns.getName(brighterscript.ParseMode.BrighterScript).toLowerCase();
            let paths = this.pathsByNamespace[nsName];
            if (!paths) {
                paths = {};
            }
            paths[file.pkgPath.toLowerCase().replace('.d.bs', '.bs')] = true;
            this.pathsByNamespace[nsName] = paths;
            for (let func of ns.body.statements) {
                if (isFunctionStatement(func) && func.annotations?.find((a) => a.name === 'injectLocalM')) {
                    this.allAutoInjectedNamespaceMethods[`${nsName}.${func.name.text}`] = func;
                }
            }
        }
    }

    public removeClass(name: string) {
        delete this.allClassNames[name];
        delete this.allClassFiles[name];
        delete this.allClasses[name];
    }

    public removeFileClasses(file: MaestroFile) {
        for (let name of [...file.classNames.values()]) {
            this.removeClass(name);
        }
        file.classNames = new Set();
    }

    public removeFile(file: MaestroFile) {
        this.removeFileClasses(file);
        delete this.allFiles[file.fullPath];
    }

    public getFileForClass(className: string) {
        if (this.allClasses[className]) {
            return this.allClassFiles[className];
        }
        return undefined;
    }

    public addFile(file: MaestroFile) {
        this.removeFile(file);
        if (brighterscript.isBrsFile(file.bscFile)) {
            this.addNamespaces(file.bscFile);
        }
        this.allFiles[file.fullPath] = file;
    }

    public addBscFiles(files: Record<string, BrsFile | XmlFile>) {
        for (let filePath in files) {
            let bscFile = files[filePath];
            let file = this.allFiles[bscFile.srcPath];
            if (file) {
                file.bscFile = bscFile;
            }
        }
    }

    public createFile(bscFile: BscFile): MaestroFile {
        let file = new MaestroFile(bscFile, this);
        this.addFile(file);
        return file;
    }
}
