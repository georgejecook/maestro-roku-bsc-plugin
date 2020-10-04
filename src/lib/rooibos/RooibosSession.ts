import * as path from 'path';

import { BrsFile, ProgramBuilder } from 'brighterscript';

import { RooibosConfig } from './RooibosConfig';
import { SessionInfo } from './RooibosSessionInfo';
import { TestSuite } from './TestSuite';
import { TestSuiteBuilder } from './TestSuiteBuilder';

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

  public getRuntimeConfigText(): string {
    return `

    function RBSFM_getRuntimeConfig()
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
    function RBSFM_getPreprocessorVersion()
        return "${pkg.version}"
    end function
    `;
  }

}
