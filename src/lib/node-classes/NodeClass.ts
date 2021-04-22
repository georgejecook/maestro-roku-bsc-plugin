import type { AnnotationExpression, BrsFile, ClassFieldStatement, ClassMethodStatement, ClassStatement, FunctionParameterExpression, Program, ProgramBuilder, XmlFile } from 'brighterscript';
import { TokenKind, isClassMethodStatement, ParseMode, createVisitor, isVariableExpression, WalkMode, FunctionStatement, isAALiteralExpression, isArrayLiteralExpression, isIntegerType, isLiteralExpression, isLiteralNumber, isLongIntegerType, isUnaryExpression } from 'brighterscript';
import { TranspileState } from 'brighterscript/dist/parser/TranspileState';
import type { ProjectFileMap } from '../files/ProjectFileMap';
import { expressionToString, expressionToValue } from '../Utils';
import { addNodeClassCallbackNotDefined, addNodeClassCallbackNotFound, addNodeClassCallbackWrongParams, addNodeClassFieldNoFieldType, addNodeClassNoExtendNodeFound } from '../utils/Diagnostics';
import type { FileFactory } from '../utils/FileFactory';
import { RawCodeStatement } from '../utils/RawCodeStatement';
import { getAllFields } from '../utils/Utils';

// eslint-disable-next-line
const path = require('path');


export enum NodeClassType {
    none = 0,
    node = 1,
    task = 2
}

export class NodeField {
    constructor(public file: BrsFile, public field: ClassFieldStatement, public fieldType: string, public observerAnnotation?: AnnotationExpression, public alwaysNotify?: boolean, public debounce?: boolean) {
        this.name = field.name.text;
        this.type = fieldType;
        this.value = expressionToString(this.field.initialValue);
        this.callback = observerAnnotation?.getArguments()[0] as string;
    }

    public type: string;
    public name: string;
    public callback: string;
    public value: string;
    public numArgs: number;

    getObserverStatementText() {
        return `
    m.top.observeField("${this.name}", "on_${this.name}")`;
    }

    getInterfaceText() {
        let text = `
    <field id="${this.name}" type="${this.type}" `;
        if (this.value) {
            text += ` value="${this.value}" `;
        }
        if (this.alwaysNotify) {
            text += ` alwaysNotify="${this.alwaysNotify}" `;
        }
        text += '/>';
        return text;
    }

    getCallbackStatement() {
        return `
    function on_${this.name}(event)
      m.${this.callback}(${this.numArgs === 1 ? 'event.getData()' : ''})
    end function
    `;
    }

    getDebouncedCallbackStatement() {
        return `
    function on_${this.name}()
      addCallback("${this.callback}")
      end function
      `;
    }


    getLazyCallbackStatement() {
        return `
    function on_${this.name}(event)
    _getVM().${this.callback}(${this.numArgs === 1 ? 'event.getData()' : ''})
    end function
    `;

    }
    getLazyDebouncedCallbackStatement() {
        return `
    function on_${this.name}()
      addCallback("${this.callback}")
    end function
    `;
    }
}

export class NodeClass {
    constructor(
        public type: NodeClassType,
        public file: BrsFile,
        public classStatement: ClassStatement,
        public name: string,
        public extendsName: string,
        public annotation: AnnotationExpression,
        public fileMap: ProjectFileMap,
        public isLazy: boolean
    ) {
        this.generatedNodeName = this.name.replace(/[^a-zA-Z0-9]/g, '_');
        this.bsPath = path.join('components', 'maestro', 'generated', `${this.generatedNodeName}.bs`);
        this.xmlPath = path.join('components', 'maestro', 'generated', `${this.generatedNodeName}.xml`);
        this.nodeFields = this.getNodeFields(this.file, this.classStatement, fileMap);
    }
    public generatedNodeName: string;
    public xmlFile: XmlFile;
    public brsFile: BrsFile;
    public bsPath: string;
    public xmlPath: string;
    public nodeFields: NodeField[] = [];
    public classMemberFilter = (m) => isClassMethodStatement(m) && (!m.accessModifier || m.accessModifier.kind === TokenKind.Public) && m.name.text !== 'new';

    resetDiagnostics() {
        if (this.xmlFile) {
            (this.xmlFile as any).diagnostics = [];
        }
        if (this.brsFile) {
            (this.brsFile as any).diagnostics = [];
        }
    }

