import {
  BrsFile,
  CompilerPlugin,
  FileObj,
  Program,
  ProgramBuilder,
  SourceObj,
  TranspileObj,
  Util,
  XmlFile,
} from 'brighterscript';

import { isBrsFile } from 'brighterscript/dist/astUtils';

import { RooibosSession } from './rooibos/RooibosSession';

import { CodeCoverageProcessor } from './rooibos/CodeCoverageProcessor';

const pluginInterface: CompilerPlugin = {
  name: 'rooibosPlugin',
  beforeProgramCreate: beforeProgramCreate,
  afterProgramCreate: afterProgramCreate,
  beforeFileParse: beforeFileParse,
  afterFileParse: afterFileParse,
  afterProgramValidate: afterProgramValidate,
  afterFileTranspile: afterFileTranspile
};

export default pluginInterface;

let session: RooibosSession;
let codeCoverageProcessor: CodeCoverageProcessor;

function beforeProgramCreate(builder: ProgramBuilder): void {
  if (!session) {
    session = new RooibosSession(builder);
    codeCoverageProcessor = new CodeCoverageProcessor(builder);
  }
}

function afterProgramCreate(program: Program): void {
  //TODO add rooibos.d file
  program.addOrReplaceFile('source/rooibos.brs', `rooibosText`);
}

function beforeFileParse(source: SourceObj): void {
}

function afterFileParse(file: (BrsFile | XmlFile)): void {
  if (isBrsFile(file)) {

    if (session.processFile(file)) {
      //
    } else {
      codeCoverageProcessor.addCodeCoverage(file);
    }
  }

}

function afterProgramValidate(program: Program) {
}

function afterFileTranspile(entry: TranspileObj) {
  //write real contents of rooibosDist.brs
}

