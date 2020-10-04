import * as path from 'path';

import { BrsFile, ClassStatement, NamespaceStatement, ProgramBuilder, ParseMode } from 'brighterscript';

import { RooibosConfig } from './RooibosConfig';
import { SessionInfo } from './RooibosSessionInfo';
import { TestSuite } from './TestSuite';
import { TestSuiteBuilder } from './TestSuiteBuilder';
import { changeClassMethodBody } from './Utils';

const pkg = require('../../package.json');

export class RooibosSession {
  constructor(builder: ProgramBuilder) {
    this._config = (builder.options as any).rooibos as RooibosConfig || {};
    this._builder = builder;
    this._suiteBuilder = new TestSuiteBuilder();
    this.reset();
  }

  private _builder: ProgramBuilder;
  private readonly _config: RooibosConfig;
  private _suiteBuilder: TestSuiteBuilder;

  public sessionInfo: SessionInfo;

  public reset() {
    this.sessionInfo = new SessionInfo(this._config);
  }

  public updateSessionStats() {
    this.sessionInfo.updateInfo();
  }

  public processFile(file: BrsFile): boolean {
    let testSuites = this._suiteBuilder.processFile(file);
    this.sessionInfo.updateTestSuites(testSuites);
    return testSuites.length > 0;
  }

  public addTestRunnerMetadata() {
    let runtimeConfig = this._builder.program.getFileByPkgPath('source/rooibos/RuntimeConfig.bs') as BrsFile;
    if (runtimeConfig) {
      let classStatement = (runtimeConfig.ast.statements[0] as NamespaceStatement).body.statements[0] as ClassStatement;
      //add
      changeClassMethodBody(classStatement, 'getRuntimeConfig', this.getRuntimeConfigText());
      changeClassMethodBody(classStatement, 'getVersionText', this.getVersionText());
      changeClassMethodBody(classStatement, 'getTestSuiteClassWithName', this.getTestSuiteClassWithNameText());
      changeClassMethodBody(classStatement, 'getAllTestSuitesNames', this.getAllTestSuitesNamesText());
    }
  }

  public getRuntimeConfigText(): string {
    return `
    function wrapper()
    return {
      "failFast": ${this._config.failFast}
      "logLevel": ${this._config.logLevel}
      "showOnlyFailures": ${this._config.showFailuresOnly}
      "printLcov": ${this._config.printLcov === true}
      "rooibosPreprocessorVersion": "${pkg.version}"
      "port": ${this._config.port || 'Invalid'}
    }
    end function
    `;
  }

  public getVersionText(): string {
    return `
    function wrapper()
    return "${pkg.version}"
    end function
    `;
  }

  public getTestSuiteClassWithNameText(): string {
    let ifText = 'if ';
    let blockText = this.sessionInfo.testSuitesToRun
      .map((s) => {
        let text = `${ifText} name = "${s.name}" \nreturn ${s.classStatement.getName(ParseMode.BrightScript)}`;
        ifText = 'else if';
        return text;
      }).join('\n');
    return `
    function wrapper()
    ${blockText}
    end if
    end function
    `;
  }

  public getAllTestSuitesNamesText(): string {
    return `
    function wrapper()
    return [
      ${this.sessionInfo.testSuitesToRun.filter((s) => !s.isNodeTest)
        .map((s) => `"${s.classStatement.getName(ParseMode.BrightScript)}"`).join('\n')
      }
    ]
    end function
    `;
  }

}
