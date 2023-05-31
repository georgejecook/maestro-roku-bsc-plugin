import type { BrsFile, BscFile, ClassStatement, FunctionStatement, InterfaceStatement, Program, XmlFile, XmlScope } from 'brighterscript';
import { isFunctionStatement } from 'brighterscript';
import * as brighterscript from 'brighterscript';

import { File } from './File';
import { FileType } from './FileType';

import { addProjectFileMapErrorDuplicateXMLComp } from '../utils/Diagnostics';
import type { NodeClass, NodeClassMemberRef } from '../node-classes/NodeClass';


export class ProjectFileMap {
    program: Program;
    private _interfaceFile: any;

    constructor(program: Program) {
        this.allFiles = {};
        this.allXMLComponentFiles = {};
        this.allClassNames = new Set<string>();
        this.program = program;
    }

    public allClasses: Record<string, ClassStatement> = {};
    public allClassNames: Set<string>;
    public allClassFiles = {};
    public allXMLComponentFiles: Record<string, File>;
    public allFiles: Record<string, File>;
    public nodeClasses: Record<string, NodeClass> = {};
    public nodeClassesByPath: Record<string, NodeClass[]> = {};
    public pathsByNamespace: Record<string, Record<string, boolean>> = {};
    public allAutoInjectedNamespaceMethods: Record<string, FunctionStatement> = {};

    get interfaceFile(): BrsFile {
        if (!this._interfaceFile) {
            this._interfaceFile = this.program.getFile('source/roku_modules/maestro/private/MaestroFakeInterfaces.bs');
        }
        return this._interfaceFile;
    }

    get XMLComponentNames(): string[] {
        return Object.keys(this.allXMLComponentFiles);
    }

    get files(): File[] {
        return Object.values(this.allFiles);
    }

    get classNames(): string[] {
        return [...this.allClassNames.values()];
    }

    public sceneGraphComponentNames = new Set<string>();
    // public sceneGraphComponentNames = new Set<string>(
    //     ['Animation',
    //         'AnimationBase',
    //         'ArrayGrid',
    //         'Audio',
    //         'BusySpinner',
    //         'Button',
    //         'ButtonGroup',
    //         'ChannelStore',
    //         'CheckList',
    //         'ColorFieldInterpolator',
    //         'ComponentLibrary',
    //         'ContentNode',
    //         'Dialog',
    //         'FloatFieldInterpolator',
    //         'Font',
    //         'GridPanel',
    //         'Group',
    //         'Keyboard',
    //         'KeyboardDialog',
    //         'Label',
    //         'LabelList',
    //         'LayoutGroup',
    //         'ListPanel',
    //         'MarkupGrid',
    //         'MarkupList',
    //         'MaskGroup',
    //         'MiniKeyboard',
    //         'Node',
    //         'Overhang',
    //         'OverhangPanelSetScene',
    //         'Panel',
    //         'PanelSet',
    //         'ParallelAnimation',
    //         'ParentalControlPinPad',
    //         'PinDialog',
    //         'PinPad',
    //         'Poster',
    //         'PosterGrid',
    //         'ProgressDialog',
    //         'RadioButtonList',
    //         'Rectangle',
    //         'RowList',
    //         'Scene',
    //         'ScrollableText',
    //         'ScrollingLabel',
    //         'SequentialAnimation',
    //         'SimpleLabel',
    //         'SoundEffect',
    //         'TargetGroup',
    //         'TargetList',
    //         'TargetSet',
    //         'Task',
    //         'TextEditBox',
    //         'TimeGrid',
    //         'Timer',
    //         'Vector2DFieldInterpolator',
    //         'Video',
    //         'ZoomRowList']
    // );

