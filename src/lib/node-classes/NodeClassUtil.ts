import type { BrsFile, ProgramBuilder, FunctionStatement, ClassStatement, ClassFieldStatement } from 'brighterscript';
import { isLiteralNumber, isUnaryExpression, isIntegerType, isLongIntegerType, isLiteralExpression, TokenKind, isClassMethodStatement, isAALiteralExpression, isArrayLiteralExpression } from 'brighterscript';
import type { ProjectFileMap } from '../files/ProjectFileMap';
import type { File } from '../files/File';
import { addNodeClassBadDeclaration, addNodeClassDuplicateName, addNodeClassFieldNoFieldType, addNodeClassWrongNewSignature, addNodeClassNoNodeRunMethod } from '../utils/Diagnostics';
import type { FileFactory } from '../utils/FileFactory';

import { NodeClass, NodeClassType, NodeField } from './NodeClass';
import { TokenClass } from 'typescript';

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

    public addFile(file: BrsFile, mFile: File) {
        for (let nodeClass of this.fileMap.nodeClassesByPath.get(file.pathAbsolute) || []) {
            this.fileMap.nodeClasses.delete(nodeClass.name);
            mFile.nodeClasses.delete(nodeClass.name);
        }
        this.fileMap.nodeClassesByPath.delete(file.pathAbsolute);

        for (let cs of file.parser.references.classStatements) {
            let annotation = cs.annotations?.find((a) => a.name.toLowerCase() === 'task' || a.name.toLowerCase() === 'node');
            let lazyAnnotation = cs.annotations?.find((a) => a.name.toLowerCase() === 'lazy');
            let nodeType = NodeClassType.none;
            if (annotation) {
                nodeType = annotation.name.toLowerCase() === 'task' ? NodeClassType.task : NodeClassType.node;
                let args = annotation.getArguments();
                let nodeName = args.length === 2 ? (args[0] as string)?.trim() : undefined;
                let extendsName = args.length === 2 ? (args[1] as string)?.trim() : undefined;
                if (args.length < 2 || !nodeName || !extendsName) {
                    addNodeClassBadDeclaration(file, '', annotation.range.start.line, annotation.range.start.character + 1);
                    console.log(' bad class in ', file.pkgPath);
                } else if (this.fileMap.nodeClasses.has(nodeName)) {
                    addNodeClassDuplicateName(file, nodeName, annotation.range.start.line, annotation.range.start.character + 1);
                    console.log(' duplicate node in ', file.pkgPath);
                } else {
                    let isValid = true;
                    if (nodeType === NodeClassType.node) {

                        let newFunc = cs.memberMap.new as FunctionStatement;
                        if (newFunc && newFunc.func.parameters.length !== 0) {
                            addNodeClassWrongNewSignature(file, annotation.range.start.line, annotation.range.start.character);
                            isValid = false;
                            console.log(' wrong sig in ', file.pkgPath);
                        }
                    }
                    if (isValid) {
                        //is valid
                        let func = cs.memberMap.noderun as FunctionStatement;
                        let fields = this.getNodeFields(file, cs);
                        let nodeClass = new NodeClass(nodeType, file, cs, func, nodeName, extendsName, annotation, this.fileMap, lazyAnnotation !== undefined, fields);
                        this.fileMap.nodeClasses.set(nodeClass.generatedNodeName, nodeClass);
                        let nodeClasses = this.fileMap.nodeClassesByPath.get(file.pathAbsolute);
                        if (!nodeClasses) {
                            nodeClasses = [];
                            this.fileMap.nodeClassesByPath.set(file.pathAbsolute, nodeClasses);
                        }
                        mFile.nodeClasses.set(file.pathAbsolute, nodeClass);
                        nodeClasses.push(nodeClass);
                        // eslint-disable-next-line @typescript-eslint/dot-notation
                        cs['_isNodeClass'] = true;
                    } else {
                        console.log('not adding invalid class', cs.name.text);
                    }
                }
            }
        }
    }

    public getNodeFields(file: BrsFile, cs: ClassStatement) {
        let nodeFields = [];
        for (let field of cs.fields.filter((f) => !f.accessModifier || f.accessModifier.kind === TokenKind.Public)) {
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
                fieldType = 'assocarray';
            }
            console.log('fieldType', fieldType);
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

