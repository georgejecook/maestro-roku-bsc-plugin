import {
  BinaryExpression,
  Expression,
  ExpressionVisitor,
  FunctionStatement,
  IfStatement,
  ParseMode,
  Parser,
  Statement,
  CancellationToken,
  Range,
  BrsFile,
  BsDiagnostic,
  Lexer,
  XmlFile,
  WalkVisitor,
  WalkOptions,
  Util
} from 'brighterscript';
import { TranspileState } from 'brighterscript/dist/parser/TranspileState';

import { File } from '../fileProcessing/File';
import { FileType } from '../fileProcessing/FileType';
import { ProjectFileMap } from '../fileProcessing/ProjectFileMap';
import {
  addXmlBindingCouldNotParseXML,
  addXmlBindingDuplicateField,
  addXmlBindingDuplicateTag,
  addXmlBindingErrorValidatingBindings,
  addXmlBindingNoCodeBehind,
  addXmlBindingParentHasDuplicateField
} from '../utils/Diagnostics';
import { getAlternateFileNames, makeASTFunction, spliceString } from '../utils/Utils';
import Binding from './Binding';
import { BindingType } from './BindingType';
import { XMLTag } from './XMLTag';
import { SourceNode } from 'source-map';
import { RawCodeStatement } from '../utils/RawCodeStatement';

export class BindingProcessor {
  constructor(fileMap: ProjectFileMap) {
    this.fileMap = fileMap;
  }
  public fileMap: ProjectFileMap;

  public generateCodeForBindings() {
    for (let file of [...this.fileMap.allFiles.values()].filter(
      (file) =>
        file.fileType === FileType.Xml
    )) {
      this.validateBindings(file);

      if (file.isValid) {
        this.generateCodeForXMLFile(file);
      }
    }
  }

  public generateCodeForXMLFile(file: File) {
    if (
      !file ||
      (file.fileType !== FileType.Xml)
    ) {
      throw new Error('was given a non-xml file');
    }
    if (file.associatedFile) {
      this.addFindNodeVarsMethodForFile(file);
    }

    if (file.bindings.length > 0) {
      if (file.associatedFile) {
        this.addBindingMethodsForFile(file);
      } else {
        addXmlBindingNoCodeBehind(file);
      }
    }
  }

  /**
   * given a file, will load it's xml, identify bindings and clear out binding text.
   * @param file - file to parse bindings for
   */
  public parseBindings(file: File) {
    if (!file || file.fileType !== FileType.Xml) {
      throw new Error('was given a non-xml file');
    }
    file.loadXmlContents(this.fileMap);
    let fileContents = file.getFileContents();
    const tagsWithBindings = this.getTagsWithBindings(file);

    for (const tag of tagsWithBindings) {
      for (const binding of tag.bindings) {
        file.componentIds.add(binding.nodeId);
        file.bindings.push(binding);
      }
      fileContents = spliceString(fileContents, tag.startPosition, tag.text);
    }
    file.setFileContents(fileContents);
  }

  public parseBindingsFromBrsFile(file: BrsFile) {
    if (!file.pathAbsolute.toLowerCase().endsWith('.brs') && !file.pathAbsolute.toLowerCase().endsWith('.bs')) {
      return;
    }
    let xmlFilePaths = getAlternateFileNames(file.pathAbsolute);
    if (xmlFilePaths.length === 0) {
      return;
    }
    let xmlFile = file.program.getFileByPathAbsolute(xmlFilePaths[0]) as XmlFile;
    if (!xmlFile) {
      return;
    }
    let mFile = File.fromFile(file);
    let mXMLFile = File.fromFile(xmlFile);
    mXMLFile.loadXmlContents(this.fileMap);
    this.fileMap.addFile(mFile);
    this.fileMap.addFile(mXMLFile);

    let fileContents = mXMLFile.getFileContents();
    const tagsWithBindings = this.getTagsWithBindings(mXMLFile);

    for (const tag of tagsWithBindings) {
      for (const binding of tag.bindings) {
        mFile.componentIds.add(binding.nodeId);
        mFile.bindings.push(binding);
      }
      fileContents = spliceString(fileContents, tag.startPosition, tag.text);
    }
    mXMLFile.setFileContents(fileContents);
    xmlFile.fileContents = fileContents;
  }

  public getTagsWithBindings(file: File): XMLTag[] {
    const tagsWithBindings: XMLTag[] = [];
    try {
      let fileContents = file.getFileContents();
      const doc = file.xmlDoc;
      doc.allElements
        .filter((xmlElement) => {
          return (
            xmlElement.name.toLowerCase() !== 'interface' &&
            xmlElement.name.toLowerCase() !== 'function' &&
            xmlElement.name.toLowerCase() !== 'script' &&
            xmlElement.name.toLowerCase() !== 'children'
          );
        })
        .forEach((xmlElement) => {
          const tagText = fileContents.substring(
            xmlElement.startTagPosition,
            xmlElement.endTagPosition
          );
          xmlElement.children = [];
          const tag = new XMLTag(xmlElement, tagText, file);
          if (tag.isTopTag) {
            if (tag.id) {
              if (file.fieldIds.has(tag.id)) {
                addXmlBindingDuplicateField(file, tag.id, xmlElement.line);
              } else {
                file.fieldIds.add(tag.id);
              }
            }
          } else {
            if (tag.id) {
              if (file.tagIds.has(tag.id)) {
                addXmlBindingDuplicateTag(file, tag.id, xmlElement.line);
              } else {
                file.tagIds.add(tag.id);
              }
            }
          }
          if (tag.bindings.length > 0) {
            tagsWithBindings.push(tag);
          }
        });
    } catch (e) {
      addXmlBindingCouldNotParseXML(file, e.message);
    }

    return tagsWithBindings;
  }

