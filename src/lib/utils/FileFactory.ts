import type { BrsFile, Program, ProgramBuilder, XmlFile } from 'brighterscript';

import * as path from 'path';
import * as fs from 'fs-extra';

export class FileFactory {
    constructor(
        public builder: ProgramBuilder
    ) {
    }
    public ignoredFilePaths = [];
    private frameworkFiles = {
        'Reflection.brs': 'source/roku_modules/maestro/reflection/Reflection.brs'
    };

    public sourcePath = path.join(__dirname, '../framework');

    public addFrameworkFiles(program: Program) {
        for (let fileName in this.frameworkFiles) {
            let sourcePath = path.resolve(path.join(this.sourcePath, fileName));
            let fileContents = fs.readFileSync(sourcePath, 'utf8');
            let destPath = this.frameworkFiles[fileName];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            this.addFile(program, destPath, fileContents);
        }
    }

    public addFile(program, projectPath: string, contents: string) {
        try {
            return program.addOrReplaceFile({ src: path.resolve(projectPath), dest: projectPath }, contents);
        } catch (error) {
            console.error(`Error adding framework file: ${projectPath} : ${error.message}`);
        }
    }

}
