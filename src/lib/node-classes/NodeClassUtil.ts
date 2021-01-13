import { BsConfig, BrsFile, ParseMode, XmlFile, ProgramBuilder, FunctionStatement, IfStatement, Range, TokenKind, ClassStatement, CommentStatement, createVisitor, isClassStatement, WalkMode, isCommentStatement, isNamespaceStatement, isClassMethodStatement, Program, Statement, createToken, Position, ImportStatement, ClassMethodStatement, ClassFieldStatement } from 'brighterscript';
import { TranspileState } from 'brighterscript/dist/parser/TranspileState';

const path = require('path');
const fs = require('fs-extra');

import { ProjectFileMap } from '../files/ProjectFileMap';
import { addNodeClassBadDeclaration, addNodeClassDuplicateName, addNodeClassNeedsClassDeclaration, addNodeClassNeedsNewDeclaration, addNodeClassNoExtendNodeFound, addNodeClassNoNodeRunMethod } from '../utils/Diagnostics';
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
    for (let nodeClass of this.fileMap.nodeClassesByPath.get(file.pathAbsolute) || []) {
      this.fileMap.nodeClasses.delete(nodeClass.name);
    }
    this.fileMap.nodeClassesByPath.set(file.pathAbsolute, []);

    for (let i = 0; i < statements.length; i++) {
      let comment = isCommentStatement(statements[i]) ? statements[i] : null;
      if (comment) {
        let lastComment = comment.comments[comment.comments.length - 1];
        let matches = (/^(?: *|\t*)'@(MTask|MNode)(?: *|\t*)([a-z0-9_]*)*((?: *|\t*)extends(?: *|\t*))*([a-z0-9_]*)*/i).exec(lastComment.text);
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
              } else if (nodeType === NodeClassType.task && !isClassMethodStatement(next.memberMap['noderun'])) {
                addNodeClassNoNodeRunMethod(file, lastComment.range.start.line, lastComment.range.start.character + 1);
              } else if ((matches[2]?.trim() || '') === '' || (matches[4]?.trim() || '') === '') {
                addNodeClassBadDeclaration(file, lastComment.range.start.line, lastComment.range.start.character + 1, lastComment.text);
              } else if (this.fileMap.nodeClasses.get(matches[2])) {
                addNodeClassDuplicateName(file, lastComment.range.start.line, lastComment.range.start.character + 1, matches[2]);
              } else if (!this.fileMap.allXMLComponentFiles.get(matches[4]) && (matches[4] !== 'Group' && matches[4] !== 'Task' && matches[4] !== 'Node' && matches[4] !== 'ContentNode')) {
                addNodeClassNoExtendNodeFound(file, lastComment.range.start.line, lastComment.range.start.character, matches[2], matches[4]);
              } else if (next) {
                let isValid = true;
                if (nodeType === NodeClassType.node) {

                  let newFunc = next.memberMap['new'] as FunctionStatement;
                  if (!newFunc || newFunc.func.parameters.length !== 2) {
                    addNodeClassNeedsNewDeclaration(file, lastComment.range.start.line, lastComment.range.start.character);
                    isValid = false;
                  }
                }
                if (isValid) {
                  //is valid
                  let func = next.memberMap['noderun'] as FunctionStatement;
                  let nodeClass = new NodeClass(nodeType, file, next, func, matches[2], matches[4]);
                  this.fileMap.nodeClasses.set(nodeClass.name, nodeClass);
                  this.fileMap.nodeClassesByPath.get(file.pathAbsolute).push(nodeClass);
                }
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
      let members = nodeFile.type === NodeClassType.task ? [] : [...this.getClassMembers(nodeFile.classStatement).values()];

      let xmlText = nodeFile.type === NodeClassType.task ? this.getNodeTaskFileXmlText(nodeFile) : this.getNodeFileXmlText(nodeFile, members);
      let xmlPath = path.join('components', 'maestro', 'generated', `${nodeFile.generatedNodeName}.xml`);
      this.fileFactory.addFile(program, xmlPath, xmlText);

      let bsPath = path.join('components', 'maestro', 'generated', `${nodeFile.generatedNodeName}.bs`);
      this.fileFactory.addFile(program, bsPath, '');
      let bsFile = await program.getFileByPkgPath(bsPath) as BrsFile;
      bsFile.parser.statements.push(nodeFile.type === NodeClassType.task ? this.getNodeTaskBrsCode(nodeFile) : this.getNodeBrsCode(nodeFile, members));

      nodeFile.brsFile = bsFile;
      nodeFile.xmlFile = await program.getFileByPkgPath(xmlPath) as XmlFile;
    }
  }

  private getNodeTaskFileXmlText(nodeFile: NodeClass): string {
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

  private getNodeTaskBrsCode(nodeFile: NodeClass): RawCodeStatement {
    let transpileState = new TranspileState(nodeFile.file);

    let text = `
  function init()
    m.top.functionName = "exec"
  end function

  function exec()
    m.top.output = nodeRun(m.top.args)
  end function

  function nodeRun(args)${nodeFile.func.func.body.transpile(transpileState).join('')}
  end function
    `;
    return new RawCodeStatement(text, nodeFile.file, nodeFile.func.range);

  }

  private getNodeFileXmlText(nodeFile: NodeClass, members: (ClassFieldStatement | ClassMethodStatement)[]): string {
    let text = `<?xml version="1.0" encoding="UTF-8" ?>
<component
    name="${nodeFile.name}"
    extends="${nodeFile.extendsName}">
  <interface>
    <field id="data" type="assocarray"/>
    `
    for (let member of members.filter((m) => isClassMethodStatement(m))) {
      text += `
         <function name="${member.name.text}"/>`
    }
    text += `
      </interface>
  <script type="text/brightscript" uri="pkg:/${nodeFile.file.pkgPath}"/>
  <children>
  </children>
</component>
     `;
    return text;
  }

  private getNodeBrsCode(nodeFile: NodeClass, members: (ClassFieldStatement | ClassMethodStatement)[]): RawCodeStatement {
    //TODO - create more code statements from this
    let text = `
    function _getImpl()
      if m._ncImpl = invalid
        m._ncImpl = new ${nodeFile.classStatement.getName(ParseMode.BrighterScript)}(m.top, m.top.data)
      end if
      return m._ncImpl
    end function
  `;

    for (let member of members.filter((m) => isClassMethodStatement(m))) {
      let params = (member as ClassMethodStatement).func.parameters;
      let funcSig = `${member.name.text}(${params.map((p) => p.name.text).join(',')})`;
      text += `
    function ${funcSig}
      return _getImpl().${funcSig}
    end function`;
    }

    return new RawCodeStatement(text, nodeFile.file, Range.create(Position.create(10, 1), Position.create(11, 99999)));

  }

  private getClassMembers(classStatement: ClassStatement) {
    let results = new Map<string, ClassFieldStatement | ClassMethodStatement>();
    if (classStatement) {
      let classes = this.getClassHieararchy(classStatement.getName(ParseMode.BrighterScript));
      for (let cs of classes) {
        for (let member of [...cs?.fields, ...cs?.methods]) {
          if (!results.has(member.name.text.toLowerCase() && member)) {
            results.set(member.name.text.toLowerCase(), member);
          }
        }
      }
    }
    return results;
  }
  public getClassHieararchy(className: string) {
    let items = [];
    let parent = this.fileMap.allClasses.get(className);
    while (parent) {
      items.push(parent);
      parent = this.fileMap.allClasses.get(parent.parentClassName?.getName(ParseMode.BrighterScript));
    }
    return items;
  }

}

