import type { FunctionStatement,
    IfStatement,
    BrsFile,
    XmlFile,
    SourceObj,
    Program } from 'brighterscript';
import {
    ParseMode,
    Parser,
    Lexer,
    util
} from 'brighterscript';

import type { File } from '../files/File';
import { FileType } from '../files/FileType';
import type { ProjectFileMap } from '../files/ProjectFileMap';
import {
    addXmlBindingErrorValidatingBindings,
    addXmlBindingNoCodeBehind,
    addXmlBindingNoVMClassDefined,
    addXmlBindingParentHasDuplicateField,
    addXmlBindingVMClassNotFound
} from '../utils/Diagnostics';
import { createRange, makeASTFunction } from '../utils/Utils';
import type Binding from './Binding';
import { BindingType } from './BindingType';
import { XMLTag } from './XMLTag';
import { RawCodeStatement } from '../utils/RawCodeStatement';
import type { SGComponent, SGNode, SGTag } from 'brighterscript/dist/parser/SGTypes';
import { addImport, createImportStatement } from '../Utils';
import type { FileFactory } from '../utils/FileFactory';

// eslint-disable-next-line
const path = require('path');

export class BindingProcessor {
    constructor(public fileMap: ProjectFileMap, public fileFactory: FileFactory) {
    }

    public generateCodeForXMLFile(file: File, program: Program) {
        if (!file || (file.fileType !== FileType.Xml)
        ) {
            throw new Error('was given a non-xml file');
        }
        if (!file.associatedFile) {
            const bsFilePath = file.fullPath.replace('.xml', 'm.bs');
            console.log('no associated file for ', file.fullPath, 'generating one at ', bsFilePath);
            let bsFile = this.fileFactory.addFile(program, bsFilePath, ``);
            bsFile.parser.invalidateReferences();
        }
        (file.bscFile as XmlFile).parser.invalidateReferences();
        this.addFindNodeVarsMethodForFile(file);
        this.addVMConstructor(file);

        if (file.bindings.length > 0) {
            if (file.associatedFile) {
                this.addBindingMethodsForFile(file);
            } else {
                addXmlBindingNoCodeBehind(file);
            }
        }
        (file.associatedFile.bscFile as BrsFile).parser.invalidateReferences();
    }

    /**
     * given a file, will load it's xml, identify bindings and clear out binding text.
     * @param file - file to parse bindings for
     */
    public parseBindings(file: File) {
        if (!file || file.fileType !== FileType.Xml) {
            throw new Error('was given a non-xml file');
        }
        file.resetBindings();

        //we have to reparse the xml each time we do this..
        let fileContents: SourceObj = {
            pathAbsolute: file.fullPath,
            source: file.bscFile.fileContents
        };
        file.bscFile.parse(fileContents.source);
        file.bindings = this.processElements(file);
    }

    public addNodeVarsMethodForRegularXMLFile(file: File) {
        if (!file || file.fileType !== FileType.Xml) {
            throw new Error('was given a non-xml file');
        }
        if (file.associatedFile) {
            file.resetBindings();

            //we have to reparse the xml each time we do this..
            let fileContents: SourceObj = {
                pathAbsolute: file.fullPath,
                source: file.bscFile.fileContents
            };
            file.bscFile.parse(fileContents.source);
            this.processElementsForTagIds(file);
            if (file.tagIds.size > 0) {
                this.addFindNodeVarsMethodForFile(file);
            }
        }
    }

    public processElementsForTagIds(file: File) {
        let xmlFile = file.bscFile as XmlFile;
        file.componentTag = xmlFile.ast.component;
        for (let sgNode of this.getAllChildren(file.componentTag)) {
            let id = sgNode.getAttributeValue('id');
            if (id) {
                file.tagIds.add(id);
            }
        }
        // console.log('got tagids', file.tagIds);
    }