    getAllNodeMembers(program: Program): Map<string, NodeClassMemberRef[]> {
        const membersMap = new Map<string, NodeClassMemberRef[]>();

        for (const className in this.nodeClasses) {
            const nodeClass = this.nodeClasses[className];
            const nodeMembers = nodeClass.nodeMembersByName;

            for (const [memberName, ref] of nodeMembers) {
                if (!membersMap.has(memberName)) {
                    membersMap.set(memberName, []);
                }

                membersMap.get(memberName).push(ref);
            }
        }

        //and add all xml files in scope
        let scopes = program.getScopes();
        for (const scope of scopes.filter((scope) => brighterscript.isXmlScope(scope))) {
            let xmlFile = (scope as XmlScope).xmlFile;
            let key = xmlFile?.componentName?.text;

            //do not add duplicates for xml comp that has a nodeclass
            //nodeclass will always take precedence!
            if (this.nodeClasses[key]) {
                continue;
            }
            if (!key) {
                console.warn('found xml file with no component name', xmlFile.srcPath);
                continue;
            }
            // `key` represents the key or filename
            // `value` represents the corresponding `File` object

            // Perform operations using the `key` and `value` here
            for (let sgFunction of xmlFile.ast.component.api.functions) {

                if (!membersMap.has(sgFunction.name)) {
                    membersMap.set(sgFunction.name, []);
                }

                const ref: NodeClassMemberRef = {
                    nodeClass: xmlFile,
                    member: sgFunction
                };
                membersMap.get(sgFunction.name).push(ref);
            }
            for (let sgField of xmlFile.ast.component.api.fields) {

                if (!membersMap.has(sgField.id)) {
                    membersMap.set(sgField.id, []);
                }

                const ref: NodeClassMemberRef = {
                    nodeClass: xmlFile,
                    member: sgField
                };
                membersMap.get(sgField.id).push(ref);
            }
        }

        //and add all interfaces in the interfaces file
        let interfaceFile = this.interfaceFile;
        // eslint-disable-next-line @typescript-eslint/dot-notation
        let interfaceReferences = interfaceFile.parser['_references'].interfaceStatements;
        for (const item of interfaceReferences) {
            let interfaceStatement: InterfaceStatement = item as InterfaceStatement;
            for (let interfaceMethod of interfaceStatement.methods) {
                let method = (interfaceMethod as brighterscript.InterfaceMethodStatement);
                let name = method.tokens.name.text;
                if (!membersMap.has(name)) {
                    membersMap.set(name, []);
                }

                const ref: NodeClassMemberRef = {
                    nodeClass: 'scenegraph',
                    member: method
                };
                membersMap.get(name).push(ref);
            }
            for (let interfaceField of interfaceStatement.fields) {
                let field = (interfaceField as brighterscript.InterfaceFieldStatement);

                let name = field.tokens.name.text;
                if (!membersMap.has(name)) {
                    membersMap.set(name, []);
                }

                const ref: NodeClassMemberRef = {
                    nodeClass: 'scenegraph',
                    member: field
                };
                membersMap.get(name).push(ref);
            }
        }

        return membersMap;
    }

    public addXMLComponent(file: File) {
        if (file.fileType === FileType.Xml) {
            if (!this.allXMLComponentFiles[file.componentName] || file.fullPath === this.allXMLComponentFiles[file.componentName].fullPath) {
                this.allXMLComponentFiles[file.componentName] = file;
            } else {
                const duplicateFile = this.allXMLComponentFiles[file.componentName];
                addProjectFileMapErrorDuplicateXMLComp(file, duplicateFile.fullPath);
            }
        }
    }

    public addClass(classStatement: ClassStatement, mFile: File) {
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

    public removeFileClasses(file: File) {
        for (let name of [...file.classNames.values()]) {
            this.removeClass(name);
        }
        file.classNames = new Set();
    }

    public removeFile(file: File) {
        this.removeFileClasses(file);
        delete this.allFiles[file.fullPath];
    }

    public getFileForClass(className: string) {
        if (this.allClasses[className]) {
            return this.allClassFiles[className];
        }
        return undefined;
    }

    public addFile(file: File) {
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

    public createFile(bscFile: BscFile): File {
        let file = new File(bscFile, this);
        this.addFile(file);
        return file;
    }
}
