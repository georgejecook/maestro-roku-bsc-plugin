import { AnnotationExpression, BrsFile, ClassFieldStatement, ClassMethodStatement, ClassStatement, FunctionStatement, isClassMethodStatement, ParseMode, Position, Program, Range, TokenKind, XmlFile } from 'brighterscript';
import { TranspileState } from 'brighterscript/dist/parser/TranspileState';
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
    this.value = args[1] ? args[1] as string: undefined;
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
    return new RawCodeStatement(`function on_${this.name}_bridge()
      _getImpl().${this.callback}(m.top.${this.name})
    end function`, this.file, this.observerAnnotation?.range);
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


  private getNodeBrsCode(nodeFile: NodeClass, members: (ClassFieldStatement | ClassMethodStatement)[]): RawCodeStatement {
    let text = `
    function _getImpl()
      if m._ncImpl = invalid
        m._ncImpl = ${nodeFile.classStatement.getName(ParseMode.BrightScript)}(m.top, m.top.data)
      end if
      return m._ncImpl
    end function
  `;

    for (let member of members.filter((m) => isClassMethodStatement(m) && m.name.text !== 'nodeRun' && m.name.text !== 'new' && (!m.accessModifier || m.accessModifier.kind === TokenKind.Public))) {
      let params = (member as ClassMethodStatement).func.parameters;
      let funcSig = `${member.name.text}(${params.map((p) => p.name.text).join(',')})`;
      text += `
    function ${funcSig}
      return _getImpl().${funcSig}
    end function`;
    }

    return new RawCodeStatement(text, nodeFile.file, Range.create(Position.create(10, 1), Position.create(11, 99999)));

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
    <script type="text/brightscript" uri="pkg:/${nodeFile.file.pkgPath}"/>
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

    for (let member of members.filter((m) => isClassMethodStatement(m) && m.name.text !== 'nodeRun' && m.name.text !== 'new')) {
      text += `
         <function name="${member.name.text}"/>`
    }
    text += `
      </interface>
      <children>
      </children>
      <script type="text/brightscript" uri="pkg:/${nodeFile.file.pkgPath}"/>
      </component>
      `;
    return text;
  }

  async generateCode(fileFactory: FileFactory, program: Program, fileMap: ProjectFileMap) {
    let members = this.type === NodeClassType.task ? [] : [...this.getClassMembers(this.classStatement, fileMap).values()];

    let xmlText = this.type === NodeClassType.task ? this.getNodeTaskFileXmlText(this) : this.getNodeFileXmlText(this, members);
    let xmlPath = path.join('components', 'maestro', 'generated', `${this.generatedNodeName}.xml`);
    await fileFactory.addFile(program, xmlPath, xmlText);

    let bsPath = path.join('components', 'maestro', 'generated', `${this.generatedNodeName}.bs`);
    await fileFactory.addFile(program, bsPath, '');

    this.brsFile = await program.getFileByPkgPath(bsPath) as BrsFile;

    if (this.type === NodeClassType.node) {
      let initText = `function init()`;
      for (let field of this.nodeFields.filter((f) => f.observerAnnotation)) {
        initText += field.getObserverStatementText();
        this.brsFile.parser.statements.push(field.getCallbackStatement())
      }
      initText += `
      end function`;
      let initFunc = makeASTFunction(initText);
      this.brsFile.parser.statements.push(initFunc);
    }

    this.brsFile.parser.statements.push(this.type === NodeClassType.task ? this.getNodeTaskBrsCode(this) : this.getNodeBrsCode(this, members));


    this.xmlFile = await program.getFileByPkgPath(xmlPath) as XmlFile;
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