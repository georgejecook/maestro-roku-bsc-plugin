/* eslint-disable @typescript-eslint/indent */
import type { AnnotationExpression, BrsFile, MethodStatement, ClassStatement, CommentStatement, DottedGetExpression, EnumMemberStatement, FieldStatement, FunctionParameterExpression, Program, XmlFile, Callable } from 'brighterscript';
import { isEnumMemberStatement, isDottedGetExpression, isEnumStatement, isNewExpression, TokenKind, isClassMethodStatement, ParseMode, createVisitor, isVariableExpression, WalkMode, isAALiteralExpression, isArrayLiteralExpression, isIntegerType, isLiteralExpression, isLiteralNumber, isLongIntegerType, isUnaryExpression } from 'brighterscript';
import type { ProjectFileMap } from '../files/ProjectFileMap';
import { expressionToString, expressionToValue, getAllDottedGetParts, sanitizePkgPath } from '../Utils';
import { addNodeClassCallbackNotDefined, addNodeClassCallbackNotFound, addNodeClassCallbackWrongParams, addNodeClassFieldNoFieldType, addNodeClassNoExtendNodeFound, addNodeClassUnknownClassType, addNodeTaskMustExtendTaskComponent, addTooManyPublicParams } from '../utils/Diagnostics';
import type { FileFactory } from '../utils/FileFactory';
import { RawCodeStatement } from '../utils/RawCodeStatement';
import { getAllFields } from '../utils/Utils';
import type { SGField, SGFunction } from 'brighterscript/dist/parser/SGTypes';

// eslint-disable-next-line
const path = require('path');


interface BoundClassField {
    cs: ClassStatement;
    f: FieldStatement;
}

export enum NodeClassType {
    none = 0,
    node = 1,
    task = 2
}


export interface NodeClassMemberRef {
    nodeClass: NodeClass | XmlFile;
    member: Callable | MethodStatement | NodeField | SGField | SGFunction;
}

export class NodeField {
    isEnum: boolean;
    subType: AnnotationExpression;
    constructor(public file: BrsFile, public classStatement: ClassStatement, public field: FieldStatement, public fieldType: string, public observerAnnotation?: AnnotationExpression, public alwaysNotify?: boolean, public debounce?: boolean, public isPossibleClassType = false, public isRootOnlyObserver = false) {
        this.name = field.name.text;
        this.type = isPossibleClassType ? 'assocarray' : fieldType;
        this.classType = isPossibleClassType ? fieldType : '';
        this.value = expressionToString(this.field.initialValue);
        this.callback = observerAnnotation?.getArguments()[0] as string;
    }

    public type: string;
    public name: string;
    public callback: string;
    public value: string;
    public classType: string;
    public numArgs: number;

    getObserverStatementText() {
        return `
    m.top.observeField("${this.name}", "on_${this.name}")`;
    }

    getInterfaceText() {
        let text = `
    <field id="${this.name}" type="${this.type}" `;
        if (this.alwaysNotify) {
            text += ` alwaysNotify="${this.alwaysNotify}" `;
        }
        text += '/>';
        return text;
    }


    private getCallBackFunctionText(code: string) {
        let text = `
        function on_${this.name}(event)
          `;
        if (this.isRootOnlyObserver) {
            text += `v = event.getData()
            if type(v) <> "roSGNode" or not v.isSameNode(m._p_${this.name})
              m._p_${this.name} = v
              ${code}
            end if
            `;
        } else {
            text += code + `
                `;
        }
        text += `end function
            `;
        return text;
    }

    getCallbackStatement() {
        return this.getCallBackFunctionText(`m.${this.callback}(${this.numArgs === 1 ? 'event.getData()' : ''})`);
    }

    getDebouncedCallbackStatement() {
        return this.getCallBackFunctionText(`addCallback("${this.callback}")`);
    }

    getLazyCallbackStatement() {
        return this.getCallBackFunctionText(`_getVM().${this.callback}(${this.numArgs === 1 ? 'event.getData()' : ''})`);
    }

