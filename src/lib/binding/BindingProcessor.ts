import type {
    FunctionStatement,
    IfStatement,
    BrsFile,
    XmlFile,
    SourceObj
} from 'brighterscript';
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
import { makeASTFunction } from '../utils/Utils';
import type Binding from './Binding';
import { BindingType } from './BindingType';
import { XMLTag } from './XMLTag';
import { RawCodeStatement } from '../utils/RawCodeStatement';
import type { SGComponent, SGNode, SGTag } from 'brighterscript/dist/parser/SGTypes';

export class BindingProcessor {
    constructor(fileMap: ProjectFileMap) {
        this.fileMap = fileMap;
    }
    public fileMap: ProjectFileMap;

    public generateCodeForBindings() {
        for (let file of [...this.fileMap.allFiles.values()].filter(
            (file) => file.fileType === FileType.Xml
        )) {
            if (file.isValid) {
                console.log('generating', file.fullPath);
                this.generateCodeForXMLFile(file);
            }
        }
    }

    public generateCodeForXMLFile(file: File) {
        if (!file || (file.fileType !== FileType.Xml)
        ) {
            throw new Error('was given a non-xml file');
        }
        if (file.associatedFile) {
            this.addFindNodeVarsMethodForFile(file);
        }

        if (file.bindings.length > 0) {
            if (file.associatedFile) {
                this.addBindingMethodsForFile(file);
            } else {
                addXmlBindingNoCodeBehind(file);
            }
        }
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

            if (!file.associatedFile) {
                addXmlBindingNoCodeBehind(file);
            }

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
                    for (let binding of file.bindings) {
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

            if (nodeIds.length > 0) {
                ifStatement.thenBranch.statements.push(new RawCodeStatement('m_createNodeVars()'));
            }

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
            if (nodeIds.length > 0) {
                ifStatement.thenBranch.statements.push(new RawCodeStatement('m_createNodeVars()'));
            }

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

        //TODO convert to pure AST
        if (tagIds.length > 0) {
            let funcText = 'function m_createNodeVars()';
            funcText +=
                '\n if m._isCreateNodeVarsCalled = true then return invalid else m._isCreateNodeVarsCalled = true';
            funcText += '\n mv_findNodes([' + tagIds.map((id) => `"${id}"`).join(',');
            funcText += '])\n';
            funcText += '\nend function';

            let createNodeVarsFunction = this.makeASTFunction(funcText);
            if (createNodeVarsFunction && file.associatedFile?.bscFile?.parser) {
                (file.associatedFile.bscFile as BrsFile).parser.statements.push(createNodeVarsFunction);
                file.associatedFile.isASTChanged = true;
            }

        }
    }
}
