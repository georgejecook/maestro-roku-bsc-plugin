import { BrsFile, FileObj, Program, ProgramBuilder, XmlFile } from 'brighterscript';

const path = require('path');
const fs = require('fs-extra');

export class FileFactory {
  private frameworkFileNames = [
    'BaseTestSuite',
    'CommonUtils',
    'Coverage',
    'Matchers',
    'Rooibos',
    'RuntimeConfig',
    'Stats',
    'Test',
    'TestGroup',
    'TestLogger',
    'TestResult',
    'TestRunner'
  ];

  private sourcePath = '../rooibos/src/source/';
  private targetPath = 'source/rooibos/';
  private targetCompsPath = 'components/rooibos/';

  public getFrameworkFiles(): FileObj[] {
    let files: FileObj[] = [];

    for (let fileName of this.frameworkFileNames) {
      files.push({ src: path.resolve(path.join(this.sourcePath, `${fileName}.bs`)), dest: path.join(this.targetPath, `${fileName}.bs`) });
    }
    files.push({ src: path.resolve(path.join(this.sourcePath, `RooibosScene.xml`)), dest: path.join(this.targetCompsPath, `RooibosScene.xml`) });
    return files;
  }

  public preAddFrameworkFiles(builder: ProgramBuilder) {
    for (let fileName of this.frameworkFileNames) {
      let sourcePath = path.resolve(path.join(this.sourcePath, `${fileName}.bs`));
      let destPath = path.join(this.targetPath, `${fileName}.bs`);
      let entry = { src: sourcePath, dest: destPath };
      builder.options.files.push(entry);
    }

    let sourcePath = path.resolve(path.join(this.sourcePath, `RooibosScene.xml`));
    let destPath = path.join(this.targetCompsPath, `RooibosScene.xml`);
    let entry = { src: sourcePath, dest: destPath };
    builder.options.files.push(entry);

  }

  public addFrameworkFiles(program: Program) {
    for (let fileName of this.frameworkFileNames) {
      let sourcePath = path.resolve(path.join(this.sourcePath, `${fileName}.bs`));
      let fileContents = fs.readFileSync(sourcePath, 'utf8');
      let destPath = path.join(this.targetPath, `${fileName}.bs`);
      let entry = { src: sourcePath, dest: destPath };

      program.addOrReplaceFile(entry, fileContents);
    }

    let sourcePath = path.resolve(path.join(this.sourcePath, `RooibosScene.xml`));
    let destPath = path.join(this.targetCompsPath, `RooibosScene.xml`);
    let entry = { src: sourcePath, dest: destPath };
    program.addOrReplaceFile(entry, this.createTestSceneContents());
  }

  public createTestSceneContents(): string {
    let scriptImports = [];
    for (let fileName of this.frameworkFileNames) {
      scriptImports.push(`<script type="text/brightscript" uri="${this.targetPath}${fileName}.brs" />`);
    }

    let contents = `<?xml version="1.0" encoding="UTF-8" ?>
  <component
      name="TestsScene"
      extends="Scene">
${scriptImports.join('\n')}
    <interface>
      <function name="Rooibos_CreateTestNode"/>
    </interface>
    <children>
      <LayoutGroup>
        <Label text="Rooibos tests are running" />
      </LayoutGroup>
    </children>
  </component>
   `;
    return contents;
  }

  public isIgnoredFile(file: BrsFile | XmlFile): boolean {
    let name = file.pkgPath.toLowerCase();
    let result = this.frameworkFileNames.find((f) => {
      return name === path.join(this.targetPath, `${f}.bs`).toLowerCase();
    }
    );
    return result !== undefined;
  }
}
