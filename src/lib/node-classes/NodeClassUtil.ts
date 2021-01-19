import { BrsFile, ParseMode, ProgramBuilder, FunctionStatement, ClassStatement, isClassMethodStatement, Program, ClassFieldStatement, createIdentifier, createToken, TokenKind } from 'brighterscript';
import { ProjectFileMap } from '../files/ProjectFileMap';
import { addNodeClassBadDeclaration, addNodeClassCallbackNotDefined, addNodeClassCallbackNotFound, addNodeClassDuplicateName, addNodeClassFieldNoFieldType, addNodeClassWrongNewSignature as addNodeClassWrongNewSignature, addNodeClassNoExtendNodeFound, addNodeClassNoNodeRunMethod, addNodeClassCallbackWrongParams } from '../utils/Diagnostics';
import { FileFactory } from '../utils/FileFactory';

import { NodeClass, NodeClassType, NodeField } from './NodeClass';

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
    for (let nodeClass of this.fileMap.nodeClassesByPath.get(file.pathAbsolute) || []) {
      this.fileMap.nodeClasses.delete(nodeClass.generatedNodeName);
    }
    this.fileMap.nodeClassesByPath.set(file.pathAbsolute, []);

    for (let cs of file.parser.references.classStatements) {
      let annotation = cs.annotations?.find((a) => a.name.toLowerCase() === 'mtask' || a.name.toLowerCase() === 'mnode');
      let nodeType = NodeClassType.none;
      if (annotation) {
        nodeType = annotation.name.toLowerCase() === 'mtask' ? NodeClassType.task : NodeClassType.node;
        let args = annotation.getArguments();
        let nodeName = args.length === 2 ? (args[0] as string)?.trim() : undefined;
        let extendsName = args.length === 2 ? (args[1] as string)?.trim() : undefined;
        if (nodeType === NodeClassType.task && !isClassMethodStatement(cs.memberMap['noderun'])) {
          addNodeClassNoNodeRunMethod(file, annotation.range.start.line, annotation.range.start.character + 1);
        } else if (args.length < 2 || !nodeName || !extendsName) {
          addNodeClassBadDeclaration(file, annotation.range.start.line, annotation.range.start.character + 1, '');
        } else if (this.fileMap.nodeClasses.has(nodeName)) {
          addNodeClassDuplicateName(file, annotation.range.start.line, annotation.range.start.character + 1, nodeName);
        } else if (!this.fileMap.allXMLComponentFiles.get(extendsName) && (extendsName !== 'Group' && extendsName !== 'Task' && extendsName !== 'Node' && extendsName !== 'ContentNode')) {
          addNodeClassNoExtendNodeFound(file, annotation.range.start.line, annotation.range.start.character, nodeName, extendsName);
        } else {
          let isValid = true;
          if (nodeType === NodeClassType.node) {

            let newFunc = cs.memberMap['new'] as FunctionStatement;
            if (newFunc && newFunc.func.parameters.length !== 3) {
              addNodeClassWrongNewSignature(file, annotation.range.start.line, annotation.range.start.character);
              isValid = false;
            }
          }
          if (isValid) {
            //is valid
            let func = cs.memberMap['noderun'] as FunctionStatement;
            let fields = this.getNodeFields(file, cs);
            let nodeClass = new NodeClass(nodeType, file, cs, func, nodeName, fields, extendsName);
            this.fileMap.nodeClasses.set(nodeClass.generatedNodeName, nodeClass);
            this.fileMap.nodeClassesByPath.get(file.pathAbsolute).push(nodeClass);
          }
        }
      }
    };
  }

  public getNodeFields(file: BrsFile, cs: ClassStatement) {
    let nodeFields = [];
    for (let field of cs.fields.filter((f) => f.annotations?.length > 0)) {
      let annotation = field.annotations.find((a) => a.name === 'MField');
      if (annotation) {

        let args = annotation.getArguments();
        if (args?.length === 0) {
          addNodeClassFieldNoFieldType(file, annotation.range.start.line, annotation.range.start.character, field.name.text);
          continue;
        }

        let observerAnnotation = field.annotations.find((a) => a.name === 'MObserver');
        if (observerAnnotation) {

          let observerArgs = observerAnnotation.getArguments();
          if (observerArgs?.length !== 1) {
            addNodeClassCallbackNotDefined(file, observerAnnotation.range.start.line, observerAnnotation.range.start.character, field.name.text);

          } else if (!cs.methods.find((m) => m.name.text === observerArgs[0])) {
            addNodeClassCallbackNotFound(file, observerAnnotation.range.start.line, observerAnnotation.range.start.character, field.name.text, observerArgs[0] as string, cs.getName(ParseMode.BrighterScript));
            continue;
          } else if (cs.methods.find((m) => m.name.text === observerArgs[0]).func.parameters.length !== 1) {
            addNodeClassCallbackWrongParams(file, observerAnnotation.range.start.line, observerAnnotation.range.start.character, field.name.text, observerArgs[0] as string, cs.getName(ParseMode.BrighterScript));
            continue;
          }
        }

        nodeFields.push(new NodeField(file, field.name.text, annotation, observerAnnotation));
      }
    }

    return nodeFields;
  }


  public createNodeClasses(program: Program) {
    for (let nodeFile of [...this.fileMap.nodeClasses.values()]) {
      nodeFile.generateCode(this.fileFactory, program, this.fileMap);
    }
  }


}