    getDebounceFunction(isLazy) {
        return `
    function addCallback(funcName)

    m.pendingCallbacks[funcName] = true
     if (m.pendingCallbacks.count() = 1)
        mc.tasks.observeNodeField(m.global.tick, "fire", onTick, "none", true)
      end if
    end function

    function onTick()
      for each funcName in m.pendingCallbacks
        ${isLazy ? `_getVM()
        m.[funcName]()`
        : 'm.[funcName]()'}
      end for
      m.pendingCallbacks = {}
    end function
`;
    }
    private getNodeTaskBrsCode(nodeFile: NodeClass) {
        let text = `
  function init()
      m.top.functionName = "exec"
  end function

  function exec()
    instance = __${nodeFile.classStatement.getName(ParseMode.BrightScript)}_builder()
    instance.delete("top")
    instance.delete("global")
    top = m.top
    m.append(instance)
    m.__isVMCreated = true
    m.new()
    m.top = top
    m.top.output = m.execute(m.top.args)
  end function
    `;
        return text;
    }

    private makeFunction(name, args, bodyText) {
        let funcText = `
    function ${name}(${args})
      ${bodyText}
    end function
    `;
        return funcText;
        // this.brsFile.parser.statements.push(makeASTFunction(funcText));
    }


    private getNodeBrsCode(members: (ClassFieldStatement | ClassMethodStatement)[]) {
        let text = '';
        for (let member of members.filter(this.classMemberFilter)) {
            let params = (member as ClassMethodStatement).func.parameters;
            if (params.length) {
                let args = `${params.map((p) => p.name.text).join(',')}`;
                text += this.makeFunction(member.name.text, this.getWrapperCallFuncParams(params), `
                return m.${member.name.text}(${args})`);
            } else {
                text += this.makeFunction(member.name.text, 'dummy = invalid', `
                return m.${member.name.text}()`);

            }
        }

        return text;
    }
    private getWrapperCallFuncParams(params: FunctionParameterExpression[]) {
        return `${params.map((p) => {
            let defaultValue = expressionToValue(p.defaultValue);
            if (typeof defaultValue === 'string') {
                defaultValue = `"${defaultValue}"`;
            }
            return p.name.text + ' = ' + (defaultValue ? defaultValue : 'invalid');
        }).join(',')}`;

    }

