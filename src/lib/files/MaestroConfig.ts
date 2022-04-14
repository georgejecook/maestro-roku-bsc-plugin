/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { BsConfig, FileResolver } from 'brighterscript';
import * as fs from 'fs-extra';
import * as path from 'path';

export enum MaestroLogLevel {
    error = 0,
    warning = 1,
    info = 2,
    verbose = 3
}

export interface MaestroConfig {
    updateStubObjectCalls?: boolean;
    updateObserveCalls?: boolean;
    updateAsFunctionCalls?: boolean;
    logLevel?: MaestroLogLevel;
    buildTimeImports?: any;
    excludeFilters?: string[];
    addFrameworkFiles?: boolean;
    stripParamTypes?: boolean;
    paramStripExceptions?: string;
    applyStrictToAllClasses?: boolean;
    processXMLFiles?: boolean;
    mvvm?: {
        insertXmlBindingsEarly?: boolean;
        createCodeBehindFilesWhenNeeded?: boolean;
        insertCreateVMMethod?: boolean;
        callCreateVMMethodInInit?: boolean;
        callCreateNodeVarsInInit?: boolean;
    };
    nodeClasses?: {
        generateTestUtils?: boolean; //creates builders for node classes
        buildForIDE?: boolean; // turns on optimizations for IDE builds
    };
    reflection?: {
        generateReflectionFunctions?: boolean; //if true will generate the functions required to lookup classes by name
        excludeFilters?: string[]; // will exclude certain files from reflection
    };
    extraValidation?: {
        doExtraValidation?: boolean; //if true will do additional maestro validation
        excludeFilters?: string[]; // will exclude certain files from extra validation
        doExtraImportValidation?: boolean; // will exclude certain files from extra validation
    };
}

let docsLink = `\nPlease read the docs for usage details https://github.com/georgejecook/maestro/blob/master/docs/index.md#maestro-cli`;

export function createProcessorConfig(config: any): MaestroConfig {
    let processorConfig = config;

    if (typeof config.bsConfig === 'string') {
        try {
            let configPath = path.resolve(config.bsConfig);
            const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            // config.bsConfig = rawConfig;
            // TODO - fix this when we get proper extends support
            config.bsConfig = rawConfig;
            config.bsConfig.rootDir = path.resolve(path.join(
                path.parse(configPath).dir,
                rawConfig.rootDir
            ));
            config.bsConfig.extends = configPath;
        } catch (e) {
            console.error('could not find valid bsconfig file: ' + config.bsConfig);
            config.bsConfig = null;
        }
    }

    if (!config.bsConfig) {
        throw new Error('Config does not contain bsConfig' + docsLink);
    }

    if (!config.bsConfig.stagingFolderPath) {
        throw new Error('bsconfig does not contain stagingFolderPath' + docsLink);
    }

    if (!config.logLevel) {
        processorConfig.logLevel = MaestroLogLevel.info;
    }

    if (config.createRuntimeFiles === undefined) {
        processorConfig.createRuntimeFiles = true;
    }

    return processorConfig;
}
