/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as path from 'path';

import { File } from '../files/File';

export function createStubProjectFile(filePath): File {

    // eslint-disable-next-line
    let config = require('../../test/testProcessorConfig.json');
    const projectPath = path.dirname(filePath);
    const targetPath = path.resolve(config.outputPath);
    const fullPath = path.join(targetPath, projectPath);
    const filename = path.basename(filePath);
    const extension = path.extname(filePath);

    return new File(null, null);
}
