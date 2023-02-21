import type { BrsFile, ClassStatement, Program } from 'brighterscript';
import { ParseMode } from 'brighterscript';
import type { ProjectFileMap } from '../files/ProjectFileMap';
import type { File } from '../files/File';
import { addNoCodeAndTaskAnnotation, addNodeClassBadDeclaration, addNodeClassDuplicateName, addNodeClassNoExecuteMethod, addNodeClassWrongNewSignature } from '../utils/Diagnostics';
import type { FileFactory } from '../utils/FileFactory';

import { NodeClass, NodeClassType } from './NodeClass';

/*
Crude brighterscript class processor
 */
export default class NodeClassUtil {
    constructor(
        public fileMap: ProjectFileMap,
        public fileFactory: FileFactory
    ) {
    }

    public addFile(file: BrsFile, mFile: File) {
        for (let nodeClass of this.fileMap.nodeClassesByPath[file.srcPath] || []) {
            delete this.fileMap.nodeClasses[nodeClass.name];
            delete mFile.nodeClasses[nodeClass.name];
        }
        delete this.fileMap.nodeClassesByPath[file.srcPath];

        for (let cs of file.parser.references.classStatements) {
            let annotation = cs.annotations?.find((a) => a.name.toLowerCase() === 'task' || a.name.toLowerCase() === 'node');
            let nodeType = NodeClassType.none;
            if (annotation) {
                let noCodeAnnotation = cs.annotations?.find((a) => a.name.toLowerCase() === 'nocode');
                let lazyAnnotation = cs.annotations?.find((a) => a.name.toLowerCase() === 'lazy');
                let waitInitAnnotation = cs.annotations?.find((a) => a.name.toLowerCase() === 'observerswaitinitialize');

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
                    let newFunc = this.getFuncInThisOrItsParents(cs, 'new');

                    //DONT THINK WE WANT TO ENFORCE THIS
                    // if (!newFunc && !noCodeAnnotation) {
                    //     addNodeClassDoesNotOverrideNewError(file, nodeName, annotation.range.start.line, annotation.range.start.character);
                    // }
                    if (nodeType === NodeClassType.node && !noCodeAnnotation) {
                        if (newFunc && newFunc.func.parameters.length !== 0) {
                            addNodeClassWrongNewSignature(file, annotation.range.start.line, annotation.range.start.character);
                            isValid = false;
                            console.log(' wrong sig in ', file.pkgPath);
                        }
                    }
                    if (nodeType === NodeClassType.task) {
                        if (noCodeAnnotation) {
                            addNoCodeAndTaskAnnotation(file, nodeName, annotation.range.start.line, annotation.range.start.character + 1);
                        }
                        let executeFunction = this.getFuncInThisOrItsParents(cs, 'execute');
                        if (!executeFunction || executeFunction.func.parameters.length !== 1) {
                            addNodeClassNoExecuteMethod(file, annotation.range.start.line, annotation.range.start.character + 1);
                        }
                    }

                    if (isValid) {
                        //is valid
                        let nodeClass = new NodeClass(nodeType, file, cs, nodeName, extendsName, annotation, this.fileMap, lazyAnnotation !== undefined, waitInitAnnotation !== undefined, noCodeAnnotation !== undefined);
                        this.fileMap.nodeClasses[nodeClass.generatedNodeName] = nodeClass;
                        let nodeClasses = this.fileMap.nodeClassesByPath[file.srcPath];
                        if (!nodeClasses) {
                            nodeClasses = [];
                            this.fileMap.nodeClassesByPath[file.srcPath] = nodeClasses;
                        }
                        mFile.nodeClasses.set(file.srcPath, nodeClass);
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
    getFuncInThisOrItsParents(cs: ClassStatement, funcName: string) {
        while (cs) {
            for (let method of cs.methods) {
                if (method.name.text.toLowerCase() === funcName.toLowerCase()) {
                    return method;
                }
            }
            cs = cs.parentClassName ? this.fileMap.allClasses[cs.parentClassName.getName(ParseMode.BrighterScript).replace(/_/g, '.')] : null;
        }

        return undefined;
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

        let brsFile = this.fileFactory.addFile(`source/roku_modules/maestro/tests/TestUtils.brs`, codeText);
        brsFile.parser.invalidateReferences();
    }
}

