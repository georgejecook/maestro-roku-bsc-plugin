import { BrsFile, ClassStatement, ParseMode, XmlFile } from 'brighterscript';

import { getAlternateFileNames } from '../utils/Utils';
import { File } from './File';
import { FileType } from './FileType';

import { addProjectFileMapErrorDuplicateXMLComp } from '../utils/Diagnostics';

export class ProjectFileMap {
  constructor() {
    this.allFiles = new Map<string, File>();
    this.allXMLComponentFiles = new Map<string, File>();
    this.allClassNames = new Set<string>();
  }

  public allClasses = new Map<string, ClassStatement>();
  public allClassNames: Set<string>;
  public allXMLComponentFiles: Map<string, File>;
  public allFiles: Map<string, File>;

  get XMLComponentNames(): string[] {
    return [...this.allXMLComponentFiles.keys()];
  }

  get files(): File[] {
    return [...this.allFiles.values()];
  }

  get classNames(): string[] {
    return [...this.allClassNames.values()];
  }

  public addXMLComponent(file: File) {
    if (file.fileType === FileType.Xml) {
      if (!this.allXMLComponentFiles.has(file.componentName) || file.fullPath === this.allXMLComponentFiles.get(file.componentName).fullPath) {
        this.allXMLComponentFiles.set(file.componentName, file);
      } else {
        const duplicateFile = this.allXMLComponentFiles.get(file.componentName);
        addProjectFileMapErrorDuplicateXMLComp(file, duplicateFile.fullPath);
      }
    }
  }

  public addClass(classStatement: ClassStatement) {
    let className = classStatement.getName(ParseMode.BrighterScript);
    this.allClassNames.add(className);
    this.allClasses.set(className, classStatement);
  }

  public addFile(file: File) {
    this.allFiles.set(file.fullPath, file);
    const alternatePaths = getAlternateFileNames(file.fullPath);
    let alternateFile;
    for (let p of alternatePaths) {
      alternateFile = this.allFiles.get(p);
      if (alternateFile) {
        file.associatedFile = alternateFile;
        alternateFile.associatedFile = file;
        break;
      }
    }
  }

  public addBscFiles(files: { [filePath: string]: BrsFile | XmlFile }) {
    for (let filePath in files) {
      let bscFile = files[filePath];
      let file = this.allFiles.get(bscFile.pathAbsolute);
      if (file) {
        file.bscFile = bscFile;
      }
    }
  }
}
