import { BrsFile, CommentStatement } from 'brighterscript'

export enum AnnotationType {
  TEST_SUITE = '\'@TestSuite',
  IT = '\'@It',
  GROUP = '\'@TestGroup',
  IGNORE = '\'@Ignore',
  SOLO = '\'@Only',
  TEST = '\'@Test',
  NODE_TEST = '\'@SGNode',
  SETUP = '\'@Setup',
  TEAR_DOWN = '\'@TearDown',
  BEFORE_EACH = '\'@BeforeEach',
  AFTER_EACH = '\'@AfterEach',
  TEST_PARAMS = '\'@Params',
  TEST_IGNORE_PARAMS = '\'@IgnoreParams',
  TEST_SOLO_PARAMS = '\'@OnlyParams'
}

export class Annotation {
  /**
   * Represents a group of comments which contain tags such as @only, @testsuite, @testcase, @testgroup etc
   * @param statement block of comments that contain annotations to apply to the next statement
   */
  constructor(
    public file: BrsFile,
    public annotationType: AnnotationType,
    public text: string,
    public name: string,
    public isIgnore: boolean = false,
    public isSolo: boolean = false,
    public valueText: string = null,
  ) {

  }

  //additional data that can be added to an annotation for context
  public setupFunctionName;
  public tearDownFunctionName;
  public beforeEachFunctionName;
  public afterEachFunctionName;

  public static withStatement(statement: CommentStatement): Annotation | null {
    return null;
  }

}
