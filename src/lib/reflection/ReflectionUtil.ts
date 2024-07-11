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
        let classNames = this.fileMap.classNames.filter((n: string) => {
            let file = this.fileMap.getFileForClass(n);
            if (!file) {
                console.log('MISSING FILE for class:', n);
                return false;
            } else {
                return this.shouldParseReflectionFile(file.bscFile);
            }
        }).map((n) => n.replace(/\./g, '_'));

        let funcIndex = 0;
        const maxFuncs = 4;
        for (let i = 0; i < Math.min(classNames.length, maxFuncs * 250); i += 250) {
            let chunk = classNames.slice(i, i + 250);
            let isLastFunction = (i + 250) >= classNames.length;
            let codeText = this.generateFunctionBody(chunk, isLastFunction, funcIndex);

            let func = file.ast.statements[funcIndex] as FunctionStatement;
            if (func?.func?.body?.statements.length > 0) {
                func.func.body.statements[funcIndex === 0 ? 1 : 0] = new RawCodeStatement(codeText);
            } else {
                console.error(`Function at index ${funcIndex} does not have the expected structure.`);
            }

            funcIndex++;
        }
    }

    generateFunctionBody(classNames: string[], isLastFunction: boolean, index: number): string {
        let codeText = `if false\n    ? "maestro reflection"`;

        for (let name of classNames) {
            codeText += `\nelse if name = "${name}"\n    return ${name}`;
        }

        if (!isLastFunction) {
            let nextFunctionName = `mr_getClass${index + 2}`;
            codeText += `\nelse\n    return ${nextFunctionName}(name)`;
        } else {
            codeText += `\nelse\n    return false`;
        }

        codeText += `\nend if`;

        return codeText;
    }

    public updateXMLCompTypesFunction(file: BrsFile) {
        let func = file.ast.statements[4] as FunctionStatement;
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
