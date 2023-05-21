import type { BscFile, Program } from 'brighterscript';

import * as path from 'path';
import * as fs from 'fs-extra';

export class FileFactory {
    constructor(
        public program: Program
    ) {
    }
    public ignoredFilePaths = [];
    private frameworkFiles = {
        'Reflection.brs': 'source/roku_modules/maestro/reflection/Reflection.brs',
        'MaestroPluginUtils.brs': 'source/roku_modules/maestro/private/MaestroPluginUtils.brs',
        'MaestroFakeInterfaces.bs': 'source/roku_modules/maestro/private/MaestroFakeInterfaces.bs'
    };

    public sourcePath = path.join(__dirname, '../framework');

    public addFrameworkFiles() {
        for (let fileName in this.frameworkFiles) {
            let sourcePath = path.resolve(path.join(this.sourcePath, fileName));
            let fileContents = fs.readFileSync(sourcePath, 'utf8');
            let destPath = this.frameworkFiles[fileName];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            this.addFile(destPath, fileContents);
        }
    }

    public addFile<T extends BscFile>(destPath: string, contents: string) {
        try {
            return this.program.setFile<T>({ src: path.resolve(destPath), dest: destPath }, contents);
        } catch (error) {
            console.error(`Error adding framework file: ${destPath} : ${error.message}`);
        }
    }
}
