import type { BrsFile, BscFile, BsDiagnostic, ClassFieldStatement, ClassMethodStatement, ClassStatement, XmlFile } from 'brighterscript';
import { ParseMode, TokenKind, isClassMethodStatement } from 'brighterscript';

import * as path from 'path';

import type Binding from '../binding/Binding';
import { addSetItems, getAssociatedFile } from '../utils/Utils';
import { FileType } from './FileType';
import type { ProjectFileMap } from './ProjectFileMap';

import { addFileErrorCouldNotParseXML } from '../utils/Diagnostics';
import type { SGComponent } from 'brighterscript/dist/parser/SGTypes';
import type { NodeClass } from '../node-classes/NodeClass';

/**
 * describes a file in our project.
 */
export class File {

    constructor(bscFile: BscFile, fileMap: ProjectFileMap) {
        this.componentIds = new Set<string>();
        this.bindings = [];
        this.bscFile = bscFile;
        this.fileMap = fileMap;
    }

    public classNames = new Set<string>();
    public version = 0;
    public failedBindings: BsDiagnostic[];
    public fileMap: ProjectFileMap;
    public parents: ClassStatement[];
    public bindingClass: ClassStatement;
    public hasProcessedBindings: boolean;
    public isValid: boolean;

    public tagIds = new Set<string>();
    public fieldIds = new Set<string>();
    public componentName: string;
    public parentComponentName: string;
    public componentIds: Set<string>;
    public bscFile: BrsFile | XmlFile;
    public componentTag: SGComponent;
    public vmClassFile: string;
    public vmClassName: string;
    public vmClassVersion = 0;
    public bindingTargetFiles = new Set<XmlFile>();
    public bindings: Binding[];
    public nodeClasses = new Map<string, NodeClass>();

    get parentXmlFile(): XmlFile | undefined {
        return this.fileMap.allXMLComponentFiles[this.parentComponentName]?.bscFile as XmlFile;
    }
    get parentFile(): File | undefined {
        return this.fileMap.allXMLComponentFiles[this.parentComponentName];
    }

    get fileType(): FileType {
        switch (path.extname(this.bscFile.srcPath).toLowerCase()) {
            case '.brs':
                return FileType.Brs;
            case '.xml':
                return FileType.Xml;
            case '.bs':
                return FileType.Bs;
            default:
                return FileType.Other;
        }
    }

    public get associatedFile(): File {
        return getAssociatedFile(this.bscFile, this.fileMap);
    }

    public isASTChanged = false;

    public get fullPath() {
        return this.bscFile.srcPath;
    }

    public getAllParentBindings(bindings: Binding[] = null): Binding[] {
        if (!bindings) {
            bindings = [];
        } else {
            bindings = bindings.concat(this.bindings);
        }
        if (this.parentXmlFile) {
            let parentFile = this.fileMap.allFiles[this.parentXmlFile.srcPath];
            return parentFile?.getAllParentBindings(bindings);
        } else {
            return bindings;
        }
    }

    public getAllParentTagIds(ids: Set<string> = null): Set<string> {
        if (!ids) {
            ids = new Set<string>();
        } else {
            addSetItems(ids, this.tagIds);
        }
        if (this.parentXmlFile) {
            let parentFile = this.fileMap.allFiles[this.parentXmlFile.srcPath];
            return parentFile?.getAllParentTagIds(ids);
        } else {
            return ids;
        }
    }

    public getAllParentFieldIds(ids: Set<string> = null): Set<string> {
        if (!ids) {
            ids = new Set<string>();
        } else {
            addSetItems(ids, this.fieldIds);
        }
        if (this.parentXmlFile) {
            let parentFile = this.fileMap.allFiles[this.parentXmlFile.srcPath];
            return parentFile?.getAllParentFieldIds(ids);
        } else {
            return ids;
        }
    }

    public toString(): string {
        return `FILE: ${this.fullPath} TYPE ${this.fileType} PATH ${this.fullPath}`;
    }

    public loadXmlContents() {
        if (this.fileType === FileType.Xml && this.bscFile) {
            let xmlFile = this.bscFile as XmlFile;

            this.componentName = xmlFile.componentName?.text;
            this.parentComponentName = xmlFile.parentComponentName?.text;
            this.vmClassName = xmlFile.ast.component?.getAttribute('vm')?.value?.text;

            if (this.vmClassName) {
                // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
                xmlFile.ast.component?.setAttribute('vm', undefined);
                xmlFile.needsTranspiled = true;
            }

            if (this.componentName && this.parentComponentName) {
                this.fileMap.addXMLComponent(this);
            } else {
                addFileErrorCouldNotParseXML(this, '');
            }
        }
    }

    public getMethod(name, vis?: TokenKind): ClassMethodStatement {
        name = name.toLowerCase();
        let method = this.bindingClass.memberMap[name] as ClassMethodStatement;
        if (!method) {
            for (let parent of this.getParents()) {
                method = parent.memberMap[name] as ClassMethodStatement;
                if (method) {
                    break;
                }
            }
        }
        if (isClassMethodStatement(method) && (!vis ||
            (method.accessModifier?.kind === vis || (vis === TokenKind.Public && !method.accessModifier)))) {
            return method;
        }

        return undefined;
    }

    public getField(name, vis?: TokenKind): ClassFieldStatement {
        if (!name) {
            return undefined;
        }
        name = name.toLowerCase();
        let field = this.bindingClass.memberMap[name] as ClassFieldStatement;
        if (!field) {
            for (let parent of this.getParents()) {
                field = parent.memberMap[name] as ClassFieldStatement;
                if (field) {
                    break;
                }
            }
        }
        if (field && (!vis || (field.accessModifier?.kind === vis || (vis === TokenKind.Public && !field.accessModifier)))) {
            return field;
        } else {
            return undefined;
        }
    }

    public getAllFuncs(cs: ClassStatement) {
        let result = {};
        while (cs) {
            for (let method of cs.methods) {
                result[method.name.text.toLowerCase()] = true;
            }
            cs = cs.parentClassName ? this.fileMap.allClasses[cs.parentClassName.getName(ParseMode.BrighterScript).replace(/_/g, '.')] : null;
        }

        return result;
    }

    public getParents(): ClassStatement[] {
        if (!this.parents || this.parents.length === 0) {
            this.parents = [];
            let next = this.bindingClass.parentClassName ? this.fileMap.allClasses[this.bindingClass.parentClassName.getName(ParseMode.BrighterScript).replace(/_/g, '.')] : null;
            while (next) {
                this.parents.push(next);
                next = next.parentClassName ? this.fileMap.allClasses[next.parentClassName.getName(ParseMode.BrighterScript).replace(/_/g, '.')] : null;
            }
        }

        return this.parents;
    }

    resetDiagnostics() {
        //clear out diagnostics from maestro; except for xml bindings which would have been reset during an xml file edit
        // (this.bscFile as any).diagnostics = (this.bscFile.getDiagnostics().filter((d) => typeof d.code !== 'string' || !d.code.includes('MSTO') || d.code === 'MSTO1039' || d.code === 'MSTO1015' || d.code === 'MSTO1013' || d.code === 'MSTO1010' || d.code === 'MSTO1045'));
    }

    resetBindings() {
        this.failedBindings = [];
        this.componentIds = new Set<string>();
        this.bindings = [];
        this.tagIds = new Set<string>();
        this.fieldIds = new Set<string>();
        this.failedBindings = [];
    }

}
