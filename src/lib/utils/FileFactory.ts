import { BrsFile, FileObj, Program, ProgramBuilder, XmlFile } from 'brighterscript';

const path = require('path');
const fs = require('fs-extra');

export class FileFactory {
  constructor(
    public builder: ProgramBuilder
  ) {
  }
  public ignoredFilePaths = [];
  private frameworkSourceFileNames = [
    'MRuntime.brs'
  ];

  private frameworkCompNames = [
  ];

  private sourcePath = path.join(__dirname, '../framework');
  private targetPath = 'source/maestro/';
  private targetCompsPath = 'components/maestro';

  public addFrameworkFiles(program: Program) {
    for (let fileName of this.frameworkSourceFileNames) {
      let sourcePath = path.resolve(path.join(this.sourcePath, fileName));
      let fileContents = fs.readFileSync(sourcePath, 'utf8');
      let destPath = path.join(this.targetPath, fileName);
      this.addFile(program, destPath, fileContents);
    }
    for (let fileName of this.frameworkCompNames) {
      let sourcePath = path.resolve(path.join(this.sourcePath, fileName));
      let fileContents = fs.readFileSync(sourcePath, 'utf8');
      let destPath = path.join(this.targetCompsPath, fileName);
      this.addFile(program, destPath, fileContents);
    }
  }

  public async addFile(program, projectPath: string, contents: string) {
    await program.addOrReplaceFile({ src: path.resolve(projectPath), dest: projectPath }, contents);
  }

  public isIgnoredFile(file: BrsFile | XmlFile): boolean {
    let name = file.pkgPath.toLowerCase();
    //TODO look at builder options to ascertain if file is ignored

    let result = this.ignoredFilePaths.find((f) => {
      return name === path.join(this.targetPath, `${f}.bs`).toLowerCase();
    }
    );
    return result !== undefined;
  }

}
