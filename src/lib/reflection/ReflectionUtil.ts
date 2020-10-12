import { BsConfig, BrsFile, ParseMode, XmlFile, ProgramBuilder, FunctionStatement, IfStatement, ElseIf, Range, TokenKind } from 'brighterscript';
import * as path from 'path';

import { File } from '../files/File';
import { ProjectFileMap } from '../files/ProjectFileMap';

import { createElseIf, createVarExpression } from '../utils/Utils';
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
      for (let name of classNames) {
        ifStatement.elseIfs.push(createElseIf(createVarExpression('name', TokenKind.Equal, name), [new RawCodeStatement(`return ${name}`)]));
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
      this.fileMap.addClass(cs, file);
    }
  }

}

