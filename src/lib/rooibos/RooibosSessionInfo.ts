
import { BrsFile } from 'brighterscript';

import { TestSuite } from './TestSuite';

export class SessionInfo {
  constructor(config: any) {
  }

  public ignoredCount: number = 0;
  public ignoredTestNames: string[];
  public testSuites: Map<string, TestSuite> = new Map();
  public testSuitesToRun: TestSuite[];
  public hasSoloSuites: boolean = false;
  public hasSoloGroups: boolean = false;
  public hasSoloTests: boolean = false;

  public updateTestSuite(file: BrsFile, testSuite: TestSuite | null) {
    if (testSuite?.isValid) {
      this.testSuites.set(testSuite.name, testSuite);
      if (testSuite.isSolo) {
        this.hasSoloSuites = true;
      }
      if (testSuite.hasSoloTests) {
        this.hasSoloTests = true;
      }
      if (testSuite.hasSoloGroups) {
        this.hasSoloGroups = true;
      }
    }
  }

  public createIgnoredTestsInfoFunction(): string {
    let text = `
    function RBSFM_getIgnoredTestInfo()
        return {
          "count": ${this.ignoredCount}
          "items":[
        `;
    this.ignoredTestNames.forEach((ignoredText) => {
      text += `"${ignoredText}",\n`;
    });
    text += `
      ]}
    end function\n`;
    return text;
  }

  public createTestSuiteLookupFunction(): string {
    let text = `
    function RBSFM_getTestSuitesForProject()
        return [
        `;
    this.testSuites.forEach((testSuite) => {
      if (testSuite.isIncluded) {
        text += `\n${testSuite.asText()},\n`;
      }
    });
    text += `
      ]
    end function\n`;
    return text;
  }

  /**
   * Once we know what's ignored/solo/etc, we can ascertain if we're going
   * to include it in the final json payload
   */
  public updateInfo() {
    for (let testSuite of [...this.testSuites.values()]) {
      if (this.hasSoloTests && !testSuite.hasSoloTests) {
        testSuite.isIncluded = false;
      } else if (this.hasSoloSuites && !testSuite.isSolo) {
        testSuite.isIncluded = false;
      } else if (testSuite.isIgnored) {
        testSuite.isIncluded = false;
        this.ignoredTestNames.push('|-' + testSuite.name + ' [WHOLE SUITE]');
        this.ignoredCount++;
      } else {
        testSuite.isIncluded = true;
      }

      //'testSuite  ' + testSuite.name);
      testSuite.testGroups.forEach((testGroup) => {

        //'GROUP  ' + testGroup.name);
        if (testGroup.isIgnored) {
          this.ignoredCount += testGroup.testCases.;
          this.ignoredTestNames.push('  |-' + testGroup.name + ' [WHOLE GROUP]');
        } else {
          let ignoredTests = testGroup.getIgnoredTests();
          if (testGroup.ignoredTests.length > 0) {
            this.ignoredTestNames.push('  |-' + testGroup.name);
            this.ignoredCount += testGroup.ignoredTestCases.length;
            testGroup.ignoredTestCases.forEach((ignoredTestCase) => {
              if (!ignoredTestCase.isParamTest) {
                this.ignoredTestNames.push('  | |--' + ignoredTestCase.name);
              } else if (ignoredTestCase.paramTestIndex === 0) {
                let testCaseName = ignoredTestCase.name;
                if (testCaseName.length > 1 && testCaseName.substr(testCaseName.length - 1) === '0') {
                  testCaseName = testCaseName.substr(0, testCaseName.length - 1);
                }
                this.ignoredTestNames.push('  | |--' + testCaseName);
              }
            });
          }
          if (this.hasSoloTests && !testGroup.hasSoloTests && !testGroup.isSolo) {
            testGroup.isIncluded = false;
          } else if (testGroup.testCases.length === 0 && testGroup.soloTestCases.length === 0) {
            testGroup.isIncluded = false;
          } else {
            testGroup.isIncluded = testSuite.isIncluded;
          }
          testGroup.testCases.forEach((testCase) => {
            if (this.hasSoloTests && !testCase.isSolo) {
              testCase.isIncluded = false;
            } else {
              testCase.isIncluded = testGroup.isIncluded || testCase.isSolo;
            }
          });
          testGroup.soloTestCases.forEach((testCase) => {
            testCase.isIncluded = true;
          });
        }
      });
    }
  }

  public asJson(): object[] {
    return null;
    // return this.testSuites.filter((testSuite) => testSuite.isIncluded)
    // .map((testSuite) => testSuite.asJson());
  }
}

let _sessionInfo: SessionInfo;

export function getSessionInfo(): SessionInfo {
  return _sessionInfo;
}
