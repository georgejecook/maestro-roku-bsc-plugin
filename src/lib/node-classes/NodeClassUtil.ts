import type { BrsFile, ProgramBuilder, FunctionStatement, Program } from 'brighterscript';
import { ParseMode } from 'brighterscript';
import type { ProjectFileMap } from '../files/ProjectFileMap';
import type { File } from '../files/File';
import { addNodeClassBadDeclaration, addNodeClassDuplicateName, addNodeClassNoExtendNodeFound, addNodeClassWrongNewSignature } from '../utils/Diagnostics';
import type { FileFactory } from '../utils/FileFactory';

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

    public addFile(file: BrsFile, mFile: File) {
        for (let nodeClass of this.fileMap.nodeClassesByPath.get(file.pathAbsolute) || []) {
            this.fileMap.nodeClasses.delete(nodeClass.name);
            mFile.nodeClasses.delete(nodeClass.name);
        }
        this.fileMap.nodeClassesByPath.delete(file.pathAbsolute);

        for (let cs of file.parser.references.classStatements) {
            let annotation = cs.annotations?.find((a) => a.name.toLowerCase() === 'task' || a.name.toLowerCase() === 'node');
            let nodeType = NodeClassType.none;
            if (annotation) {
                let lazyAnnotation = cs.annotations?.find((a) => a.name.toLowerCase() === 'lazy');
                let waitInitAnnotation = cs.annotations?.find((a) => a.name.toLowerCase() === 'observerswaitinitialize');

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
                    if (nodeType === NodeClassType.task) {
                        let executeFunction = cs.memberMap.execute as FunctionStatement;
                        if (!executeFunction || executeFunction.func.parameters.length !== 1) {
                            addNodeClassNoExtendNodeFound(file, nodeName, extendsName, annotation.range.start.line, annotation.range.start.character + 1);
                        }
                    }

                    if (isValid) {
                        //is valid
                        let nodeClass = new NodeClass(nodeType, file, cs, nodeName, extendsName, annotation, this.fileMap, lazyAnnotation !== undefined, waitInitAnnotation !== undefined);
                        this.fileMap.nodeClasses.set(nodeClass.generatedNodeName, nodeClass);
                        let nodeClasses = this.fileMap.nodeClassesByPath.get(file.pathAbsolute);
                        if (!nodeClasses) {
                            nodeClasses = [];
                            this.fileMap.nodeClassesByPath.set(file.pathAbsolute, nodeClasses);
                        }
                        mFile.nodeClasses.set(file.pathAbsolute, nodeClass);
                        nodeClasses.push(nodeClass);
                        //BRON_AST_EDIT_HERE
                        // eslint-disable-next-line @typescript-eslint/dot-notation
                        cs['_isNodeClass'] = true;
                    } else {
                        console.log('not adding invalid class', cs.name.text);
                    }
                }
            }
        }
    }

    generateTestCode(program: Program) {
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
        for (let nc of [...this.fileMap.nodeClasses.values()]) {
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
        //BRON_AST_EDIT_HERE
        let brsFile = this.fileFactory.addFile(program, `source/roku_modules/maestro/tests/TestUtils.brs`, codeText);
        brsFile.parser.invalidateReferences();
    }
}

