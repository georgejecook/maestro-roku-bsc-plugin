// @ts-ignore
import { BrsFile, BsDiagnostic, ClassFieldStatement, ClassMethodStatement, ClassStatement, ParseMode, XmlFile } from 'brighterscript';
import * as fs from 'fs-extra';
import * as path from 'path';

import Binding from '../binding/Binding';
import { addSetItems } from '../utils/Utils';
import { FileType } from './FileType';
import { ProjectFileMap } from './ProjectFileMap';

import { addFileErrorCouldNotParseXML, addFileErrorCouldNotSave } from '../utils/Diagnostics';
import { XMLTag } from '../binding/XMLTag';
import { NodeClass } from '../node-classes/NodeClass';

const xmldoc = require('../utils/xmldoc');

/**
 * describes a file in our project.
 */
export class File {
  
  constructor(fullPath: string, fileContents: string = null) {
    this.componentIds = new Set<string>();
    this._bindings = [];
    this.associatedFile = null;
    this.parentFile = null;
    this.fileContents = fileContents;
    this._fullPath = fullPath;
  }
  
  public static fromFile(bscFile: XmlFile | BrsFile, fileMap: ProjectFileMap): File {
    const file = new File(bscFile.pathAbsolute, bscFile.fileContents);
    file.bscFile = bscFile;
    file.fileMap = fileMap;
    return file;
  }
  
  public classNames = new Set<string>();
  public version = 0;
  public failedBindings: BsDiagnostic[];
  public fileMap: ProjectFileMap;
  public parents: ClassStatement[];
  public bindingClass: ClassStatement;
  private _isDirty: boolean;
  private _fullPath: string;
  public hasProcessedBindings: boolean;
  public isValid: boolean;
  public associatedFile?: File;
  public parentFile?: File;
  public programFile: XmlFile | BrsFile;
  public xmlDoc: any;
  public tagIds = new Set<string>();
  public fieldIds = new Set<string>();
  public componentName: string;
  public parentComponentName: string;
  public componentIds: Set<string>;
  public bscFile: BrsFile | XmlFile;
  public diagnostics: BsDiagnostic[] = [];
  public componentTag: XMLTag;
  public vmClassFile: string;
  public vmClassName: string;
  public vmClassVersion = 0;
  public bindingTargetFiles = new Set<XmlFile>();

  private _bindings: Binding[];
  public fileContents: string;
  public source: string;

  get fileType(): FileType {
    switch (path.extname(this._fullPath).toLowerCase()) {
      case '.brs':
        return this.associatedFile ? FileType.CodeBehind : FileType.Brs;
      case '.xml':
        return FileType.Xml;
      case '.bs':
        return FileType.Bs;
      default:
        return FileType.Other;
    }
  }

  public isASTChanged = false;

  public get isDirty(): boolean {
    return this._isDirty;
  }

  public get bindings(): Binding[] {
    return this._bindings;
  }

  public get fullPath() {
    return this._fullPath;
  }

  public setFileSource(source: string) {
    this.source = source;
    this.setFileContents(source);
  }

  public setFileContents(fileContents: string) {
    this.fileContents = fileContents;
    this._isDirty = true;
  }

  public saveFileContents() {
    try {
      fs.writeFileSync(this.fullPath, this.fileContents, 'utf8');
    } catch (e) {
      addFileErrorCouldNotSave(this);
    }

    this._isDirty = false;
  }

  public unloadContents() {
    this.fileContents = null;
  }

  public getAllParentBindings(bindings: Binding[] = null): Binding[] {
    if (!bindings) {
      bindings = [];
    } else {
      bindings = bindings.concat(this.bindings);
    }
    if (this.parentFile) {
      return this.parentFile.getAllParentBindings(bindings);
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
    if (this.parentFile) {
      return this.parentFile.getAllParentTagIds(ids);
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
    if (this.parentFile) {
      return this.parentFile.getAllParentFieldIds(ids);
    } else {
      return ids;
    }
  }

  public toString(): string {
    return `FILE: ${this.fullPath} TYPE ${this.fileType} PATH ${this.fullPath}`;
  }

  public getPositionFromOffset(targetOffset: number): { line: number; character: number } | undefined {
    let currentLineIndex = 0;
    let currentColumnIndex = 0;
    for (let offset = 0; offset < this.fileContents.length; offset++) {
      if (targetOffset === offset) {
        return {
          line: currentLineIndex,
          character: currentColumnIndex
        };
      }
      if (this.fileContents[offset] === '\n') {
        currentLineIndex++;
        currentColumnIndex = 0;
      } else {
        currentColumnIndex++;
      }
    }
  }

  public loadXmlContents(fileMap: ProjectFileMap) {
    if (this.xmlDoc) {
      return;
    }

    if (this.fileType === FileType.Xml) {
      try {
        this.xmlDoc = new xmldoc.XmlDocument(this.fileContents);
        if (this.xmlDoc.name && this.xmlDoc.name && this.xmlDoc.name.toLowerCase() === 'component') {
          if (this.xmlDoc.attr) {
            if (this.xmlDoc.attr.name) {
              this.componentName = this.xmlDoc.attr.name;
              this.parentComponentName = this.xmlDoc.attr.extends;
              fileMap.addXMLComponent(this);
            }
          }
        }
      } catch (e) {
        addFileErrorCouldNotParseXML(this, e.message);
      }
    }
  }

  public getMethod(name): ClassMethodStatement {
    name = name.toLowerCase();
    let method = this.bindingClass.memberMap[name] as ClassMethodStatement;
    if (!method) {
      for (let parent of this.getParents()) {
        method = parent.memberMap[name] as ClassMethodStatement;
        if (method) {
          return method;
        }
      }
    }
    return method;
  }

  public getField(name): ClassFieldStatement {
    name = name.toLowerCase();
    let field = this.bindingClass.memberMap[name] as ClassFieldStatement;
    if (!field) {
      for (let parent of this.getParents()) {
        field = parent.memberMap[name] as ClassFieldStatement;
        if (field) {
          return field;
        }
      }
    }
    return field;
  }

  public getParents(): ClassStatement[] {
    if (!this.parents) {
      this.parents = [];
      let next = this.bindingClass.parentClassName ? this.fileMap.allClasses.get(this.bindingClass.parentClassName.getName(ParseMode.BrighterScript)) : null;
      while (next) {
        this.parents.push(next);
        next = next.parentClassName ? this.fileMap.allClasses.get(next.parentClassName.getName(ParseMode.BrighterScript)) : null;
      }
    }

    return this.parents;
  }

  resetDiagnostics() {
    this.diagnostics = [];
    if (this.bscFile) {
      (this.bscFile as any).diagnostics = (this.bscFile.getDiagnostics().filter((d) => d.code >= 6900 && d.code <= 6700));
    }
  }

  resetBindings() {
    this.failedBindings = [];
    this.componentIds = new Set<string>();
    this._bindings = [];
    this.tagIds = new Set<string>();
    this.fieldIds = new Set<string>();
    this.failedBindings = [];
  }

}
