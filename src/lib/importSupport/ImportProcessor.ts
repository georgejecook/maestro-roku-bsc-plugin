
import type { BrsFile, Program } from 'brighterscript';
import { createToken, TokenKind } from 'brighterscript';

import { ImportStatement } from 'brighterscript/dist/parser';

import { addBuildTimeErrorImportMissingKey, addBuildTimeErrorImportMissingPkg } from '../utils/Diagnostics';

/**
 * Manages build imports
 */
export default class ImportProcessor {
    constructor(config: any) {
        this.config = config?.maestro || {};
    }

    private config: any;

    private getImportStatements(file: BrsFile, buildKey: string, previousImport: ImportStatement, program: Program) {
        let imports = [];
        let importValues = this.config.buildTimeImports ? this.config.buildTimeImports[buildKey] : null;
        if (importValues) {
            if (importValues.length > 0) {
                for (const pkg of this.config.buildTimeImports[buildKey]) {
                    if (program.getFileByPkgPath(pkg.substring(5))) {
                        let importToken = createToken(TokenKind.Import, 'import', previousImport.importToken.range);
                        let filePathToken = createToken(TokenKind.SourceFilePathLiteral, `"${pkg}"`, previousImport.importToken.range);
                        imports.push(new ImportStatement(importToken, filePathToken));
                    } else {
                        addBuildTimeErrorImportMissingPkg(file, pkg, buildKey, previousImport.range.start.line);
                    }
                }
            } else {
                //this is not an error - it can happen
                // addBuildTimeErrorImportNoImports(file, buildKey, previousImport.range.start.line);
            }
        } else {
            addBuildTimeErrorImportMissingKey(file, buildKey, previousImport.range.start.line);
        }
        return imports;
    }

    public processDynamicImports(file: BrsFile, program: Program) {
        let statementsToRemove = [];
        let statementsToAdd = [];
        for (let importStatement of file.parser.references.importStatements) {
            if (importStatement.filePath.startsWith('build:/')) {
                let key = importStatement.filePath.replace('build:/', '');
                statementsToRemove.push(importStatement);
                statementsToAdd = statementsToAdd.concat(this.getImportStatements(file, key, importStatement, program));
            }
        }

        if (statementsToRemove.length > 0) {
            file.parser.ast.statements = file.parser.ast.statements.filter((el) => !statementsToRemove.includes(el));
            file.parser.ast.statements = statementsToAdd.concat(file.parser.ast.statements);
            file.parser.invalidateReferences();
        }
    }
}
