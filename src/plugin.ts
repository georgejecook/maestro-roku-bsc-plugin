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
  Scope,
  SourceObj,
  TranspileObj,
  util,
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

class MaestroPlugin {
  public name = 'maestroPlugin'
  public fileMap: ProjectFileMap;
  public bindingProcessor: BindingProcessor;
  public fileFactory: FileFactory;
  public reflectionUtil: ReflectionUtil;
  public importProcessor: ImportProcessor;
  public nodeClassUtil: NodeClassUtil;
  public builder: ProgramBuilder;
  public isFrameworkAdded = false;
  private nodeFileDebouncers = new Map<string, any>();
  private bindingTimer;
  private bindingDelay = 1000;

  beforeProgramCreate(builder: ProgramBuilder): void {
    if (!this.fileMap) {
      this.fileMap = new ProjectFileMap();
      this.bindingProcessor = new BindingProcessor(this.fileMap);
      this.fileFactory = new FileFactory(this.builder);
      this.reflectionUtil = new ReflectionUtil(this.fileMap, builder);
      this.importProcessor = new ImportProcessor(builder.options);
      this.nodeClassUtil = new NodeClassUtil(this.fileMap, builder, this.fileFactory);
      this.builder = builder;
    }
  }

  afterProgramCreate(program: Program): void {
    //NOTE bsc will in future be sync and we will not await anything.

    if (!this.isFrameworkAdded) {
      this.fileFactory.addFrameworkFiles(program);
      this.isFrameworkAdded = true;
    }
    var oldTranspile = program.transpile;
    let fileFactory = this.fileFactory;
    // program.transpile = async function (fileEntries: FileObj[], stagingFolderPath: string) {
    //   console.log('>>>>>>>>>>>>> transpile');
    //   await Promise.all(fileFactory.blockingPromises);
    //   await oldTranspile.call(program, fileEntries, stagingFolderPath);
    // };
    // var oldValidate = program.validate;
    // program.validate = async function () {
    //   await Promise.all(fileFactory.blockingPromises);
    //   await oldValidate.call(program);
    // };
  }

  beforeFileParse(source: SourceObj): void {
  }

  afterFileParse(file: (BrsFile | XmlFile)): void {
    let mFile = this.fileMap.allFiles.get(file.pathAbsolute);
    if (!mFile) {
      mFile = this.fileMap.createFile(file);
    }
    mFile.bscFile = file;

    if (file.pathAbsolute.startsWith('components/maestro/generated')) {
      return;
    }
    if (isBrsFile(file)) {
      this.importProcessor.processDynamicImports(file, this.builder.program);
      this.reflectionUtil.addFile(file);
      if (!this.fileMap.nodeClassesByPath.has(file.pathAbsolute)) {
        console.log('adding node class file for ' + file.pathAbsolute);
        this.nodeClassUtil.addFile(file);
      }
      for (let nc of this.fileMap.nodeClassesByPath.get(file.pathAbsolute) || []) {
        let debouncer = this.nodeFileDebouncers.get(nc.file.pathAbsolute);
        if (debouncer) {
          clearTimeout(debouncer);
        }
        this.nodeFileDebouncers.set(nc.file.pathAbsolute, setTimeout(() => {
          console.log('generating code for ' + file.pathAbsolute);
          nc.generateCode(this.fileFactory, this.builder.program, this.fileMap);
        }, 1000));
      }
    } else {
      mFile.loadXmlContents();
    }
  }

  beforeProgramValidate(program: Program) {
  }

  afterProgramValidate(program: Program) {
    if (this.bindingTimer) {
      clearTimeout(this.bindingTimer);
    }

    if (this.bindingDelay && this.bindingDelay > 0) {
      this.bindingTimer = setTimeout(() => {
        this.validateBindings();
      }, this.bindingDelay);
    }
  }

  beforePublish(builder: ProgramBuilder, files: FileObj[]): void {
    clearTimeout(this.bindingTimer);

    for (let debouncer of [...this.nodeFileDebouncers.values()]) {
      clearTimeout(debouncer);
    }
    console.log('>>>>>> GENERATE ALL NODE CLASSES');
    this.nodeClassUtil.createNodeClasses(this.builder.program);

    for (let compFile of [...this.fileMap.allFiles.values()].filter((f) => f.fileType === FileType.Xml && f.bindings.length > 0)) {
      this.bindingProcessor.generateCodeForXMLFile(compFile);
    }
    this.reflectionUtil.updateRuntimeFile();

  }

  validateBindings() {
    let scopes = new Set<Scope>();
    for (let compFile of [...this.fileMap.allFiles.values()].filter((f) => f.fileType === FileType.Xml && f.vmClassName)) {

      if (compFile.bindings.length > 0) {
        console.log('>>>>>> validate bindings for ' + compFile.fullPath);
        compFile.resetDiagnostics();
        this.bindingProcessor.validateBindings(compFile);
        console.log(compFile.bscFile.getDiagnostics());
        for (let scope of this.builder.program.getScopesForFile(compFile.bscFile)) {
          if (!scopes.has(scope)) {
            scopes.add(scope);
          }
        }
      }
    }
    for (let scope of [...scopes.values()]) {

      scope.invalidate();
    }
  }

  afterProgramTranspile(program: Program, entries: TranspileObj[]) {

  }

  afterFileValidate(file: BscFile) {
    let compFile = this.fileMap.allFiles.get(file.pathAbsolute);
    if (file.pathAbsolute.startsWith('components/maestro/generated')) {
      (file as any).diagnostics = [];
    } else if (compFile?.fileType === FileType.Xml && compFile?.vmClassName) {
      this.bindingProcessor.parseBindings(compFile);
      this.bindingProcessor.validateBindings(compFile);
    }
  }

}

export default function () {
  return new MaestroPlugin();
}