  public validateBindings(file: File) {
    if (
      !file ||
      (file.fileType !== FileType.Xml)
    ) {
      throw new Error('was given a non-xml file');
    }
    if (file.bindings.length > 0 && !file.associatedFile) {
      addXmlBindingNoCodeBehind(file);
    }
    let errorCount = 0;

    try {
      let allParentIds = file.getAllParentTagIds();
      let allParentFieldIds = file.getAllParentFieldIds();
      for (let id of file.fieldIds) {
        if (allParentFieldIds.has(id)) {
          addXmlBindingParentHasDuplicateField(file, id, 1);
          errorCount++;
        }
      }
      for (let id of file.tagIds) {
        if (allParentIds.has(id)) {
          addXmlBindingParentHasDuplicateField(file, id, 1);
          errorCount++;
        }
      }
    } catch (e) {
      addXmlBindingErrorValidatingBindings(file, e.message);
      errorCount++;
    }
    for (let d of file.diagnostics) {
      //fix any missing file refs from diagnostics raised before we had a file
      if (!d.file) {
        d.file = file.bscFile;
      }
    }
    file.isValid = errorCount === 0;
  }

  private addBindingMethodsForFile(file: File) {
    //TODO - use AST for this.
    let bindings = file.bindings.concat(file.getAllParentBindings());
    if (bindings.length > 0) {
      //TODO convert to pure AST
      let bindingInitStatement = this.getBindingInitMethod(
        bindings.filter(
          (b) =>
            b.properties.type !== BindingType.static &&
            b.properties.type !== BindingType.code
        ), file.bscFile as XmlFile);
      let staticBindingStatement = this.getStaticBindingsMethod(bindings.filter(
        (b) =>
          b.properties.type === BindingType.static ||
          b.properties.type === BindingType.code
      ), file.bscFile as XmlFile);

      if (bindingInitStatement) {
        file.associatedFile.bscFile.parser.statements.push(bindingInitStatement);
        file.associatedFile.isASTChanged = true;
      }
      if (staticBindingStatement) {
        file.associatedFile.bscFile.parser.statements.push(staticBindingStatement);
        file.associatedFile.isASTChanged = true;
      }
    }
  }

  private makeASTFunction(source: string): FunctionStatement | undefined {
    let tokens = Lexer.scan(source).tokens;
    let { statements, diagnostics } = Parser.parse(tokens, { mode: ParseMode.BrighterScript });
    if (statements && statements.length > 0) {
      return statements[0] as FunctionStatement;
    }
    return undefined;
  }

  private getBindingInitMethod(bindings: Binding[], file: XmlFile): FunctionStatement {
    let func = makeASTFunction(`function M_initStaticBindings()
      if m.vm <> invalid
      end if
    end function`);

    if (func) {
      let ifStatement = func.func.body.statements[0] as IfStatement;
      let nodeIds = [
        ...new Set(bindings.filter((b) => !b.isTopBinding).map((b) => b.nodeId)),
      ];

      if (nodeIds.length > 0) {
        ifStatement.thenBranch.statements.push(new RawCodeStatement('M_createNodeVars()'));
      }

      for (let binding of bindings) {
        ifStatement.thenBranch.statements.push(new RawCodeStatement(binding.getInitText(), file, binding.getRange()));

      }
      ifStatement.thenBranch.statements.push(new RawCodeStatement('m.vm.onBindingsConfigured()'));
    }

    return func;
  }

  private getStaticBindingsMethod(bindings: Binding[], file: XmlFile): FunctionStatement {
    let func = makeASTFunction(`function M_initStaticBindings()
      if m.vm <> invalid
      end if
    end function`);

    if (func) {
      let ifStatement = func.func.body.statements[0] as IfStatement;
      let nodeIds = [
        ...new Set(bindings.filter((b) => !b.isTopBinding).map((b) => b.nodeId)),
      ];
      if (nodeIds.length > 0) {
        ifStatement.thenBranch.statements.push(new RawCodeStatement('M_createNodeVars()'));
      }

      for (let binding of bindings) {
        ifStatement.thenBranch.statements.push(new RawCodeStatement(binding.getStaticText(), file, binding.getRange(),));

      }
    }
    return func;
  }

  private addFindNodeVarsMethodForFile(file: File) {
    let tagIds = Array.from(file.getAllParentTagIds().values()).concat(
      Array.from(file.tagIds.values())
    );

    //TODO convert to pure AST
    if (tagIds.length > 0) {
      let funcText = 'function M_createNodeVars()';
      funcText +=
        '\n if m._isCreateNodeVarsCalled = true then return invalid else m._isCreateNodeVarsCalled = true';
      funcText += '\n findNodes([' + tagIds.map((id) => `"${id}"`).join(',');
      funcText += '])\n';
      funcText += '\nend function';

      let createNodeVarsFunction = this.makeASTFunction(funcText);
      if (createNodeVarsFunction) {
        file.associatedFile.bscFile.parser.statements.push(createNodeVarsFunction);
        file.associatedFile.isASTChanged = true;
      }

    }
  }
}
