import { AnnotationExpression, BrsFile, ClassFieldStatement, ClassMethodStatement, ClassStatement, FunctionStatement, isClassMethodStatement, ParseMode, Position, Program, Range, TokenKind, XmlFile } from 'brighterscript';
import { TranspileState } from 'brighterscript/dist/parser/TranspileState';
import { resolve } from 'vscode-languageserver/lib/files';
import { ProjectFileMap } from '../files/ProjectFileMap';
import { FileFactory } from '../utils/FileFactory';
import { RawCodeStatement } from '../utils/RawCodeStatement';
import { makeASTFunction } from '../utils/Utils';

const path = require('path');


export enum NodeClassType {
  none,
  node,
  task,
}

export class NodeField {
  constructor(public file: BrsFile, public name: string, public annotation: AnnotationExpression, public observerAnnotation?: AnnotationExpression) {
    let args = annotation.getArguments();
    this.type = args[0] ? args[0] as string : undefined;
    this.value = args[1] ? args[1] as string : undefined;
    this.callback = observerAnnotation?.getArguments()[0] as string;
  }

  public type: string
  public callback: string
  public value: string

  getObserverStatementText() {
    return `
    m.top.observeField("${this.name}", "on_${this.name}_bridge")`;
  }

  getInterfaceText() {
    let text = `
    <field id="${this.name}" type="${this.type}" `;
    if (this.value) {
      text += ` value="${this.value}" `;
    }
    if (this.callback) {
      text += ` onChange="${this.callback}" `;
    }
    text += '/>';
    return text;
  }

  getCallbackStatement() {
    return `
    function on_${this.name}_bridge()
      _getImpl().${this.callback}(m.top.${this.name})
    end function`;
  }
}

export class NodeClass {
  constructor(
    public type: NodeClassType,
    public file: BrsFile,
    public classStatement: ClassStatement,
    public func: FunctionStatement,
    public name: string,
    public nodeFields: NodeField[] = [],
    public extendsName: string
  ) {
    this.generatedNodeName = this.name.replace(/[^a-zA-Z0-9]/g, "_");
  }
  public generatedNodeName: string;
  public xmlFile: XmlFile;
  public brsFile: BrsFile;
  public classMemberFilter = (m) => isClassMethodStatement(m) && m.name.text !== 'nodeRun' && m.name.text !== 'new' && (!m.accessModifier || m.accessModifier.kind === TokenKind.Public);

  resetDiagnostics() {
    if (this.xmlFile) {
      (this.xmlFile as any).diagnostics = [];
    }
    if (this.brsFile) {
      (this.brsFile as any).diagnostics = [];
    }
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

  private makeFunction(name, bodyText) {
    let funcText = `
    function ${name}()
      ${bodyText}
    end function
    `;
    return funcText;
    // this.brsFile.parser.statements.push(makeASTFunction(funcText));
  }


  private getNodeBrsCode(nodeFile: NodeClass, members: (ClassFieldStatement | ClassMethodStatement)[]) {
    let text = this.makeFunction('_getImpl', `
      if m._ncImpl = invalid
        m._ncImpl = new ${nodeFile.classStatement.getName(ParseMode.BrighterScript)}()
        m._ncImpl.top = m.top
        m._ncImpl.global = m.global
        m._ncImpl.data = m.data
        if m._ncImpl.initialize <> invalid
          m._ncImpl.initialize()
        end if
      end if
      return m._ncImpl
  `);

    for (let member of members.filter(this.classMemberFilter)) {
      let params = (member as ClassMethodStatement).func.parameters;
      if (params.length) {

        let funcSig = `${member.name.text}(${params.map((p) => p.name.text).join(',')})`;
        text += this.makeFunction(funcSig, `
         return _getImpl().${funcSig}`);
      } else {
        text += this.makeFunction(`${member.name.text}(dummy = invalid)`, `
          return _getImpl().${member.name.text}()`);

      }
    }

    return text;
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
    <children>
    </children>
    </component>
    `;
  }

  private getNodeFileXmlText(nodeFile: NodeClass, members: (ClassFieldStatement | ClassMethodStatement)[]): string {
    let text = `<?xml version="1.0" encoding="UTF-8" ?>
<component
    name="${nodeFile.name}"
    extends="${nodeFile.extendsName}">
  <interface>
    <field id="data" type="assocarray"/>
    `

    for (let member of nodeFile.nodeFields) {
      text += member.getInterfaceText();
    }

    for (let member of members.filter(this.classMemberFilter)) {
      text += `
         <function name="${member.name.text}"/>`
    }
    text += `
      </interface>
      <children>
      </children>
      </component>
      `;
    return text;
  }


  generateCode(fileFactory: FileFactory, program: Program, fileMap: ProjectFileMap) {
    let members = this.type === NodeClassType.task ? [] : [...this.getClassMembers(this.classStatement, fileMap).values()];

    let bsPath = path.join('components', 'maestro', 'generated', `${this.generatedNodeName}.bs`);
    let source = `import "pkg:/${this.file.pkgPath}"`;

    let initBody = ``;
    let otherText = '';
    if (this.type === NodeClassType.node) {
      for (let field of this.nodeFields.filter((f) => f.observerAnnotation)) {
        initBody += field.getObserverStatementText() + '\n';
        otherText += field.getCallbackStatement();
      }
      source += this.makeFunction('init', initBody) + otherText;
    }

    if (this.type === NodeClassType.task) {
      this.getNodeTaskBrsCode(this)
    } else {
      source += this.getNodeBrsCode(this, members);
    }


    this.brsFile = fileFactory.addFile(program, bsPath, source);
    this.brsFile.parser.invalidateReferences();
    let xmlText = this.type === NodeClassType.task ? this.getNodeTaskFileXmlText(this) : this.getNodeFileXmlText(this, members);
    let xmlPath = path.join('components', 'maestro', 'generated', `${this.generatedNodeName}.xml`);
    this.xmlFile = fileFactory.addFile(program, xmlPath, xmlText);
    this.xmlFile.parser.invalidateReferences();
  }

  private getClassMembers(classStatement: ClassStatement, fileMap: ProjectFileMap) {
    let results = new Map<string, ClassFieldStatement | ClassMethodStatement>();
    if (classStatement) {
      let classes = this.getClassHieararchy(classStatement.getName(ParseMode.BrighterScript), fileMap);
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


  public getClassHieararchy(className: string, fileMap: ProjectFileMap) {
    let items = [];
    let parent = fileMap.allClasses.get(className);
    while (parent) {
      items.push(parent);
      parent = fileMap.allClasses.get(parent.parentClassName?.getName(ParseMode.BrighterScript));
    }
    return items;
  }

}