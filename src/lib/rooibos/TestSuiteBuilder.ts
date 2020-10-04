
import {
  BrsFile,
  ClassMethodStatement,
  ClassStatement,
  CommentStatement,
  createVisitor,
  FunctionStatement,
  isClassMethodStatement,
  isClassStatement,
  isCommentStatement,
  isFunctionStatement,
  NamespaceStatement,
  ParseMode,
  WalkMode,
  WalkOptions
} from 'brighterscript';

import { TestGroup } from './TestGroup';

import { Annotation, AnnotationType } from './Annotation';

import { TestCase } from './TestCase';
import { TestSuite } from './TestSuite';

import { diagnosticNoGroup, diagnosticWrongAnnotation, diagnosticWrongParameterCount } from '../utils/Diagnostics';

const getJsonFromString = require('./getJsonFromString');

export class TestSuiteBuilder {
  constructor() {
  }

  //state
  private currentGroup?: TestGroup;
  private annotation?: Annotation;
  private testSuite: TestSuite;
  private file: BrsFile;

  public processFile(file: BrsFile): TestSuite[] {
    this.file = file;
    let suites = [];
    file.ast.walk(createVisitor({
      NamespaceStatement: (ns) => {

        //a test is comprised of a comment block; followed by a class
        let annotation: Annotation;
        for (let s of ns.body.statements) {
          if (isClassStatement(s)) {
            if (annotation) {
              if (annotation.annotationType === AnnotationType.TestSuite) {
                suites.push(this.processClass(annotation, s as ClassStatement));
              } else {
                diagnosticWrongAnnotation(file, s, 'Expected a TestSuite annotation');
                throw new Error('bad test suite');
              }
            }
            annotation = null; //clear out old annotation
          } else if (isCommentStatement(s)) {
            let { blockAnnotation } = Annotation.parseCommentStatement(file, s as CommentStatement);
            annotation = blockAnnotation;
          }
        }
      }
    }), {
      walkMode: WalkMode.visitStatements
    });

    return suites;
  }

  public processClass(annotation: Annotation, classStatement: ClassStatement): TestSuite {
    this.testSuite = new TestSuite(annotation, classStatement);
    this.currentGroup = null;
    this.annotation = null;

    for (let s of classStatement.body) {
      if (isClassMethodStatement(s)) {
        this.processClassMethod(s);
        this.annotation = null;
      } else if (isCommentStatement(s)) {
        let { blockAnnotation, testAnnotation } = Annotation.parseCommentStatement(this.file, s as CommentStatement);
        if (blockAnnotation) {
          if (this.currentGroup) {
            this.testSuite.addGroup(this.currentGroup);
          }
          this.currentGroup = new TestGroup(this.testSuite, blockAnnotation);
        }
        this.annotation = testAnnotation;
      }
    }

    if (this.currentGroup) {
      this.testSuite.addGroup(this.currentGroup);
    }
    return this.testSuite;
  }

  public processClassMethod(statement: ClassMethodStatement) {
    let block = this.currentGroup ?? this.testSuite;

    if (this.annotation) {
      switch (this.annotation.annotationType) {
        case AnnotationType.Test:
          if (!this.currentGroup) {
            diagnosticNoGroup(this.file, statement);
          } else {
            this.createTestCases(statement, this.annotation);
          }
          break;
        case AnnotationType.Setup:
          block.setupFunctionName = statement.name.text;
          if (statement.func.parameters.length > 0) {
            diagnosticWrongParameterCount(this.file, statement, 0);
          }
        case AnnotationType.TearDown:
          block.tearDownFunctionName = statement.name.text;
          if (statement.func.parameters.length > 0) {
            diagnosticWrongParameterCount(this.file, statement, 0);
          }
          break;
        case AnnotationType.BeforeEach:
          block.beforeEachFunctionName = statement.name.text;
          if (statement.func.parameters.length > 0) {
            diagnosticWrongParameterCount(this.file, statement, 0);
          }
          break;
        case AnnotationType.AfterEach:
          block.afterEachFunctionName = statement.name.text;
          if (statement.func.parameters.length > 0) {
            diagnosticWrongParameterCount(this.file, statement, 0);
          }
          break;
      }
    }
  }

  public createTestCases(statement: ClassMethodStatement, annotation: Annotation) {
    let testCases = this.currentGroup.testCases;
    const lineNumber = statement.func.range.start.line;
    const numberOfArgs = statement.func.parameters.length;
    if (annotation.params.length > 0) {
      let index = 0;
      for (const param of annotation.params) {
        testCases.push(
          new TestCase(param.text, statement.name.text, param.isSolo, param.isIgnore, lineNumber, param.params, index, param.lineNumber, numberOfArgs)
        );
        index++;
      }

    } else {
      testCases.push(
        new TestCase(annotation.name, statement.name.text, annotation.isSolo, annotation.isIgnore, lineNumber)
      );
    }
  }

}
