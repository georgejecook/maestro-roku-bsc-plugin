/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import { DiagnosticSeverity, Program, ProgramBuilder, util } from 'brighterscript';
import { expect } from 'chai';
import { MaestroPlugin } from './plugin';
import PluginInterface from 'brighterscript/dist/PluginInterface';
import { standardizePath as s } from './lib/Utils';
import * as fsExtra from 'fs-extra';
import * as path from 'path';

import { trimLeading } from './lib/utils/testHelpers.spec';

let tmpPath = s`${process.cwd()}/tmp`;
let _rootDir = s`${tmpPath}/rootDir`;
let _stagingFolderPath = s`${tmpPath}/staging`;

describe('MaestroPlugin', () => {
    let program: Program;
    let builder: ProgramBuilder;
    let plugin: MaestroPlugin;
    let options;

    beforeEach(async () => {
        plugin = new MaestroPlugin();
        options = {
            rootDir: _rootDir,
            stagingFolderPath: _stagingFolderPath
        };
        fsExtra.ensureDirSync(_stagingFolderPath);
        fsExtra.ensureDirSync(_rootDir);
        fsExtra.ensureDirSync(tmpPath);
        builder = new ProgramBuilder();
        builder.options = await util.normalizeAndResolveConfig(options);
        builder.program = new Program(builder.options);
        program = builder.program;
        builder.plugins = new PluginInterface([plugin], undefined);
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

    describe('binding tests', () => {

        it('does not manipulate xml files', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('components/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView">
    <interface>
    </interface>
</component>`);
            program.validate();
            expect(program.getDiagnostics()).to.be.empty;
            await builder.transpile();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.be.empty;

            let a = getContents('components/comp.xml');
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            </component>
            <!--//# sourceMappingURL=./comp.xml.map -->`);
            expect(a).to.equal(b);

        });
    });

    describe('general tests', () => {

        it('does not manipulate xml files that are in default ignored folders (roku_modules)', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('components/roku_modules/mv/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="Myclass">
    <interface>
    </interface>
    <children>
    <Label id="test" text="{{field}}" />
    </children>
</component>`);
            program.validate();
            expect(program.getDiagnostics()).to.be.empty;
            await builder.transpile();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.be.empty;

            let a = getContents('components/roku_modules/mv/comp.xml');
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView" vm="Myclass">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children>
            <Label id="test" text="{{field}}" />
            </children>
            </component>
            <!--//# sourceMappingURL=./comp.xml.map -->`);
            expect(a).to.equal(b);

        });
        it('can turnoff default default ignored folders ', async () => {
            plugin.maestroConfig = {
                excludeFilters: []
            };
            plugin.importProcessor.config = plugin.maestroConfig;

            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('components/roku_modules/mv/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="Myclass">
    <interface>
    </interface>
    <children>
    <Label id="test" text="{{field}}" />
    </children>
</component>`);
            program.validate();
            expect(program.getDiagnostics()).to.not.be.empty;
            await builder.transpile();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.not.be.empty;

            let a = getContents('components/roku_modules/mv/comp.xml');
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView" vm="Myclass">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children>
            <Label id="test" />
            </children>
            </component>
            <!--//# sourceMappingURL=./comp.xml.map -->`);
            expect(a).to.equal(b);

        });
    });
});

function getContents(filename: string) {
    return trimLeading(fsExtra.readFileSync(s`${_stagingFolderPath}/${filename}`).toString());
}