    getLazyDebouncedCallbackStatement() {
        return this.getCallBackFunctionText(`addCallback("${this.callback}")`);
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
        public isLazy: boolean,
        public observersWaitInit: boolean,
        public noCode: boolean
    ) {
        this.generatedNodeName = this.name.replace(/[^a-zA-Z0-9]/g, '_');
        this.bsPath = path.join('components', 'maestro', 'generated', `${this.generatedNodeName}.bs`);
        this.xmlPath = path.join('components', 'maestro', 'generated', `${this.generatedNodeName}.xml`);
        this.nodeFields = this.getNodeFields(this.file, this.classStatement, fileMap);
        let members = this.type === NodeClassType.task ? [] : [...this.getClassMembers(this.classStatement, fileMap).values()];
        this.getPublicMethods(members);
    }
    public generatedNodeName: string;
    public xmlFile: XmlFile;
    public brsFile: BrsFile;
    public bsPath: string;
    public xmlPath: string;
    public nodeFields: NodeField[] = [];
    nodeMembersByName = new Map<string, NodeClassMemberRef>();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    public classMemberFilter = (m: MethodStatement) => isClassMethodStatement(m) && (!m.accessModifier || m.accessModifier.kind === TokenKind.Public) && m.name.text !== 'new';

    private knownFieldTypes = {
        'integer': true,
        'longinteger': true,
        'float': true,
        'string': true,
        'boolean': true,
        'vector2d': true,
        'color': true,
        'time': true,
        'uri': true,
        'node': true,
        'floatarray': true,
        'intarray': true,
        'boolarray': true,
        'stringarray': true,
        'vector2darray': true,
        'colorarray': true,
        'timearray': true,
        'nodearray': true,
        'assocarray': true,
        'array': true,
        'rect2d': true
    };


    resetDiagnostics() {
        if (this.xmlFile) {
            (this.xmlFile as any).diagnostics = [];
        }
        if (this.brsFile) {
            (this.brsFile as any).diagnostics = [];
        }
    }

