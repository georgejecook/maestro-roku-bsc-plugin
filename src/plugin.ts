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
import * as fs from 'fs-extra';

import { BindingProcessor } from './lib/binding/BindingProcessor';
import { File } from './lib/files/File';

import { FileType } from './lib/files/FileType';
import ImportProcessor from './lib/importSupport/ImportProcessor';
import { getAssociatedFile } from './lib/utils/Utils';
import ReflectionUtil from './lib/reflection/ReflectionUtil';
import { FileFactory } from './lib/utils/FileFactory';
import NodeClassUtil from './lib/node-classes/NodeClassUtil';

const path = require('path');

export default function () {
  return {
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
  }
};

function beforeProgramCreate(builder: ProgramBuilder): void {
  if (!this.fileMap) {
    this.fileMap = new ProjectFileMap();
    this.bindingProcessor = new BindingProcessor(this.fileMap);
    this.fileFactory = new FileFactory(builder);
  }
  this.reflectionUtil = new ReflectionUtil(this.fileMap, builder);
  this.importProcessor = new ImportProcessor(builder.options);
  this.nodeClassUtil = new NodeClassUtil(this.fileMap, builder, this.fileFactory);
  this.builder = builder;
}

function afterProgramCreate(program: Program): void {
  if (!this.isFrameworkAdded) {
    this.fileFactory.addFrameworkFiles(program);
    this.isFrameworkAdded = true;
  }
}

function beforeFileParse(source: SourceObj): void {
}

function afterFileParse(file: (BrsFile | XmlFile)): void {
  let mFile = this.fileMap.allFiles.get(file.pathAbsolute);
  if (!mFile) {
    mFile = this.fileMap.createFile(file);
  }

  mFile.bscFile = file;

  if (isBrsFile(file)) {
    this.importProcessor.processDynamicImports(file, this.builder.program);
    this.reflectionUtil.addFile(file);
    this.nodeClassUtil.addFile(file);
  }
}

async function beforeProgramValidate(program: Program) {
  for (let compFile of [...this.fileMap.allFiles.values()].filter((f) => f.fileType === FileType.Xml)) {
    compFile.loadXmlContents();
  }
  await this.nodeClassUtil.createNodeClasses(program);
}

function afterProgramValidate(program: Program) {
  for (let compFile of [...this.fileMap.allFiles.values()].filter((f) => f.fileType === FileType.Xml)) {
    this.bindingProcessor.parseBindings(compFile);

    if (compFile.bindings.length > 0) {
      this.bindingProcessor.validateBindings(compFile);
    }

    this.bindingProcessor.generateCodeForXMLFile(compFile);
  }
}

function beforePublish(builder: ProgramBuilder, files: FileObj[]): void {
  this.reflectionUtil.updateRuntimeFile();
}

function afterProgramTranspile(program: Program, entries: TranspileObj[]) {
}
function afterFileValidate(file: BscFile) {
  if (file.pathAbsolute.startsWith('components/maestro/generated')) {
    (file as any).diagnostics = [];
  }
}