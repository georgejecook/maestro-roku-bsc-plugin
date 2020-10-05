import { Annotation } from './Annotation';
import { getSessionInfo } from './RooibosSessionInfo';
import { TestCase } from './TestCase';
import { TestBlock, TestSuite } from './TestSuite';
import { sanitizeBsJsonString } from './Utils';

export class TestGroup extends TestBlock {

  constructor(testSuite: TestSuite, annotation: Annotation) {
    super(annotation);
    this.testSuite = testSuite;
    this.setupFunctionName = this.setupFunctionName || this.testSuite.setupFunctionName;
    this.tearDownFunctionName = this.tearDownFunctionName || this.testSuite.tearDownFunctionName;
    this.beforeEachFunctionName = this.beforeEachFunctionName || this.testSuite.beforeEachFunctionName;
    this.afterEachFunctionName = this.afterEachFunctionName || this.testSuite.afterEachFunctionName;
  }

  public testSuite: TestSuite;
  public testCases = new Map<string, TestCase>();
  public ignoredTestCases: TestCase[] = [];
  public soloTestCases: TestCase[] = [];

  public addTestCase(testCase: TestCase) {
    this.testCases.set(testCase.name, testCase);
    const sessionInfo = getSessionInfo();

    if (testCase.isIgnored) {
      this.ignoredTestCases.push(testCase);
    } else if (testCase.isSolo) {
      this.hasSoloTests = true;
      this.soloTestCases.push(testCase);
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
    let testCaseText = [...this.testCases.values()].filter((tc) => tc.isIncluded).map((tc) => tc.asText());

    return `
      {
        name: ${sanitizeBsJsonString(this.name)}
        isSolo: ${this.isSolo}
        isIgnored: ${this.isIgnored}
        filename: "${this.pkgPath}"
        setupFunctionName: "${this.setupFunctionName || ''}"
        tearDownFunctionName: "${this.tearDownFunctionName || ''}"
        beforeEachFunctionName: "${this.beforeEachFunctionName || ''}"
        afterEachFunctionName: "${this.afterEachFunctionName || ''}"
        testCases: [${testCaseText.join(',\n')}]
      }`;
  }

}