    getDebounceFunction(isLazy) {
        // eslint-disable-next-line @typescript-eslint/indent
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
    m.top.output = mc_private_taskExec(instance)
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

    private getPublicMethods(members: (FieldStatement | MethodStatement)[]) {
        let text = '';
        for (let member of members.filter(this.classMemberFilter)) {
            member = member as MethodStatement;
            this.nodeMembersByName.set(member.name.text, {
                nodeClass: this,
                member: member
            });
        }

        return text;
    }

    private getNodeBrsCode(members: (FieldStatement | MethodStatement)[]) {
        let text = '';
        for (let member of members.filter(this.classMemberFilter)) {
            let params = (member as MethodStatement).func.parameters;
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
            let enumType = isDottedGetExpression(p.defaultValue) && this.getEnumFromDottedGetExpression(p.defaultValue);

            let defaultValue = enumType ? expressionToValue(this.getEnumFromDottedGetExpression(p.defaultValue as DottedGetExpression
            )) : expressionToValue(p.defaultValue);
            if (typeof defaultValue === 'string') {
                defaultValue = `"${defaultValue}"`;
            }
            return p.name.text + ' = ' + (defaultValue !== undefined ? defaultValue : 'invalid');
        }).join(',')}`;
    }

    private getLazyNodeBrsCode(nodeFile: NodeClass, members: (FieldStatement | MethodStatement)[]) {
        let body = `
        if m.__isVMCreated = invalid
        instance = __${nodeFile.classStatement.getName(ParseMode.BrightScript)}_builder()
        instance.delete("top")
        instance.delete("global")
        top = m.top
        m.append(instance)
        m.__isVMCreated = true
        m.new()
        m.top = top
        `;
        if (this.observersWaitInit) {
            body += `m.isWiringObserversOnInit = true\n`;
        } else {
            body += `m_wireUpObservers()\n`;
        }

        body += `  end if
        return m
        `;
        let text = this.makeFunction('_getVM', '', body);

        for (let member of members.filter(this.classMemberFilter)) {
            let params = (member as MethodStatement).func.parameters;
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
    <script type="text/brightscript" uri="pkg:/source/roku_modules/maestro/private/MaestroPluginUtils.brs" />
    <children>
    </children>
    </component>
    `;
    }

    private getNodeFileXmlText(nodeFile: NodeClass, members: (FieldStatement | MethodStatement)[], program: Program): string {
        let text = `<?xml version="1.0" encoding="UTF-8" ?>
<component
    name="${nodeFile.name}"
    extends="${nodeFile.extendsName}">
  <interface>
    `;
        for (let member of nodeFile.nodeFields) {
            if (!this.getFieldInParents(member.name, program)) {
                text += member.getInterfaceText();
            }
        }
        for (let member of members.filter(this.classMemberFilter)) {

            if (!this.getFunctionInParents(member.name.text, program)) {
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


    private getParentComponentOfType(name: string, program: Program) {
        let comp = program.getComponent(this.extendsName.toLowerCase());
        while (comp) {
            if (comp.file.parser.ast.component.name === name) {
                return true;
            }
            if (comp.file.parser.ast.component.getAttributeValue('extends') === name) {
                return true;
            }
            comp = program.getComponent(comp.file.parser?.references?.extends?.text?.toLowerCase());
        }
        return undefined;
    }

    generateCode(fileFactory: FileFactory, program: Program, fileMap: ProjectFileMap, isIDEBuild: boolean) {
        let members = this.type === NodeClassType.task ? [] : [...this.getClassMembers(this.classStatement, fileMap).values()];
        // if (!isIDEBuild) {
        //     console.log('Generating node class', this.name, 'isIDEBuild?', isIDEBuild
        //     );
        // }
        if (!isIDEBuild && !this.noCode) {
            //update node fields, in case of them being present in base classes
            this.nodeFields = this.getNodeFields(this.file, this.classStatement, fileMap);
            let source = `import "${sanitizePkgPath((this.file as any).destPath ?? this.file.pkgPath)}"\n`;

            let initBody = ``;
            let otherFunctionsText = ``;
            let observerBody = ``;
            let hasDebounce = false;
            if (this.type === NodeClassType.node) {
                for (let member of this.nodeFields) {
                    if (member.isEnum) {
                        initBody += `m.top.${member.name} = ${expressionToString(this.getEnumInitialValue(member.field))}\n`;
                    } else {
                        initBody += `m.top.${member.name} = ${member.value}\n`;
                    }
                    if (member.isRootOnlyObserver) {
                        initBody += `m._p_${member.name} = invalid\n`;
                    }
                }
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
                    if (this.observersWaitInit) {
                        initBody += `m.isWiringObserversOnInit = true\n`;
                    } else {
                        initBody += `m_wireUpObservers()\n`;
                    }
                }

                for (let field of this.nodeFields.filter((f) => f.observerAnnotation)) {
                    observerBody += field.getObserverStatementText() + `\n`;
                    hasDebounce = hasDebounce || field.debounce;
                    if (this.isLazy) {
                        otherFunctionsText += field.debounce ? field.getLazyDebouncedCallbackStatement() : field.getLazyCallbackStatement();
                    } else {
                        otherFunctionsText += field.debounce ? field.getDebouncedCallbackStatement() : field.getCallbackStatement();
                    }
                }
                if (hasDebounce || this.observersWaitInit) {
                    initBody += `
                m.pendingCallbacks = {}
                `;
                }
                source += this.makeFunction('init', '', initBody);
                source += otherFunctionsText;
                source += this.makeFunction('m_wireUpObservers', '', observerBody);
                if (hasDebounce || this.observersWaitInit) {
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

            this.brsFile = fileFactory.addFile(this.bsPath, source);
            this.brsFile.parser.invalidateReferences();
        }
        let xmlText = this.type === NodeClassType.task ? this.getNodeTaskFileXmlText(this) : this.getNodeFileXmlText(this, members, program);

        this.xmlFile = fileFactory.addFile(this.xmlPath, xmlText);
        this.xmlFile.parser.invalidateReferences();
    }

    private getClassMembers(classStatement: ClassStatement, fileMap: ProjectFileMap) {
        let results = new Map<string, FieldStatement | MethodStatement>();
        if (classStatement) {
            let classes = this.getClassHierarchy(classStatement.getName(ParseMode.BrighterScript), fileMap);
            for (let cs of classes) {
                let fields = cs?.fields;
                let methods = cs?.methods;
                for (let member of [...fields, ...methods]) {
                    if (!results.has(member.name.text.toLowerCase())) {
                        results.set(member.name.text.toLowerCase(), member);
                    }
                }
            }
        }
        return results;
    }

    private getClassFields(classStatement: ClassStatement, fileMap: ProjectFileMap) {
        let results = new Map<string, BoundClassField>();
        if (classStatement) {
            let classes = this.getClassHierarchy(classStatement.getName(ParseMode.BrighterScript), fileMap);
            for (let cs of classes) {
                let fields = cs?.fields;
                for (let member of [...fields]) {
                    if (!results.has(member.name.text.toLowerCase())) {
                        results.set(member.name.text.toLowerCase(), { cs: cs, f: member });
                    }
                }
            }
        }
        return results;
    }


    public getClassHierarchy(className: string, fileMap: ProjectFileMap): ClassStatement[] {
        let items = [];
        let parent = fileMap.allClasses[className];
        while (parent) {
            items.push(parent);
            parent = fileMap.allClasses[parent.parentClassName?.getName(ParseMode.BrighterScript)];
        }
        return items;
    }

    public validateBaseComponent(fileMap: ProjectFileMap) {
        let comp = this.file.program.getComponent(this.extendsName.toLowerCase());

        if (!(comp?.file?.componentName?.text === this.extendsName || fileMap.validComps.has(this.extendsName) || fileMap.nodeClasses[this.extendsName])) {
            addNodeClassNoExtendNodeFound(this.file, this.name, this.extendsName, this.annotation.range.start.line, this.annotation.range.start.character);
        }

        if (this.type === NodeClassType.task) {
            if (this.extendsName !== 'Task' && !this.getParentComponentOfType('Task', this.file.program)) {
                addNodeTaskMustExtendTaskComponent(this.file, this.name, this.annotation.range.start.line, this.annotation.range.start.character);
            }
        }

    }

    public validate() {
        for (let field of this.nodeFields.filter((f) => f.classStatement === this.classStatement)) {
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
            if (field.isPossibleClassType && !this.fileMap.allClassNames.has(field.fieldType)) {
                addNodeClassUnknownClassType(this.file, field.name, field.classType, this.classStatement.getName(ParseMode.BrighterScript), field.field.range.start.line, field.field.range.start.character);
            }
        }

        for (let method of this.classStatement.methods.filter(this.classMemberFilter)) {
            if (method.func.parameters.length > 5) {
                addTooManyPublicParams(this.file, method.name.text, this.classStatement.getName(ParseMode.BrighterScript), method.name.range.start.line, method.name.range.start.character);
            }
        }
    }

    public replacePublicMFieldRefs(fileMap: ProjectFileMap) {
        let allTopFields = getAllFields(fileMap, this.classStatement, TokenKind.Public);
        allTopFields.set('id', true as any);
        allTopFields.delete('__classname');
        let logVisitor = createVisitor({
            DottedGetExpression: (de) => {
                if (isVariableExpression(de.obj) && de.obj.name.text === 'm' && allTopFields.get(de.name.text.toLowerCase())) {
                    try {
                        // eslint-disable-next-line
                        (de as any)['obj'] = new RawCodeStatement(`m.top`, this.file, de.range);
                    } catch (e) {
                        console.log(`Error updating m.public field to dotted get: ${this.file.pkgPath} ${e.getMessage()}`);
                    }
                }
            },
            DottedSetStatement: (ds) => {
                if (isVariableExpression(ds.obj) && ds.obj.name.text === 'm' && allTopFields.get(ds.name.text.toLowerCase())) {
                    try {
                        // eslint-disable-next-line
                        (ds as any)['obj'] = new RawCodeStatement(`m.top`, this.file, ds.range);
                    } catch (e) {
                        console.log(`Error updating m.public field to dotted get: ${this.file.pkgPath} ${e.getMessage()}`);
                    }
                }
            }
        });
        this.classStatement.walk(logVisitor, { walkMode: WalkMode.visitAllRecursive });
    }
    getNodeFields(file: BrsFile, cs: ClassStatement, fileMap: ProjectFileMap) {
        let fields: BoundClassField[] = [];
        let members = new Map<string, FieldStatement | MethodStatement>();
        if (this.type !== NodeClassType.task) {
            members = this.getClassMembers(this.classStatement, fileMap);
            fields = [...this.getClassFields(this.classStatement, fileMap).values()];
        }

        let nodeFields = [];
        for (let bf of fields.filter((bf) => (!bf.f.accessModifier || bf.f.accessModifier.kind === TokenKind.Public) && bf.f.name.text.toLocaleLowerCase() !== '__classname')) {
            let field = bf.f;
            let fieldType = this.getFieldType(field);
            let isEnum = false;
            if (!fieldType) {
                fieldType = this.getEnumTypeFromField(field);
                if (fieldType) {
                    isEnum = true;
                } else {
                    addNodeClassFieldNoFieldType(file, field.name.text, field.range.start.line, field.range.start.character);
                    continue;
                }
            }

            let subType = field.annotations?.find((a) => a.name.toLowerCase() === 'subType');
            let debounce = field.annotations?.find((a) => a.name.toLowerCase() === 'debounce') !== undefined;
            let observerAnnotation = field.annotations?.find((a) => a.name.toLowerCase() === 'observer');
            let rootOnly = field.annotations?.find((a) => a.name.toLowerCase() === 'rootonly');
            let alwaysNotify = field.annotations?.find((a) => a.name.toLowerCase() === 'alwaysnotify') !== undefined;
            let observerArgs = observerAnnotation?.getArguments() ?? [];
            let isRootOnly = rootOnly !== undefined || ((observerArgs.length > 2 && observerArgs[1] === true));
            let f = new NodeField(file, bf.cs, field, fieldType, observerAnnotation, alwaysNotify, debounce, !this.knownFieldTypes[fieldType.toLowerCase()], isRootOnly);
            f.isEnum = isEnum;
            f.subType = subType;

            if (observerArgs.length > 0) {
                let observerFunc = members.get((observerArgs[0] as string).toLowerCase());
                if (isClassMethodStatement(observerFunc)) {
                    f.numArgs = observerFunc?.func?.parameters?.length;
                }
            }

            nodeFields.push(f);
            this.nodeMembersByName.set(f.name, {
                nodeClass: this,
                member: f
            });
        }

        return nodeFields;
    }

    getFieldType(field: FieldStatement): string | undefined {
        let fieldType: string;
        if (field.type) {
            fieldType = field.type.text.toLowerCase();
            if (fieldType.endsWith('c.types.assocarray')) {
                fieldType = 'assocarray';
            } else if (fieldType.endsWith('c.types.node')) {
                fieldType = 'node';
            } else if (fieldType.endsWith('c.types.array')) {
                fieldType = 'array';
            } else if (this.getInterfaceFromFieldType(fieldType)) {
                fieldType = 'assocarray';
            } else if (!this.knownFieldTypes[fieldType]) {
                // keep original case
                fieldType = field.type.text;
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
        } else if (isNewExpression(field.initialValue)) {
            fieldType = 'assocarray';
        }
        return fieldType === 'invalid' ? undefined : fieldType;

    }

    getEnumFromField(field: FieldStatement) {
        if (isDottedGetExpression(field.initialValue)) {
            return this.getEnumFromDottedGetExpression(field.initialValue);
        }
        return undefined;
    }

    getEnumFromDottedGetExpression(expression: DottedGetExpression) {
        let enumMap = this.file.program.getFirstScopeForFile(this.file)?.getEnumMap();
        let parts = getAllDottedGetParts(expression);
        let namePart = parts.pop();
        let enumStatement = enumMap.get(parts.join('.').toLowerCase())?.item;
        if (isEnumStatement(enumStatement)) {
            return enumStatement.body.find((value: EnumMemberStatement) => value.name.toLowerCase() === namePart.toLowerCase());
        }
        return undefined;
    }

    getInterfaceFromFieldType(fieldType: string) {
        try {

            let interfaceMap = this.file.program.getFirstScopeForFile(this.file)?.getInterfaceMap();
            return interfaceMap.get(fieldType.toLowerCase())?.item;
        } catch (e) {
            console.log(e);
        }
    }


    getEnumTypeFromField(field: FieldStatement) {
        let enumValue = this.getEnumFromField(field);
        return this.getEnumTypeFromValue(enumValue);
    }

    getEnumTypeFromValue(enumValue: CommentStatement | EnumMemberStatement) {
        if (isEnumMemberStatement(enumValue)) {
            if (isLiteralExpression(enumValue.value)) {
                return enumValue.value.type.toTypeString();
            } else if (isAALiteralExpression(enumValue.value)) {
                return 'assocarray';
            } else if (isArrayLiteralExpression(enumValue.value)) {
                return 'array';
            } else if (isUnaryExpression(enumValue.value) && isLiteralNumber(enumValue.value.right)) {
                if (isIntegerType(enumValue.value.right.type) || isLongIntegerType(enumValue.value.right.type)) {
                    return 'integer';
                } else {
                    return 'float';
                }

            }
            return undefined;
        }
    }

    getEnumInitialValue(field: FieldStatement) {
        let enumValue = this.getEnumFromField(field);
        if (isEnumMemberStatement(enumValue)) {
            return enumValue.value;
        }
    }
}
