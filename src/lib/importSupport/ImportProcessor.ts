
import type { BrsFile, Program } from 'brighterscript';
import { createToken, TokenKind, ImportStatement } from 'brighterscript';
import type { MaestroConfig } from '../files/MaestroConfig';
import { addBuildTimeErrorImportMissingKey } from '../utils/Diagnostics';

/**
 * Manages build imports
 */
export default class ImportProcessor {
    constructor(public config: MaestroConfig) {
    }

    private getImportStatements(file: BrsFile, buildKey: string, previousImport: ImportStatement, program: Program) {
        let imports = [];
        let importValues = this.config.buildTimeImports ? this.config.buildTimeImports[buildKey] : null;
        if (importValues) {
            if (importValues.length > 0) {
                for (const pkg of this.config.buildTimeImports[buildKey]) {
                    let importToken = createToken(TokenKind.Import, 'import', previousImport.importToken.range);
                    let filePathToken = createToken(TokenKind.SourceFilePathLiteral, `"${pkg}"`, previousImport.importToken.range);
                    imports.push(new ImportStatement(importToken, filePathToken));
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
            let statements = file.parser.ast.statements.filter((el) => !statementsToRemove.includes(el));
            statements = statementsToAdd.concat(statements);
            statements = statements.filter((el) => !statementsToRemove.includes(el));
            //TODO once BSC supports dynamic imports like `build:/`, move this functionality to `beforeFileTranspile`
            file.parser.ast.statements = statements;
            file.parser.invalidateReferences();
        }
    }
}
