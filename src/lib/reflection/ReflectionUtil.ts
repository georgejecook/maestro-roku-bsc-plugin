import { BsConfig, BrsFile, ParseMode, XmlFile, ProgramBuilder, FunctionStatement, IfStatement, TokenKind } from 'brighterscript';
import * as path from 'path';

import { File } from '../files/File';
import { ProjectFileMap } from '../files/ProjectFileMap';

import { createIfStatement, createVarExpression } from '../utils/Utils';
import { RawCodeStatement } from '../utils/RawCodeStatement';

/*
Crude brighterscript class processor
 */
export default class ReflectionUtil {
  constructor(
    public fileMap: ProjectFileMap,
    public builder: ProgramBuilder
  ) {
  }

  public updateRuntimeFile() {
    let runtimeFile = this.builder.program.getFileByPkgPath('source/maestro/MRuntime.brs') as BrsFile;
    if (runtimeFile) {
      runtimeFile.needsTranspiled = true;
      this.updateClassLookupFunction(runtimeFile);
      this.updateXMLCompTypesFunction(runtimeFile);
    }

  }

  public updateClassLookupFunction(file: BrsFile) {
    let func = file.ast.statements[0] as FunctionStatement;
    let ifStatement = func?.func?.body?.statements[1] as IfStatement;

    if (ifStatement) {
      let classNames = this.fileMap.classNames;
      let lastIf = ifStatement;
      for (let name of classNames) {
        let nextIf = createIfStatement(createVarExpression('name', TokenKind.Equal, name), [new RawCodeStatement(`return ${name}`)]);
        (lastIf as any).elseBranch = nextIf;
        lastIf = nextIf;
      }
    }
  }

  public updateXMLCompTypesFunction(file: BrsFile) {
    let func = file.ast.statements[1] as FunctionStatement;
    if (func) {
      let text = '{\n';

      let compNames = this.fileMap.XMLComponentNames;
      for (let name of compNames) {
        text += ` "${name}": true \n`;
      }
      text += '}'
      func.func.body.statements.push(new RawCodeStatement(`return ${text}`));
    }
  }

  public addFile(file: BrsFile) {
    for (let cs of file.parser.references.classStatements) {
      let mFile = this.fileMap.allFiles.get(file.pathAbsolute);
      this.fileMap.addClass(cs, file, mFile);
    }
  }

}

