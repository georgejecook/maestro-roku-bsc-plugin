// @ts-ignore
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
    this._fileContents = fileContents;
    this._fullPath = fullPath;
  }

  public static fromFile(bscFile: XmlFile | BrsFile, fileMap: ProjectFileMap): File {
    const file = new File(bscFile.pathAbsolute, bscFile.fileContents);
    file.bscFile = bscFile;
    file.fileMap = fileMap;
    return file;
  }

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
  public vmClassName: string;

  private readonly _bindings: Binding[];
  private _fileContents: string;

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

  public getFileContents(): string {
    if (this._fileContents === null) {
      this._fileContents = fs.readFileSync(this.fullPath, 'utf8');
    }
    return this._fileContents;
  }

  public setFileContents(fileContents: string) {
    this._fileContents = fileContents;
    this._isDirty = true;
  }

  public saveFileContents() {
    try {
      fs.writeFileSync(this.fullPath, this._fileContents, 'utf8');
    } catch (e) {
      addFileErrorCouldNotSave(this);
    }

    this._isDirty = false;
  }

  public unloadContents() {
    this._fileContents = null;
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
    for (let offset = 0; offset < this._fileContents.length; offset++) {
      if (targetOffset === offset) {
        return {
          line: currentLineIndex,
          character: currentColumnIndex
        };
      }
      if (this._fileContents[offset] === '\n') {
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
        this.xmlDoc = new xmldoc.XmlDocument(this.getFileContents());
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
        next = next.parentClassName ? this.fileMap.allClasses.get(next.parentClassName.getName(ParseMode.BrighterScript)): null;
      }
    }

    return this.parents;
  }
}
