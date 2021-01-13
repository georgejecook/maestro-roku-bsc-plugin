import {
  BrsFile,
  BscFile,
  BsDiagnostic,
  CompilerPlugin,
  FileObj,
  isBrsFile,
  isXmlFile,
  Program,
  ProgramBuilder,
  SourceObj,
  TranspileObj,
  Util,
  XmlFile,
} from 'brighterscript';

import { ProjectFileMap } from './lib/files/ProjectFileMap';

import { BindingProcessor } from './lib/binding/BindingProcessor';
import { File } from './lib/files/File';

import { FileType } from './lib/files/FileType';
import ImportProcessor from './lib/importSupport/ImportProcessor';
import { getAssociatedFile } from './lib/utils/Utils';
import ReflectionUtil from './lib/reflection/ReflectionUtil';
import { FileFactory } from './lib/utils/FileFactory';
import NodeClassUtil from './lib/node-classes/NodeClassUtil';

const path = require('path');

let _builder: ProgramBuilder;
let fileMap: ProjectFileMap;
let bindingProcessor: BindingProcessor;
let importProcessor: ImportProcessor;
let reflectionUtil: ReflectionUtil;
let isFrameworkAdded = false;
let fileFactory: FileFactory;
let nodeClassUtil: NodeClassUtil;

// entry point
const pluginInterface: CompilerPlugin = {
  name: 'maestroPlugin',
  beforeProgramCreate: beforeProgramCreate,
  afterProgramCreate: afterProgramCreate,
  beforePublish: beforePublish,
  beforeFileParse: beforeFileParse,
  afterFileParse: afterFileParse,
  afterFileValidate: afterFileValidate,
  beforeProgramValidate: beforeProgramValidate,
  afterProgramValidate: afterProgramValidate,
  afterProgramTranspile: afterProgramTranspile
};

export default pluginInterface;

function beforeProgramCreate(builder: ProgramBuilder): void {
  if (!fileMap) {
    fileMap = new ProjectFileMap();
    bindingProcessor = new BindingProcessor(fileMap);
    fileFactory = new FileFactory(builder);
  }
  reflectionUtil = new ReflectionUtil(fileMap, builder);
  importProcessor = new ImportProcessor(builder.options);
  nodeClassUtil = new NodeClassUtil(fileMap, builder, fileFactory);
  _builder = builder;
}
function afterProgramCreate(program: Program): void {
  if (!isFrameworkAdded) {
    fileFactory.addFrameworkFiles(program);
    isFrameworkAdded = true;
  }
}

function beforeFileParse(source: SourceObj): void {
  // pull out the bindings and store them in a maestro file
  // remove the illegal xml from the source
  let file = new File(source.pathAbsolute, source.source);
  file.fileMap = fileMap;
  fileMap.addFile(file);
  if (file.fileType === FileType.Xml) {
    if (!file.bscFile) {
      file.bscFile = _builder.program.getFileByPathAbsolute(source.pathAbsolute);
    }

    bindingProcessor.parseBindings(file);
    source.source = file.getFileContents();
  }
}

function afterFileParse(file: (BrsFile | XmlFile)): void {
  let mFile = fileMap.allFiles.get(file.pathAbsolute);
  //look up the maestro file and link it
  if (mFile) {
    mFile.bscFile = file;
  }
  if (isXmlFile(file)) {
    if (mFile) {
      let associatedFile = getAssociatedFile(file, fileMap);
      if (associatedFile) {
        mFile.associatedFile = associatedFile;
        associatedFile.associatedFile = mFile;
      }
    }
  } else if (isBrsFile(file)) {
    importProcessor.processDynamicImports(file, _builder.program);
    reflectionUtil.addFile(file);
    nodeClassUtil.addFile(file);
  }
}

async function beforeProgramValidate(program: Program) {
  await nodeClassUtil.createNodeClasses(program);
}

function afterProgramValidate(program: Program) {

  for (let compFile of [...fileMap.allXMLComponentFiles.values()]) {
    let bscFile = program.getFileByPathAbsolute(compFile.fullPath);
    if (bscFile) {
      if (!compFile.bscFile) {
        compFile.bscFile = bscFile;
      }
      compFile.parentFile = fileMap.allXMLComponentFiles.get(compFile.parentComponentName);
      compFile.resetDiagnostics();
      bindingProcessor.validateBindings(compFile);
      for (let diagnostic of [...compFile.diagnostics, ...compFile.failedBindings]) {
        if (!diagnostic.file) {
          diagnostic.file = bscFile;
        }
      }
      bscFile.addDiagnostics(compFile.diagnostics);
      bscFile.addDiagnostics(compFile.failedBindings);
    }
  }
}

function beforePublish(builder: ProgramBuilder, files: FileObj[]): void {
  for (let compFile of [...fileMap.allXMLComponentFiles.values()]) {
    if (compFile.bscFile) {
      bindingProcessor.generateCodeForXMLFile(compFile);
    }
  }

  reflectionUtil.updateRuntimeFile();
}

function afterProgramTranspile(program: Program, entries: TranspileObj[]) {
}
function afterFileValidate(file: BscFile) {
  if (file.pathAbsolute.startsWith('components/maestro/generated')) {
    (file as any).diagnostics = [];
  }
}