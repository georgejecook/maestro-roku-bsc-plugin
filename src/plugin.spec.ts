/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import { Program, ProgramBuilder, util } from 'brighterscript';
import { expect } from 'chai';
import * as fsExtra from 'fs-extra';
import { MaestroPlugin } from './plugin';
import PluginInterface from 'brighterscript/dist/PluginInterface';
import { standardizePath as s } from './lib/Utils';

let tmpPath = s`${process.cwd()}/.tmp`;
let rootDir = s`${tmpPath}/rootDir`;
let stagingFolderPath = s`${tmpPath}/staging`;

describe('MaestroPlugin', () => {
    let program: Program;
    let builder: ProgramBuilder;
    let plugin: MaestroPlugin;

    beforeEach(async () => {
        plugin = new MaestroPlugin();
        fsExtra.ensureDirSync(tmpPath);
        fsExtra.emptyDirSync(tmpPath);
        builder = new ProgramBuilder();
        builder.options = await util.normalizeAndResolveConfig({
            rootDir: rootDir
        });
        builder.program = new Program(builder.options);
        program = new Program({
            rootDir: rootDir,
            stagingFolderPath: stagingFolderPath
        });
        program.plugins = new PluginInterface([plugin], undefined);
        program.createSourceScope(); //ensure source scope is created
        plugin.beforeProgramCreate(builder);


    });
    afterEach(() => {
        fsExtra.ensureDirSync(tmpPath);
        fsExtra.emptyDirSync(tmpPath);
        builder.dispose();
        program.dispose();
    });

    describe('basic tests', () => {

        it('does not find tests with no annotations', () => {
            program.addOrReplaceFile('source/test.spec.bs', `
                class notATest
                end class
            `);
            program.validate();
            expect(program.getDiagnostics()).to.be.empty;
        });
    });
});
