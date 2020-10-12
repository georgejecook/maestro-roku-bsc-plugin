import * as path from 'path';

import { File } from '../files/File';

export function testUtil_createStubProjectFile(filePath): File {

  let config = require('../../test/testProcessorConfig.json');
  const projectPath = path.dirname(filePath);
  const targetPath = path.resolve(config.outputPath);
  const fullPath = path.join(targetPath, projectPath);
  const filename = path.basename(filePath);
  const extension = path.extname(filePath);

  return new File(fullPath);
}
