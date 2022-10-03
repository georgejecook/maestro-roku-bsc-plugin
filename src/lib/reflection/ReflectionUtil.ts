import type { BrsFile, FunctionStatement, BscFile, Program } from 'brighterscript';
import type { MaestroConfig } from '../files/MaestroConfig';
import type { ProjectFileMap } from '../files/ProjectFileMap';
import { RawCodeStatement } from '../utils/RawCodeStatement';
import * as minimatch from 'minimatch';

/*
Crude brighterscript class processor
 */
export default class ReflectionUtil {
    constructor(
        public fileMap: ProjectFileMap,
        public program: Program,
        public maestroConfig: MaestroConfig
    ) {
    }

    public updateRuntimeFile() {
        let runtimeFile = this.program.getFile<BrsFile>('source/roku_modules/maestro/reflection/Reflection.brs');
        if (runtimeFile) {
            runtimeFile.needsTranspiled = true;
            this.updateClassLookupFunction(runtimeFile);
            this.updateXMLCompTypesFunction(runtimeFile);
            // eslint-disable-next-line @typescript-eslint/dot-notation
            runtimeFile['diagnostics'] = [];
        }

    }

    public updateClassLookupFunction(file: BrsFile) {
        let func = file.ast.statements[0] as FunctionStatement;
        let that = this;
        if (func?.func?.body?.statements.length > 0) {
            let classNames = this.fileMap.classNames.filter((n: string) => {
                let file = this.fileMap.getFileForClass(n);
                if (!file) {
                    console.log('MISSING FILE for class:', n);
                    return false;
                } else {
                    return that.shouldParseReflectionFile(file.bscFile);
                }
            }).map((n) => n.replace(/\./g, '_'));
            let codeText = `if false
            ? "maestro reflection"`;
            for (let name of classNames) {
                codeText += `\n else if name = "${name}"
                    return ${name}`;
            }
            codeText += '\n end if';
            func.func.body.statements[1] = new RawCodeStatement(codeText);
        }
    }

    public updateXMLCompTypesFunction(file: BrsFile) {
        let func = file.ast.statements[1] as FunctionStatement;
        if (func) {
            let text = '{\n';

            let compNames = this.fileMap.XMLComponentNames;
            for (let name of compNames) {
                text += ` "${name}": true \n`;
            }
            text += '}';
            func.func.body.statements.push(new RawCodeStatement(`return ${text}`));
        }
    }

    public addFile(file: BrsFile) {
        let mFile = this.fileMap.allFiles[file.srcPath];
        this.fileMap.removeFileClasses(mFile);
        for (let cs of file.parser.references.classStatements) {
            this.fileMap.addClass(cs, mFile);
        }
    }

    public shouldParseReflectionFile(file: BscFile) {
        if (this.maestroConfig.reflection.excludeFilters) {
            for (let filter of [...this.maestroConfig.reflection.excludeFilters, '**/components/maestro/generated/*']) {
                if (minimatch(file.srcPath, filter)) {
                    return false;
                }
            }
        }
        return true;
    }
}
