import { BsConfig, BrsFile, ParseMode, XmlFile, ProgramBuilder, FunctionStatement, IfStatement, Range, TokenKind, ClassStatement, CommentStatement, createVisitor, isClassStatement, WalkMode, isCommentStatement, isNamespaceStatement, isClassMethodStatement, Program, Statement, createToken, Position, ImportStatement } from 'brighterscript';
import { TranspileState } from 'brighterscript/dist/parser/TranspileState';

const path = require('path');
const fs = require('fs-extra');

import { ProjectFileMap } from '../files/ProjectFileMap';
import { addNodeClassBadDeclaration, addNodeClassDuplicateName, addNodeClassNeedsClassDeclaration, addNodeClassNoExtendNodeFound, addNodeClassNoNodeRunMethod } from '../utils/Diagnostics';
import { FileFactory } from '../utils/FileFactory';

import { RawCodeStatement } from '../utils/RawCodeStatement';
import { NodeClass, NodeClassType } from './NodeClass';

/*
Crude brighterscript class processor
 */
export default class NodeClassUtil {
  constructor(
    public fileMap: ProjectFileMap,
    public builder: ProgramBuilder,
    public fileFactory: FileFactory
  ) {
  }


  public addFile(file: BrsFile) {
    let statements = this.getClassesAndComments(file.ast.statements);
    for (let i = 0; i < statements.length; i++) {
      let comment = isCommentStatement(statements[i]) ? statements[i] : null;
      if (comment) {
        let lastComment = comment.comments[comment.comments.length - 1];
        let matches = (/^(?: *|\t*)'@(MTask)(?: *|\t*)([a-z0-9_]*)*((?: *|\t*)extends(?: *|\t*))*([a-z0-9_]*)*/i).exec(lastComment.text);
        let nodeType = NodeClassType.none;
        if (matches && matches.length > 1) {
          if (matches[1].toLowerCase() === 'mtask') {
            nodeType = NodeClassType.task;
          } else if (matches[1].toLowerCase() === 'mnode') {
            nodeType = NodeClassType.node;
          }
          if (nodeType !== NodeClassType.none) {
            if (matches.length > 4) {
              let next = (i + 1 < statements.length && isClassStatement(statements[i + 1])) ? statements[i + 1] as ClassStatement : null;
              if (!next) {
                addNodeClassNeedsClassDeclaration(file, lastComment.range.start.line, lastComment.range.start.character);
              } else if (!isClassMethodStatement(next.memberMap['noderun'])) {
                addNodeClassNoNodeRunMethod(file, lastComment.range.start.line, lastComment.range.start.character);
              } else if (matches[2].trim() === '' || matches[4].trim() === '') {
                addNodeClassBadDeclaration(file, lastComment.range.start.line, lastComment.range.start.character, lastComment.text);
              } else if (this.fileMap.nodeClasses.get(matches[1])) {
                addNodeClassDuplicateName(file, lastComment.range.start.line, lastComment.range.start.character, matches[1]);
              } else if (!this.fileMap.allXMLComponentFiles.get(matches[4]) && (matches[4] !== 'Group' && matches[4] !== 'Task' && matches[4] !== 'Node' && matches[4] !== 'ContentNode')) {
                addNodeClassNoExtendNodeFound(file, lastComment.range.start.line, lastComment.range.start.character, matches[2], matches[4]);
              } else if (next) {
                //is valid
                let func = next.memberMap['noderun'];
                let nodeClass = new NodeClass(nodeType, file, next, func, matches[2], matches[4]);
                this.fileMap.nodeClasses.set(nodeClass.name, nodeClass);
              }
            } else {
              addNodeClassBadDeclaration(file, lastComment.range.start.line, lastComment.range.start.character, lastComment.text);
            }
          }
        }
      }
    }

  }
  private getClassesAndComments(statements: Statement[]) {
    let results = [];
    for (let s of statements) {
      if (isClassStatement(s) || isCommentStatement(s)) {
        results.push(s);
      } else if (isNamespaceStatement(s)) {
        results.push(...this.getClassesAndComments(s.body.statements));
      }
    }
    return results;
  }

  public async createNodeClasses(program: Program) {

    for (let nodeFile of [...this.fileMap.nodeClasses.values()]) {
      let xmlText = this.getNodeFileXmlText(nodeFile);
      let xmlPath = path.join('components', 'maestro', 'generated', `${nodeFile.generatedNodeName}.xml`);
      this.fileFactory.addFile(program, xmlPath, xmlText);

      let bsPath = path.join('components', 'maestro', 'generated', `${nodeFile.generatedNodeName}.bs`);
      this.fileFactory.addFile(program, bsPath, '');
      let bsFile = await program.getFileByPkgPath(bsPath) as BrsFile;

      bsFile.parser.statements.push(this.getBrsCode(nodeFile));
      nodeFile.brsFile = bsFile;
      nodeFile.xmlFile = await program.getFileByPkgPath(xmlPath) as XmlFile;
    }
  }

  private getNodeFileXmlText(nodeFile: NodeClass): string {
    return `<?xml version="1.0" encoding="UTF-8" ?>
<component
    name="${nodeFile.name}"
    extends="${nodeFile.extendsName}">
  <interface>
    <field id="args" type="assocarray"/>
    <field id="output" type="assocarray"/>
  </interface>
  <script type="text/brightscript" uri="pkg:/${nodeFile.file.pkgPath}"/>
  <children>
  </children>
</component>
     `;
  }

  private getImportStatement(path: string): ImportStatement {
    return new ImportStatement(
      createToken(TokenKind.Import, 'import', Range.create(Position.create(1, 1), Position.create(1,6))),
      createToken(TokenKind.StringLiteral, path, Range.create(Position.create(1, 7), Position.create(1,7 + path.length))),
      );
  }
  private getBrsCode(nodeFile: NodeClass): RawCodeStatement {
    let text = ``;
    let transpileState = new TranspileState(nodeFile.file);
    if (nodeFile.type === NodeClassType.task) {

      text += `
  function init()
    m.top.functionName = "exec"
  end function

  function exec()
    m.top.output = nodeRun(m.top.args)
  end function`;
    } else {
      text += `
    function init()
    m.instance = nodeRun(m.top.args)
  end function`;
    }

    text += `

  function nodeRun(args)${nodeFile.func.func.body.transpile(transpileState).join('')}
  end function
    `;
    return new RawCodeStatement(text, nodeFile.file, nodeFile.func.range);

  }
}

