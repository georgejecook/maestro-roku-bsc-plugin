import { BrsFile } from 'brighterscript';

import { Annotation } from './Annotation';

import { TestGroup } from './TestGroup';

/**
 * base of test suites and blocks..
 */
export class TestBlock {
  constructor(
    public annotation: Annotation
  ) {
  }

  public get file(): BrsFile {
    return this.annotation.file;
  }
  public get pkgPath(): string {
    return this.file.pkgPath;
  }

  public get name(): string {
    return this.annotation.name;
  }

  public get isSolo(): boolean {
    return this.annotation.isSolo;
  }

  public get isIgnored(): boolean {
    return this.annotation.isIgnore;
  }

  public isValid: boolean = false;
  public isIncluded: boolean;

  public hasFailures: boolean;
  public hasSoloTests: boolean;
  public hasIgnoredTests: boolean;

  public setupFunctionName: string;
  public tearDownFunctionName: string;
  public beforeEachFunctionName: string;
  public afterEachFunctionName: string;

}

export class TestSuite extends TestBlock {
  constructor(annotation: Annotation) {
    super(annotation);
  }

  //state
  public testGroups: TestGroup[] = [];
  public nodeTestFileName: string;
  public hasSoloGroups: boolean;
  public isNodeTest: boolean;

  public addGroup(group: TestGroup) {
    this.testGroups.push(group);
    this.hasIgnoredTests = group.ignoredTestCases.length > 0;
    this.hasSoloTests = group.hasSoloTests;
    this.isValid = true;
  }

  public asJson(): object {
    return {
      name: this.name,
      filePath: this.pkgPath,
      valid: this.isValid,
      hasFailures: this.hasFailures,
      hasSoloTests: this.hasSoloTests,
      hasIgnoredTests: this.hasIgnoredTests,
      hasSoloGroups: this.hasSoloGroups,
      isSolo: this.isSolo,
      isIgnored: this.isIgnored,
      testGroups: this.testGroups.filter((testGroup) => testGroup.isIncluded)
        .map((testGroup) => testGroup.asJson()),
      setupFunctionName: this.setupFunctionName,
      tearDownFunctionName: this.tearDownFunctionName,
      isNodeTest: this.isNodeTest,
      nodeTestFileName: this.nodeTestFileName,
      beforeEachFunctionName: this.beforeEachFunctionName,
      afterEachFunctionName: this.afterEachFunctionName,
    };
  }

  public asText(): string {
    let testGroups = this.testGroups.filter((testGroup) => testGroup.isIncluded)
      .map((testGroup) => testGroup.asText());
    return `{
      name: "${this.name}"
      filePath: "${this.pkgPath}"
      valid: ${this.isValid}
      hasFailures: ${this.hasFailures}
      hasSoloTests: ${this.hasSoloTests}
      hasIgnoredTests: ${this.hasIgnoredTests}
      hasSoloGroups: ${this.hasSoloGroups}
      isSolo: ${this.isSolo}
      isIgnored: ${this.isIgnored}
      testGroups: [${testGroups}]
      setupFunctionName: "${this.setupFunctionName || ''}"
      tearDownFunctionName: "${this.tearDownFunctionName || ''}"
      isNodeTest: ${this.isNodeTest}
      nodeTestFileName: "${this.nodeTestFileName || ''}"
      beforeEachFunctionName: "${this.beforeEachFunctionName || ''}"
      afterEachFunctionName: "${this.afterEachFunctionName || ''}"
    }`;
  }
}
