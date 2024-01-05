import type { AnnotationExpression, BeforeSerializeFileEvent, BrsFile, ClassStatement, FunctionStatement, ProvideFileEvent, SerializeFileEvent } from 'brighterscript';
import { ParseMode, WalkMode, createVisitor, isBrsFile } from 'brighterscript';
import type { ProjectFileMap } from '../files/ProjectFileMap';
import { addNodeClassBadDeclaration, addNodeClassDuplicateName, addNodeClassNoExtendNodeFound, addNodeClassWrongNewSignature } from '../utils/Diagnostics';
import type * as FileFactory from '../utils/FileFactory';

import { NodeClass, NodeClassType } from './NodeClass';

const maestroNodeClassId = '_maestro_NodeClass';
/*
Crude brighterscript class processor
 */
export default class NodeClassUtil {

    constructor(
        public fileMap: ProjectFileMap,
        public fileFactory: FileFactory.FileFactory
    ) {
    }

    processSerializeFileEvent(event: SerializeFileEvent) {
        const nodeClass = event.file[maestroNodeClassId] as NodeClass;
        if (nodeClass && !nodeClass.noCode) {
            //serialize a second file, for the glue code.
            // const files = event.result.get(event.file);
            const files = event.result.get(nodeClass.file);
            files.push({
                pkgPath: nodeClass.brsPath,
                data: Buffer.from(nodeClass.getCodeBehindText())
            });
        }
    }

    processProvideFileEvent(event: ProvideFileEvent) {
        for (const file of event.files.filter(isBrsFile)) {
            const nodeClass = this.processNodeClassFile(file);
            if (nodeClass) {
                this.provideFilesForNodeClass(nodeClass, event);
            }
        }
    }

    provideFilesForNodeClass(nodeClass: NodeClass, event: ProvideFileEvent) {
        const xmlFile = event.fileFactory.XmlFile({
            srcPath: `virtual:/${nodeClass.xmlPath}`,
            destPath: nodeClass.xmlPath
        });
        nodeClass.xmlFile = xmlFile;
        xmlFile.parse(nodeClass.getSimpleXmlText());

        // eslint-disable-next-line @typescript-eslint/dot-notation
        xmlFile[maestroNodeClassId] = nodeClass;

        event.files.push(xmlFile);
    }

    processNodeClassFile(file: BrsFile) {
        let isAnnotationPresent = false;
        let nodeClass;
        file.ast.walk(createVisitor({
            ClassStatement: (node) => {
                let annotation = node.annotations?.find((a) => a.name.toLowerCase() === 'task' || a.name.toLowerCase() === 'node');
                if (annotation) {
                    if (isAnnotationPresent) {
                        //Add diagnostic for multiple nodeclass annotations in one file
                        return undefined;
                    } else {
                        nodeClass = this.processNodeFileAnnotation(annotation, file, node);
                        isAnnotationPresent = true;
                    }
                }
            }
        }), { walkMode: WalkMode.visitStatements });

        return nodeClass;
    }

    private processNodeFileAnnotation(annotation: AnnotationExpression, file: BrsFile, classStatement: ClassStatement): NodeClass | undefined {
        let nodeType = NodeClassType.none;
        if (annotation) {
            let noCodeAnnotation = classStatement.annotations?.find((a) => a.name.toLowerCase() === 'nocode');
            let lazyAnnotation = classStatement.annotations?.find((a) => a.name.toLowerCase() === 'lazy');
            let waitInitAnnotation = classStatement.annotations?.find((a) => a.name.toLowerCase() === 'observerswaitinitialize');

            nodeType = annotation.name.toLowerCase() === 'task' ? NodeClassType.task : NodeClassType.node;
            let args = annotation.getArguments();
            let nodeName = args.length === 2 ? (args[0] as string)?.trim() : undefined;
            let extendsName = args.length === 2 ? (args[1] as string)?.trim() : undefined;
            if (args.length < 2 || !nodeName || !extendsName) {
                addNodeClassBadDeclaration(file, '', annotation.range.start.line, annotation.range.start.character + 1);
                console.log(' bad class in ', file.pkgPath);
            } else if (this.fileMap.nodeClasses[nodeName]) {
                addNodeClassDuplicateName(file, nodeName, annotation.range.start.line, annotation.range.start.character + 1);
                console.log(' duplicate node in ', file.pkgPath);
            } else {
                let isValid = true;
                let newFunc = classStatement.memberMap.new as FunctionStatement;
                // if (!newFunc) {
                //     addNodeClassDoesNotOverrideNewError(file, nodeName, annotation.range.start.line, annotation.range.start.character);
                // }
                if (nodeType === NodeClassType.node) {
                    if (newFunc && newFunc.func.parameters.length !== 0) {
                        addNodeClassWrongNewSignature(file, annotation.range.start.line, annotation.range.start.character);
                        isValid = false;
                        console.log(' wrong sig in ', file.pkgPath);
                    }
                }
                if (nodeType === NodeClassType.task) {
                    let executeFunction = classStatement.memberMap.execute as FunctionStatement;
                    if (!executeFunction || executeFunction.func.parameters.length !== 1) {
                        addNodeClassNoExtendNodeFound(file, nodeName, extendsName, annotation.range.start.line, annotation.range.start.character + 1);
                    }
                }

                if (isValid) {
                    //is valid
                    const nodeClass = new NodeClass(nodeType, file, classStatement, nodeName, extendsName, annotation, this.fileMap, lazyAnnotation !== undefined, waitInitAnnotation !== undefined, noCodeAnnotation !== undefined);
                    let nodeClasses = this.fileMap.nodeClassesByPath[file.srcPath];
                    if (!nodeClasses) {
                        nodeClasses = [];
                        this.fileMap.nodeClassesByPath[file.srcPath] = nodeClasses;

                        const mFile = this.fileMap.allFiles[file.srcPath];
                        //TODO - This should be keyed on namespace.class
                        mFile.nodeClasses.set(file.srcPath, nodeClass);
                        nodeClasses.push(nodeClass);
                        // eslint-disable-next-line @typescript-eslint/dot-notation
                        classStatement['_isNodeClass'] = true;
                        return nodeClass;

                    } else {
                    }
                }
            }
        }
        return undefined;
    }

    generateTestCode(event: BeforeSerializeFileEvent) {
        let codeText = `
        function tests_maestro_nodeClassUtils_createNodeClass(clazz, nodeTop = {}, nodeGlobal = {})
  instance = invalid
  name = mc_getFunctionName(clazz)
  if name = invalid
    return invalid
  end if

  name = lcase(name)

  if false
    ? "maestro nodeclass test-utils"`;
        for (let nc of Object.values(this.fileMap.nodeClasses)) {
            codeText += `\n    else if name = "${nc.classStatement.getName(ParseMode.BrightScript).toLowerCase()}"
    'bs:disable-next-line
    instance = __${nc.classStatement.getName(ParseMode.BrightScript)}_builder()
`;
        }
        codeText += `
  end if
  if instance <> invalid
    instance.top = nodeTop
    instance.global = nodeGlobal
    instance.new()
  end if
  return instance
end function
`;
        event.result.get(event.file)[0].data = Buffer.from(codeText);
    }
}