    private getLazyNodeBrsCode(nodeFile: NodeClass, members: (ClassFieldStatement | ClassMethodStatement)[]) {
        let text = this.makeFunction('_getVM', '', `
        if m.__isVMCreated = invalid
            instance = __${nodeFile.classStatement.getName(ParseMode.BrightScript)}_builder()
            instance.delete("top")
            instance.delete("global")
            top = m.top
            m.append(instance)
            m.__isVMCreated = true
            m.new()
            m.top = top
        end if
        return m
        `);

        for (let member of members.filter(this.classMemberFilter)) {
            let params = (member as ClassMethodStatement).func.parameters;
            if (params.length) {
                let args = `${params.map((p) => p.name.text).join(',')}`;
                text += this.makeFunction(member.name.text, this.getWrapperCallFuncParams(params), `
                return _getVM().${member.name.text}(${args})`);
            } else {
                text += this.makeFunction(member.name.text, 'dummy = invalid', `
                return _getVM().${member.name.text}()`);

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
    <function name="exec"/>
    </interface>
    <children>
    </children>
    </component>
    `;
    }

    private getNodeFileXmlText(nodeFile: NodeClass, members: (ClassFieldStatement | ClassMethodStatement)[], program: Program): string {
        let text = `<?xml version="1.0" encoding="UTF-8" ?>
<component
    name="${nodeFile.name}"
    extends="${nodeFile.extendsName}">
  <interface>
    `;
        for (let member of nodeFile.nodeFields) {
            if (!this.getFieldInParents(member.name.toLowerCase(), program)) {
                text += member.getInterfaceText();
            }
        }
        if (!this.getFieldInParents('data', program)) {
            text += `\n    <field id="data" type="assocarray"/>\n`;
        }

        for (let member of members.filter(this.classMemberFilter)) {

            if (!this.getFunctionInParents(member.name.text.toLowerCase(), program)) {
                text += `
                <function name="${member.name.text}"/>`;
            }
        }
        text += `
      </interface>
      <children>
      </children>
      </component>
      `;
        return text;
    }

    private getFieldInParents(name: string, program: Program) {
        let comp = program.getComponent(this.extendsName.toLowerCase());
        while (comp) {
            if (comp.file.parser.ast.component.api.getField(name)) {
                return true;
            }
            comp = program.getComponent(comp.file.parser?.references?.extends?.text?.toLowerCase());
        }
        return false;
    }
    private getFunctionInParents(name: string, program: Program) {
        let comp = program.getComponent(this.extendsName.toLowerCase());
        while (comp) {
            if (comp.file.parser.ast.component.api.getFunction(name)) {
                return true;
            }
            comp = program.getComponent(comp.file.parser?.references?.extends?.text?.toLowerCase());
        }
        return false;
    }

    generateCode(fileFactory: FileFactory, program: Program, fileMap: ProjectFileMap, isIDEBuild: boolean) {
        let members = this.type === NodeClassType.task ? [] : [...this.getClassMembers(this.classStatement, fileMap).values()];

        console.log('Generating node class', this.name, 'isIDEBuild?', isIDEBuild
        );
        if (!isIDEBuild) {
            let source = `import "pkg:/${this.file.pkgPath}"\n`;

            let initBody = ``;
            let otherText = '';
            let hasDebounce = false;
            if (this.type === NodeClassType.node) {
                if (!this.isLazy) {
                    initBody += `
                    instance = __${this.classStatement.getName(ParseMode.BrightScript)}_builder()
                    instance.delete("top")
                    instance.delete("global")
                    top = m.top
                    m.append(instance)
                    m.__isVMCreated = true
                    m.new()
                    m.top = top
                    `;
                }
                for (let field of this.nodeFields.filter((f) => f.observerAnnotation)) {
                    initBody += field.getObserverStatementText() + '\n';
                    hasDebounce = hasDebounce || field.debounce;
                    if (this.isLazy) {
                        otherText += field.debounce ? field.getLazyDebouncedCallbackStatement() : field.getLazyCallbackStatement();
                    } else {
                        otherText += field.debounce ? field.getDebouncedCallbackStatement() : field.getCallbackStatement();
                    }
                }
                if (hasDebounce) {
                    initBody += `
                m.pendingCallbacks = {}
                `;
                }
                source += this.makeFunction('init', '', initBody) + otherText;
                if (hasDebounce) {
                    source = `import "pkg:/source/roku_modules/mc/Tasks.brs"
        ` + source;
                    source += this.getDebounceFunction(this.isLazy);
                }
            }

            source += `function __m_setTopField(field, value)
              if m.top.doesExist(field)
                m.top[field] = value
              end if
              return value
            end function`;

            if (this.type === NodeClassType.task) {
                source += this.getNodeTaskBrsCode(this);
            } else if (this.isLazy) {
                source += this.getLazyNodeBrsCode(this, members);
            } else {
                source += this.getNodeBrsCode(members);
            }

            this.brsFile = fileFactory.addFile(program, this.bsPath, source);
            this.brsFile.parser.invalidateReferences();
        }
        let xmlText = this.type === NodeClassType.task ? this.getNodeTaskFileXmlText(this) : this.getNodeFileXmlText(this, members, program);

        this.xmlFile = fileFactory.addFile(program, this.xmlPath, xmlText);
        this.xmlFile.parser.invalidateReferences();
    }

    private getClassMembers(classStatement: ClassStatement, fileMap: ProjectFileMap) {
        let results = new Map<string, ClassFieldStatement | ClassMethodStatement>();
        if (classStatement) {
            let classes = this.getClassHieararchy(classStatement.getName(ParseMode.BrighterScript), fileMap);
            for (let cs of classes) {
                let fields = cs?.fields;
                let methods = cs?.methods;
                for (let member of [...fields, ...methods]) {
                    if (!results.has(member.name.text.toLowerCase() && member)) {
                        results.set(member.name.text.toLowerCase(), member);
                    }
                }
            }
        }
        return results;
    }

    private getClassFields(classStatement: ClassStatement, fileMap: ProjectFileMap) {
        let results = new Map<string, ClassFieldStatement>();
        if (classStatement) {
            let classes = this.getClassHieararchy(classStatement.getName(ParseMode.BrighterScript), fileMap);
            for (let cs of classes) {
                let fields = cs?.fields;
                for (let member of [...fields]) {
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

    public validateBaseComponent(builder: ProgramBuilder, fileMap: ProjectFileMap) {
        let comp = builder.program.getComponent(this.extendsName.toLowerCase());

        if (!(comp?.file?.componentName?.text === this.extendsName || fileMap.validComps.has(this.extendsName) || fileMap.nodeClasses.has(this.extendsName))) {
            addNodeClassNoExtendNodeFound(this.file, this.name, this.extendsName, this.annotation.range.start.line, this.annotation.range.start.character);
        }
    }

    public validate() {
        for (let field of this.nodeFields) {
            if (field.observerAnnotation) {
                let observerArgs = field.observerAnnotation.getArguments();
                let observerFunc = this.classStatement.methods.find((m) => m.name.text === observerArgs[0]);
                if (observerArgs?.length !== 1) {
                    addNodeClassCallbackNotDefined(this.file, field.name, field.observerAnnotation.range.start.line, field.observerAnnotation.range.start.character);

                } else if (!observerFunc) {
                    addNodeClassCallbackNotFound(this.file, field.name, observerArgs[0] as string, this.classStatement.getName(ParseMode.BrighterScript), field.observerAnnotation.range.start.line, field.observerAnnotation.range.start.character);
                } else if (field.numArgs > 1) {
                    addNodeClassCallbackWrongParams(this.file, field.name, observerArgs[0] as string, this.classStatement.getName(ParseMode.BrighterScript), field.observerAnnotation.range.start.line, field.observerAnnotation.range.start.character);
                }
            }
        }

    }

    public replacePublicMFieldRefs(fileMap: ProjectFileMap) {
        let allTopFields = getAllFields(fileMap, this.classStatement, TokenKind.Public) as any;
        allTopFields.id = true;
        delete (allTopFields.__classname);
        let logVisitor = createVisitor({
            DottedGetExpression: (de) => {
                if (isVariableExpression(de.obj) && de.obj.name.text === 'm' && allTopFields[de.name.text.toLowerCase()]) {
                    try {
                        // eslint-disable-next-line
                        (de as any)['obj'] = new RawCodeStatement(`m.top`, this.file, de.range);
                    } catch (e) {
                        console.log(`Error updating m.public field to dotted get: ${this.file.pkgPath} ${e.getMessage()}`);
                    }
                }
            },
            DottedSetStatement: (ds) => {
                if (isVariableExpression(ds.obj) && ds.obj.name.text === 'm' && allTopFields[ds.name.text.toLowerCase()]) {
                    try {
                        // eslint-disable-next-line
                        (ds as any)['obj'] = new RawCodeStatement(`m.top`, this.file, ds.range);
                    } catch (e) {
                        console.log(`Error updating m.public field to dotted get: ${this.file.pkgPath} ${e.getMessage()}`);
                    }
                }
            }

        }
        );
        this.classStatement.walk(logVisitor, { walkMode: WalkMode.visitAllRecursive });
    }
    getNodeFields(file: BrsFile, cs: ClassStatement, fileMap: ProjectFileMap) {
        let fields = this.type === NodeClassType.task ? [] : [...this.getClassFields(this.classStatement, fileMap).values()];
        let nodeFields = [];
        for (let field of fields.filter((f) => !f.accessModifier || f.accessModifier.kind === TokenKind.Public)) {
            let fieldType = this.getFieldType(field);
            if (!fieldType) {
                addNodeClassFieldNoFieldType(file, field.name.text, field.range.start.line, field.range.start.character);
                continue;
            }

            let debounce = field.annotations?.find((a) => a.name.toLowerCase() === 'debounce') !== undefined;
            let observerAnnotation = field.annotations?.find((a) => a.name.toLowerCase() === 'observer');
            let alwaysNotify = field.annotations?.find((a) => a.name.toLowerCase() === 'alwaysnotify') !== undefined;
            let f = new NodeField(file, field, fieldType, observerAnnotation, alwaysNotify, debounce);
            let observerArgs = observerAnnotation?.getArguments() ?? [];
            if (observerArgs.length > 0) {
                let observerFunc = cs.methods.find((m) => m.name.text === observerArgs[0]);
                f.numArgs = observerFunc?.func?.parameters?.length;
            }

            nodeFields.push(f);
        }

        return nodeFields;
    }

    getFieldType(field: ClassFieldStatement) {
        let fieldType;
        if (field.type) {
            fieldType = field.type.text.toLowerCase();
            if (fieldType === 'mc.types.assocarray') {
                fieldType = 'assocarray';
            } else if (fieldType === 'mc.types.node') {
                fieldType = 'node';
            } else if (fieldType === 'mc.types.array') {
                fieldType = 'array';
            }
            // console.log('fieldType', fieldType);
        } else if (isLiteralExpression(field.initialValue)) {
            fieldType = field.initialValue.type.toTypeString();
        } else if (isAALiteralExpression(field.initialValue)) {
            fieldType = 'assocarray';
        } else if (isArrayLiteralExpression(field.initialValue)) {
            fieldType = 'array';
        } else if (isUnaryExpression(field.initialValue) && isLiteralNumber(field.initialValue.right)) {
            if (isIntegerType(field.initialValue.right.type) || isLongIntegerType(field.initialValue.right.type)) {
                fieldType = 'integer';
            } else {
                fieldType = 'float';
            }
        }
        return fieldType === 'invalid' ? undefined : fieldType;

    }

}
