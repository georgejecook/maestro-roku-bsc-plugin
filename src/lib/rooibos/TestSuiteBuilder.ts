
import { BrsFile, ClassStatement, CommentStatement, createVisitor, FunctionStatement, isClassStatement, isCommentStatement, isFunctionStatement, NamespaceStatement, ParseMode, WalkMode, WalkOptions } from 'brighterscript';

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
              if (annotation.annotationType === AnnotationType.TEST_SUITE) {
                suites.push(this.processClass(file, s as ClassStatement));
              } else {
                diagnosticWrongAnnotation(file, s, 'Expected a TestSuite annotation');
                throw new Error('bad test suite');
              }
            }
            annotation = null; //clear out old annotation
          } else if (isCommentStatement(s)) {
            annotation = Annotation.withStatement(s as CommentStatement);
          }
        }
      }
    }), {
      walkMode: WalkMode.visitStatements
    });

    return suites;
  }

  public processClass(file: BrsFile, classStatement: ClassStatement): TestSuite {
    this.testSuite = new TestSuite(file);
    this.currentGroup = null;
    this.annotation = null;

    for (let s of classStatement.body) {
      if (isFunctionStatement(s)) {
        this.processFunction(s);
        this.annotation = null;
      } else if (isCommentStatement(s)) {
        this.annotation = Annotation.withStatement(s as CommentStatement);
        if (this.annotation.annotationType === AnnotationType.GROUP) {
          if (this.currentGroup) {
            this.testSuite.addGroup(this.currentGroup);
          }
          this.currentGroup = new TestGroup(this.testSuite, this.annotation);
          this.annotation = null;
        }
      }
    }

    if (this.currentGroup) {
      this.testSuite.addGroup(this.currentGroup);
    }
    return this.testSuite;
  }

  public processFunction(statement: FunctionStatement) {
    if (this.annotation) {
      switch (this.annotation.annotationType) {
        case AnnotationType.TEST:
          if (!this.currentGroup) {
            diagnosticNoGroup(this.file, statement);
          } else {
            this.createTestCases(statement, this.annotation);
          }
        case AnnotationType.SETUP:
          if (this.currentGroup) {
            this.annotation.setupFunctionName = statement.name.text;
          } else {
            this.testSuite.setupFunctionName = statement.name.text;
          }
          if (statement.func.parameters.length > 0) {
            diagnosticWrongParameterCount(this.file, statement, 0);
          }
        case AnnotationType.TEAR_DOWN:
          if (this.currentGroup) {
            this.annotation.tearDownFunctionName = statement.name.text;
          } else {
            this.testSuite.tearDownFunctionName = statement.name.text;
          }
          if (statement.func.parameters.length > 0) {
            diagnosticWrongParameterCount(this.file, statement, 0);
          }
        case AnnotationType.BEFORE_EACH:
          if (this.currentGroup) {
            this.annotation.beforeEachFunctionName = statement.name.text;
          } else {
            this.testSuite.beforeEachFunctionName = statement.name.text;
          }
          if (statement.func.parameters.length > 0) {
            diagnosticWrongParameterCount(this.file, statement, 0);
          }
        case AnnotationType.AFTER_EACH:
          if (this.currentGroup) {
            this.annotation.afterEachFunctionName = statement.name.text;
          } else {
            this.testSuite.afterEachFunctionName = statement.name.text;
          }
          if (statement.func.parameters.length > 0) {
            diagnosticWrongParameterCount(this.file, statement, 0);
          }
      }
    }
  }

  public createTestCases(statement: FunctionStatement, annotation: Annotation) {
    //it is possible that a test case has multiple params
    //TODO - van't remember what these look like
    // let testCase = new TestCase()
  }

}
