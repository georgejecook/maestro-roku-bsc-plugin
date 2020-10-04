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

import { RooibosSession } from './rooibos/RooibosSession';

import { CodeCoverageProcessor } from './rooibos/CodeCoverageProcessor';
import { FileFactory } from './rooibos/FileFactory';

const pluginInterface: CompilerPlugin = {
  name: 'rooibosPlugin',
  beforeProgramCreate: beforeProgramCreate,
  afterProgramCreate: afterProgramCreate,
  afterScopeCreate: afterScopeCreate,
  beforeFileParse: beforeFileParse,
  afterFileParse: afterFileParse,
  beforePublish: beforePublish,
  beforeFileTranspile: beforeFileTranspile,
  afterFileTranspile: afterFileTranspile,
  beforeScopeValidate: beforeScopeValidate
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
    fileFactory.preAddFrameworkFiles(builder);
  }
}

function afterProgramCreate(program: Program) {
  //TODO add rooibos.d file
  if (!isFrameworkAdded) {
    fileFactory.addFrameworkFiles(program);
    // program.addOrReplaceFile('components/RooibosScene.xml', fileFactory.createTestSceneContents());
    isFrameworkAdded = true;
  }
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
