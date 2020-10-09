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

import { ProjectFileMap } from './lib/fileProcessing/ProjectFileMap';

import { BindingProcessor } from './lib/bindingSupport/BindingProcessor';
import { File } from './lib/fileProcessing/File';

import { FileType } from './lib/fileProcessing/FileType';
import ImportProcessor from './lib/importSupport/ImportProcessor';
import { getAssociatedFile } from './lib/utils/Utils';
import ReflectionUtil from './lib/reflection-support/ReflectionUtil';
import { FileFactory } from './lib/utils/FileFactory';

let _builder: ProgramBuilder;
let fileMap: ProjectFileMap;
let bindingProcessor: BindingProcessor;
let importProcessor: ImportProcessor;
let reflectionUtil: ReflectionUtil;
let isFrameworkAdded = false;
let fileFactory: FileFactory;

// entry point
const pluginInterface: CompilerPlugin = {
  name: 'maestroPlugin',
  beforeProgramCreate: beforeProgramCreate,
  afterProgramCreate: afterProgramCreate,
  beforePublish: beforePublish,
  beforeFileParse: beforeFileParse,
  afterFileParse: afterFileParse,
  afterProgramValidate: afterProgramValidate,
  afterProgramTranspile: afterProgramTranspile
};

export default pluginInterface;

function beforeProgramCreate(builder: ProgramBuilder): void {
  if (!fileMap) {
    fileMap = new ProjectFileMap();
    bindingProcessor = new BindingProcessor(fileMap);
    fileFactory = new FileFactory(builder);
    if (!isFrameworkAdded) {
      fileFactory.preAddFrameworkFiles();
      isFrameworkAdded = true;
    }
  }
  reflectionUtil = new ReflectionUtil(fileMap, builder);
  importProcessor = new ImportProcessor(builder.options);
  _builder = builder;
}
function afterProgramCreate(program: Program): void {
  fileFactory.addFrameworkFiles(program);
}

function beforeFileParse(source: SourceObj): void {
  // pull out the bindings and store them in a maestro file
  // remove the illegal xml from the source
  let file = new File(source.pathAbsolute, source.source);
  file.fileMap = fileMap;
  fileMap.addFile(file);
  if (file.fileType === FileType.Xml) {
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
  console.log('afterFileParse', file.pathAbsolute);
  //add alternateFile, if we're xml
  if (file instanceof XmlFile) {
    if (mFile) {
      let associatedFile = getAssociatedFile(file, fileMap);
      if (associatedFile) {
        mFile.associatedFile = associatedFile;
        associatedFile.associatedFile = mFile;
      }
    }
  } else {
    importProcessor.processDynamicImports(file, _builder.program);
    reflectionUtil.addFile(file);
  }
}

function afterProgramValidate(program: Program) {

  for (let compFile of [...fileMap.allXMLComponentFiles.values()]) {

    if (compFile.bscFile) {
      compFile.parentFile = fileMap.allXMLComponentFiles.get(compFile.parentComponentName);
      bindingProcessor.validateBindings(compFile);
      let bscFile = program.getFileByPathAbsolute(compFile.fullPath);
      if (bscFile) {
        bscFile.addDiagnostics(compFile.diagnostics);
      }
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
  console.log(fileMap);
}