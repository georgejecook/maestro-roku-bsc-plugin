import {
  BrsFile,
  CallableContainerMap,
  CompilerPlugin,
  FileObj,
  Program,
  ProgramBuilder,
  Scope,
  SourceObj,
  TranspileObj,
  Util,
  XmlFile,
} from 'brighterscript';

import { isBrsFile } from 'brighterscript/dist/astUtils';

import { RooibosSession } from './lib/rooibos/RooibosSession';

import { CodeCoverageProcessor } from './lib/rooibos/CodeCoverageProcessor';
import { FileFactory } from './lib/rooibos/FileFactory';

const path = require('path');

const pluginInterface: CompilerPlugin = {
  name: 'rooibosPlugin',
  beforeProgramCreate: beforeProgramCreate,
  afterProgramCreate: afterProgramCreate,
  afterScopeCreate: afterScopeCreate,
  beforeFileParse: beforeFileParse,
  afterFileParse: afterFileParse,
  afterProgramValidate: afterProgramValidate,
  beforePublish: beforePublish,
  beforeFileTranspile: beforeFileTranspile,
  afterFileTranspile: afterFileTranspile,
  beforeScopeValidate: beforeScopeValidate,
  afterPublish: afterPublish
};

export default pluginInterface;

let session: RooibosSession;
let codeCoverageProcessor: CodeCoverageProcessor;
let fileFactory = new FileFactory();
let isFrameworkAdded = false;

function beforeProgramCreate(builder: ProgramBuilder): void {
  if (!session) {
    session = new RooibosSession(builder);
    codeCoverageProcessor = new CodeCoverageProcessor(builder);
    if (!isFrameworkAdded) {
      fileFactory.preAddFrameworkFiles(builder);
      isFrameworkAdded = true;
    }
  }
}

function afterProgramCreate(program: Program) {
  fileFactory.addFrameworkFiles(program);
}

function afterScopeCreate(scope: Scope) {
}

function beforeFileParse(source: SourceObj): void {
}

function afterFileParse(file: (BrsFile | XmlFile)): void {
  console.log('afterFileParse ', file.pkgPath);
  if (fileFactory.isIgnoredFile(file)) {
    return;
  }
  if (isBrsFile(file)) {
    if (session.processFile(file)) {
      //
    } else {
      codeCoverageProcessor.addCodeCoverage(file);
    }
  }
}

function beforePublish(builder: ProgramBuilder, files: FileObj[]) {
  session.updateSessionStats();
  for (let testSuite of [...session.sessionInfo.testSuitesToRun.values()]) {
    testSuite.addDataFunctions();
  }
  session.addTestRunnerMetadata();
}

function afterProgramValidate(program: Program) {

  for (let testSuite of [...session.sessionInfo.testSuites.values()]) {
    testSuite.validate();
  }
}

function beforeFileTranspile(entry: TranspileObj) {
}

function afterFileTranspile(entry: TranspileObj) {
  console.log('afterFileTranspile');
  //write real contents of rooibosDist.brs
}

// tslint:disable-next-line:array-type
function beforeScopeValidate(scope: Scope, files: (BrsFile | XmlFile)[], callables: CallableContainerMap) {
  console.log('beforeScopeValidate');
}

function afterPublish(builder: ProgramBuilder, files: FileObj[]) {
  //create node test files
  session.createNodeFiles(path.resolve(builder.options.stagingFolderPath));
}

