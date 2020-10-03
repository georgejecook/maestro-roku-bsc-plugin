import { Annotation } from './Annotation';
import { getSessionInfo } from './RooibosSessionInfo';
import { TestCase } from './TestCase';
import { TestBlock, TestSuite } from './TestSuite';

export class TestGroup extends TestBlock {
  constructor(testSuite: TestSuite, annotation: Annotation) {
    super(annotation);
  }

  public get setupFunctionName(): boolean {
    return this.annotation.setupFunctionName || this.testSuite.setupFunctionName;
  }

  public get tearDownFunctionName(): boolean {
    return this.annotation.tearDownFunctionName || this.testSuite.tearDownFunctionName;
  }

  public get beforeEachFunctionName(): boolean {
    return this.annotation.beforeEachFunctionName || this.testSuite.beforeEachFunctionName;
  }

  public get afterEachFunctionName(): boolean {
    return this.annotation.afterEachFunctionName || this.testSuite.afterEachFunctionName;
  }

  public testSuite: TestSuite;
  public testCases: TestCase[] = [];
  public ignoredTestCases: TestCase[] = [];
  public includedTestCases: TestCase[] = [];

  public addTestCase(testCase: TestCase) {
    this.testCases.push(testCase);
    const sessionInfo = getSessionInfo();

    if (testCase.isIgnored) {
      this.ignoredTestCases.push(testCase);
    } else if (testCase.isSolo) {
      this.hasSoloTests = true;
      this.includedTestCases.push(testCase);
    } else if (!this.hasSoloTests && !sessionInfo.hasSoloTests) {
      this.includedTestCases.push(testCase);
    }
  }

  public asJson(): object {
    return {
      pkgPath: this.pkgPath,
      setupFunctionName: this.setupFunctionName,
      tearDownFunctionName: this.tearDownFunctionName,
      beforeEachFunctionName: this.beforeEachFunctionName,
      afterEachFunctionName: this.afterEachFunctionName,
      isSolo: this.isSolo,
      isIgnored: this.isIgnored,
      name: this.name
    };
  }

  public asText(): string {
    let testCaseText = this.includedTestCases.map((tc) => tc.asText());

    return `
      {
        testCases: [${testCaseText.join(',\n')}]
        filename: "${this.pkgPath}"
        setupFunctionName: "${this.setupFunctionName || ''}"
        tearDownFunctionName: "${this.tearDownFunctionName || ''}"
        beforeEachFunctionName: "${this.beforeEachFunctionName || ''}"
        afterEachFunctionName: "${this.afterEachFunctionName || ''}"
        isSolo: ${this.isSolo}
        isIgnored: ${this.isIgnored}
        name: "${this.name || ''}"
      }`;
  }

}
