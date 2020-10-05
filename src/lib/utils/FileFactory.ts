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

  //FIXME
  private sourcePath = 'src/lib';
  private targetPath = 'source/maestro/';
  private targetCompsPath = 'components/maestro';

  public preAddFrameworkFiles() {
    for (let fileName of this.frameworkSourceFileNames) {
      let sourcePath = path.resolve(path.join(this.sourcePath, fileName));
      let destPath = path.join(this.targetPath, fileName);
      let entry = { src: sourcePath, dest: destPath };
      this.builder.options.files.push(entry);
    }
    for (let fileName of this.frameworkCompNames) {
      let sourcePath = path.resolve(path.join(this.sourcePath, fileName));
      let destPath = path.join(this.targetCompsPath, fileName);
      let entry = { src: sourcePath, dest: destPath };
      this.builder.options.files.push(entry);
    }
  }

  public addFrameworkFiles(program: Program) {
    for (let fileName of this.frameworkSourceFileNames) {
      let sourcePath = path.resolve(path.join(this.sourcePath, fileName));
      let fileContents = fs.readFileSync(sourcePath, 'utf8');
      let destPath = path.join(this.targetPath, fileName);
      let entry = { src: sourcePath, dest: destPath };

      program.addOrReplaceFile(entry, fileContents);
    }
    for (let fileName of this.frameworkCompNames) {
      let sourcePath = path.resolve(path.join(this.sourcePath, fileName));
      let fileContents = fs.readFileSync(sourcePath, 'utf8');
      let destPath = path.join(this.targetCompsPath, fileName);
      let entry = { src: sourcePath, dest: destPath };

      program.addOrReplaceFile(entry, fileContents);
    }
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