    private addInitCreateNodeVarsCall(file: BrsFile) {
        let initFunc = file.parser.references.functionStatements.find((f) => f.name.text.toLowerCase() === 'init');
        if (initFunc) {
            initFunc.func.body.statements.splice(0, 0, new RawCodeStatement(`
  m_createNodeVars()
    `));
        }
        if (!initFunc) {
            console.log('init func was not present in ', file.pkgPath, ' adding init function');
            let initFunc = makeASTFunction(`function init()
  m_createNodeVars()
end function`);
            file.parser.references.functionStatements.push(initFunc);
            file.parser.references.functionStatementLookup.set('init', initFunc);
            file.parser.ast.statements.push(initFunc);
        }
    }

    public getAllChildren(component: SGComponent) {
        let result = [] as SGTag[];
        this.getNodeChildren(component.children, result);
        return result;
    }

    public getNodeChildren(node: SGNode, results: SGTag[] = []) {
        if (node) {
            results.push(node);
            if (node.children) {
                for (let child of node.children) {
                    this.getNodeChildren(child, results);
                }
            }
        }
    }

    public processElements(file: File) {
        let xmlFile = file.bscFile as XmlFile;
        file.componentTag = xmlFile.ast.component;
        const allTags = this.getAllChildren(file.componentTag).map((c) => new XMLTag(c, file, false)
        );

        let interfaceFields = file.componentTag.api.fields.map((c) => new XMLTag(c, file, true)
        );
        allTags.push(...interfaceFields);

        for (let tag of allTags) {
            if (tag.id) {
                (tag.isTopTag ? file.fieldIds : file.tagIds).add(tag.id);
            }
        }

        let tagsWithBindings = allTags.filter((t) => t.hasBindings);
        return util.flatMap(tagsWithBindings, (t) => t.bindings);
    }

    public validateBindings(file: File) {
        if (
            !file ||
            (file.fileType !== FileType.Xml)
        ) {
            throw new Error('was given a non-xml file');
        }
        let errorCount = 0;

        try {
            let allParentIds = file.getAllParentTagIds();
            let allParentFieldIds = file.getAllParentFieldIds();
            for (let id of file.fieldIds) {
                if (allParentFieldIds.has(id)) {
                    addXmlBindingParentHasDuplicateField(file, id, 1);
                    errorCount++;
                }
            }
            for (let id of file.tagIds) {
                if (allParentIds.has(id)) {
                    addXmlBindingParentHasDuplicateField(file, id, 1);
                    errorCount++;
                }
            }
        } catch (e) {
            addXmlBindingErrorValidatingBindings(file, e.message);
            errorCount++;
        }

        if (file.bindings.length > 0) {

            // if (!file.associatedFile) {
            //     addXmlBindingNoCodeBehind(file);
            // }

            if (!file.vmClassName) {
                if (errorCount === 0) {
                    addXmlBindingNoVMClassDefined(file);
                    errorCount++;
                }

            } else {

                file.bindingClass = this.fileMap.allClasses.get(file.vmClassName);

                if (!file.bindingClass) {
                    addXmlBindingVMClassNotFound(file);
                    errorCount++;

                } else {
                    for (let binding of file.bindings.filter((b) => b.isValid)) {
                        binding.validateAgainstClass();
                        errorCount += binding.isValid ? 0 : 1;
                    }
                    let bindingFile = this.fileMap.getFileForClass(file.vmClassName);
                    if (bindingFile) {
                        bindingFile.bindingTargetFiles.add(file.bscFile as XmlFile);
                    }
                }
            }
        }

        file.isValid = errorCount === 0;
    }

    private addBindingMethodsForFile(file: File) {
        //TODO - use AST for this.
        let associatedMFile = file.associatedFile.bscFile as BrsFile;
        let bindings = file.bindings.concat(file.getAllParentBindings());
        if (bindings.length > 0) {
            //TODO convert to pure AST
            let bindingInitStatement = this.getBindingInitMethod(
                bindings.filter(
                    (b) => b.properties.type !== BindingType.static &&
                        b.properties.type !== BindingType.code
                ), file.bscFile as XmlFile);
            let staticBindingStatement = this.getStaticBindingsMethod(bindings.filter(
                (b) => b.properties.type === BindingType.static ||
                    b.properties.type === BindingType.code
            ), file.bscFile as XmlFile);

            if (bindingInitStatement) {
                associatedMFile.parser.statements.push(bindingInitStatement);
                file.associatedFile.isASTChanged = true;
            }
            if (staticBindingStatement) {
                associatedMFile.parser.statements.push(staticBindingStatement);
                file.associatedFile.isASTChanged = true;
            }
        }
    }

    private makeASTFunction(source: string): FunctionStatement | undefined {
        let tokens = Lexer.scan(source).tokens;
        let { statements } = Parser.parse(tokens, { mode: ParseMode.BrighterScript });
        if (statements && statements.length > 0) {
            return statements[0] as FunctionStatement;
        }
        return undefined;
    }

    private getBindingInitMethod(bindings: Binding[], file: XmlFile): FunctionStatement {
        let func = makeASTFunction(`function m_initBindings()
      if m.vm <> invalid
      vm = m.vm
      end if
    end function`);

        if (func) {
            let ifStatement = func.func.body.statements[0] as IfStatement;
            let nodeIds = [
                ...new Set(bindings.filter((b) => !b.isTopBinding).map((b) => b.nodeId))
            ];

            for (let binding of bindings) {
                ifStatement.thenBranch.statements.push(new RawCodeStatement(binding.getInitText(), file, binding.range));

            }
            ifStatement.thenBranch.statements.push(new RawCodeStatement(`
      if vm.onBindingsConfigured <> invalid
       vm.onBindingsConfigured()
       end if
       `));
        }

        return func;
    }

    private getStaticBindingsMethod(bindings: Binding[], file: XmlFile): FunctionStatement {
        let func = makeASTFunction(`function m_initStaticBindings()
      if m.vm <> invalid
      vm = m.vm
      end if
    end function`);

        if (func) {
            let ifStatement = func.func.body.statements[0] as IfStatement;
            let nodeIds = [
                ...new Set(bindings.filter((b) => !b.isTopBinding).map((b) => b.nodeId))
            ];

            for (let binding of bindings) {
                ifStatement.thenBranch.statements.push(new RawCodeStatement(binding.getStaticText(), file, binding.range));

            }
        }
        return func;
    }

    private addFindNodeVarsMethodForFile(file: File) {
        let tagIds = Array.from(file.getAllParentTagIds().values()).concat(
            Array.from(file.tagIds.values())
        );

        if (tagIds.length > 0) {
            let funcText = `function m_createNodeVars();
  for each id in [ ${tagIds.map((id) => `"${id}"`).join(',')}]
    m[id] = m.top.findNode(id)
  end for
end function
`;

            let createNodeVarsFunction = this.makeASTFunction(funcText);
            let brsFile = file.associatedFile.bscFile as BrsFile;
            if (createNodeVarsFunction && file.associatedFile?.bscFile?.parser) {
                brsFile.parser.statements.push(createNodeVarsFunction);
                file.associatedFile.isASTChanged = true;
            }
            this.addInitCreateNodeVarsCall(file.associatedFile.bscFile as BrsFile);
        } else {
            // console.log('file has no tags', file.fullPath);
        }

    }

    private addVMConstructor(file: File) {

        let fs = this.getFunctionInParents(file, 'initialize');
        if (!fs) {
            console.log('no initialize function, adding one');
            let func = makeASTFunction(`function createVM()
            m.vm = new ${file.vmClassName}()
            m.vm.initialize()
            mx.initializeBindings()

          end function`);

            if (func) {
                let vmFile = this.fileMap.getFileForClass(file.vmClassName);
                addImport(file.associatedFile.bscFile as BrsFile, vmFile.bscFile.pkgPath);
                (file.associatedFile.bscFile as BrsFile).parser.statements.push(func);
                file.associatedFile.isASTChanged = true;
            }
            return func;
        }

    }

    private getFunctionInParents(file: File, name: string) {
        let fs;
        while (file) {

            fs = (file.associatedFile?.bscFile as BrsFile).parser.references.functionStatementLookup.get('createVM');
            if (fs) {
                return fs;
            }
            file = file.parentFile;
        }
        return undefined;
    }


}
