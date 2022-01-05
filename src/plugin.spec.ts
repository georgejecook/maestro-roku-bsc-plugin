/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import type { BrsFile, BsDiagnostic } from 'brighterscript';
import { DiagnosticSeverity, Program, ProgramBuilder, util } from 'brighterscript';
import { expect } from 'chai';
import { MaestroPlugin } from './plugin';
import PluginInterface from 'brighterscript/dist/PluginInterface';
import { standardizePath as s } from './lib/Utils';
import * as fsExtra from 'fs-extra';
import * as path from 'path';

import { trimLeading } from './lib/utils/testHelpers.spec';
import { Diagnostic } from 'typescript';
import { assert } from 'console';

let tmpPath = s`${process.cwd()}/tmp`;
let _rootDir = s`${tmpPath}/rootDir`;
let _stagingFolderPath = s`${tmpPath}/staging`;

describe('MaestroPlugin', () => {
    let program: Program;
    let builder: ProgramBuilder;
    let plugin: MaestroPlugin;
    let options;

    beforeEach(() => {
        plugin = new MaestroPlugin();
        options = {
            rootDir: _rootDir,
            stagingFolderPath: _stagingFolderPath,
            mvvm: {},
            nodeClasses: {}
        };
        fsExtra.ensureDirSync(_stagingFolderPath);
        fsExtra.ensureDirSync(_rootDir);
        fsExtra.ensureDirSync(tmpPath);
        builder = new ProgramBuilder();
        builder.options = util.normalizeAndResolveConfig(options);
        builder.program = new Program(builder.options);
        program = builder.program;
        builder.plugins = new PluginInterface([plugin], program.logger);
        program.plugins = new PluginInterface([plugin], program.logger);
        program.createSourceScope(); //ensure source scope is created
        plugin.maestroConfig = {
            extraValidation: {},
            addFrameworkFiles: false,
            mvvm: {},
            nodeClasses: {}
        };
        plugin.beforeProgramCreate(builder);
        program.addOrReplaceFile('manifest', ``);

    });
    afterEach(() => {
        fsExtra.ensureDirSync(tmpPath);
        fsExtra.emptyDirSync(tmpPath);
        builder.dispose();
        program.dispose();
    });

    describe('binding tests', () => {


        it('gives error diagnostics when field bindings do not match class', async () => {
            plugin.isFrameworkAdded = true;
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
            class myVM
                function onChangeVisible(value)
                end function
           end class
        `);
            program.addOrReplaceFile('components/comp.brs', `

        `);

            program.addOrReplaceFile('components/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
    <interface>
    </interface>
    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
    <children>
        <Poster
            id='poster'
            visible='{(onChangeVisible)}'
            click0='{(onChangeVisible(wrong))}'
            click1='{(onChangeVisible(wrong, signature))}'
            click2='{(onChangeVisible(event, value, another)}'
            click2='{(onChangeVisible(value)}'
            click3='{(onChangeVisible())}'
            width='1920'
            height='174'
            uri=''
            translation='[0,0]' />
    </children>
</component>`);
            program.validate();
            await builder.transpile();
            let diagnostics = program.getDiagnostics();
            expect(diagnostics).to.have.lengthOf(6);
            checkDiagnostic(diagnostics[0], 1010, 9);
            checkDiagnostic(diagnostics[1], 1010, 10);
            checkDiagnostic(diagnostics[2], 1010, 11);
            checkDiagnostic(diagnostics[3], 1010, 12);
            checkDiagnostic(diagnostics[4], 1026, 8);
            checkDiagnostic(diagnostics[5], 1025, 13);
        });

        it('does not give diagnostics for valid target bindings', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
            class myVM
                public isClicked
                function onChangeVisible(value = invalid, node = invalid)
                end function
           end class
        `);
            program.addOrReplaceFile('components/comp.brs', `

        `);

            program.addOrReplaceFile('components/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
    <interface>
    </interface>
    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
    <children>
        <Poster
            id='poster'
            click0='{(onChangeVisible(node))}'
            click1='{(onChangeVisible(value,node))}'
            click2='{(onChangeVisible(value, node))}'
            click3='{(onChangeVisible(value))}'
            click4='{(onChangeVisible())}'
            click5='{(isClicked)}'
            width='1920'
            height='174'
            uri=''
            translation='[0,0]' />
    </children>
</component>`);
            program.validate();
            await builder.transpile();
            let diagnostics = program.getDiagnostics();
            expect(diagnostics).to.be.empty;
        });

        it('gives diagnostics when trying to set a function call back as a field', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
            class myVM
                function onChangeVisible(value)
                end function
           end class
        `);
            program.addOrReplaceFile('components/comp.brs', `

        `);

            program.addOrReplaceFile('components/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
    <interface>
    </interface>
    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
    <children>
        <Poster
            id='poster'
            visible='{(onChangeVisible)}'
            click='{(onChangeVisible(value))}'
            width='1920'
            height='174'
            uri=''
            translation='[0,0]' />
    </children>
</component>`);
            program.validate();
            await builder.transpile();
            let diagnostics = program.getDiagnostics();
            expect(diagnostics).to.have.lengthOf(1);
            checkDiagnostic(diagnostics[0], 1026, 8);
        });
        it('gives error diagnostics when id is not set', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
            class myVM
                public text
                function onChangeVisible(value)
                end function
           end class
        `);
            program.addOrReplaceFile('components/comp.brs', `

        `);

            program.addOrReplaceFile('components/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
    <interface>
    </interface>
    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
    <children>
        <Poster
            test='{{text}}'
            click='{(onChangeVisible(event, value))}'
            height='174'
            uri=''
            translation='[0,0]' />
    </children>
</component>`);
            program.validate();
            await builder.transpile();
            let diagnostics = program.getDiagnostics();
            expect(diagnostics).to.have.lengthOf(2);
            checkDiagnostic(diagnostics[0], 1010, 7);
            checkDiagnostic(diagnostics[1], 1010, 8);
        });

        it('takes optional params into account', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
            class myVM
                public isClicked
                function onChangeVisible(value = invalid, node = invalid)
                end function
           end class
        `);
            program.addOrReplaceFile('components/comp.brs', `

        `);

            program.addOrReplaceFile('components/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
    <interface>
    </interface>
    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
    <children>
        <Poster
            id='poster'
            click0='{(isClicked)}'
            click1='{(onChangeVisible())}'
            click2='{(onChangeVisible(value))}'
            click3='{(onChangeVisible(value, node))}'
            click3='{(onChangeVisible(node))}'
            width='1920'
            height='174'
            uri=''
            translation='[0,0]' />
    </children>
</component>`);
            program.validate();
            await builder.transpile();
            let diagnostics = program.getDiagnostics();
            expect(diagnostics).to.be.empty;
        });

        it('inserts static bindings', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/vm.bs', `
            class myVM
                public riversJson
                public entry
           end class
        `);

            program.addOrReplaceFile('components/comp.bs', `
            class myVM
                public riversJson
                public entry
           end class
        `);

            program.addOrReplaceFile('components/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
    <interface>
    </interface>
    <script type="text/brightscript" uri="pkg:/components/comp.bs" />
    <children>
        <Poster
            id='poster'
            style='{{:riversJson.styles}}'
            entry='{{:entry}}'
            width='1920'
            height='174'
            uri=''
            translation='[0,0]' />
    </children>
</component>`);
            program.validate();
            await builder.transpile();
            let diagnostics = program.getDiagnostics();
            expect(diagnostics).to.be.empty;
            let a = getContents('components/comp.brs');
            let b = trimLeading(`'import "components/comp.bs"
            function __myVM_builder()
            instance = {}
            instance.new = sub()
            m.riversJson = invalid
            m.entry = invalid
            m.__classname = "myVM"
            end sub
            return instance
            end function
            function myVM()
            instance = __myVM_builder()
            instance.new()
            return instance
            end function

            function m_createNodeVars()
            for each id in [
            "poster"
            ]
            m[id] = m.top.findNode(id)
            end for
            end function

            function init()
            m_createNodeVars()
            end function

            function m_createVM()
            m.vm = myVM()
            m.vm.initialize()
            mx_initializeBindings()
            end function

            function m_initBindings()
            if m.vm <> invalid then
            vm = m.vm

            if vm.onBindingsConfigured <> invalid
            vm.onBindingsConfigured()
            end if

            end if
            end function

            function m_initStaticBindings()
            if m.vm <> invalid then
            vm = m.vm
            m.poster.style = mc_getPath(vm,"riversJson.styles")
            m.poster.entry = vm.entry
            end if
            end function`);
            expect(a).to.equal(b);
        });

        it('warns when field bindings are not public', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
            class myVM
                private width
                private function onChangeVisible(value)
                end function
           end class
        `);
            program.addOrReplaceFile('components/comp.brs', `

        `);

            program.addOrReplaceFile('components/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
    <interface>
    </interface>
    <script type="text/brightscript" uri="pkg:/components/comp.brs" />
    <children>
        <Poster
            visible='{(onChangeVisible(value))}'
            id='topBanner'
            width='{{width}}'
            height='174'
            uri=''
            translation='[0,0]' />
    </children>
</component>`);
            program.validate();
            expect(program.getDiagnostics()).to.not.be.empty;
            await builder.transpile();
            console.log(builder.getDiagnostics());
            expect(builder.getDiagnostics()).to.not.be.empty;

        });

        it('does not manipulate non binding xml files', async () => {
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
            `);
            expect(a).to.equal(b);

        });
        it('does removes vm tags from files files', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('components/comp.xml', `
            <component name="mv_BaseScreen" extends="mv_BaseView" vm="myVM">
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
            `);
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
            //note - we still remove illegal vm attribute
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children>
            <Label id="test" text="{{field}}" />
            </children>
            </component>
            `);
            expect(a).to.equal(b);

        });
        it('does not manipulate xml files when xml processing is disabled', async () => {
            plugin.maestroConfig.processXMLFiles = false;
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('components/comp.xml', `
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

            let a = getContents('components/comp.xml');
            //note - we still remove illegal vm attribute
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children>
            <Label id="test" text="{{field}}" />
            </children>
            </component>
            `);
            expect(a).to.equal(b);

        });
        it('can turnoff default default ignored folders ', async () => {
            plugin.maestroConfig = {
                extraValidation: {},
                addFrameworkFiles: false,
                excludeFilters: [],
                mvvm: {},
                nodeClasses: {},
                processXMLFiles: true
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
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children>
            <Label id="test" />
            </children>
            </component>
            `);
            expect(a).to.equal(b);

        });
        it('does not manipulate files in specified folders ', async () => {
            plugin.maestroConfig = {
                extraValidation: {},
                addFrameworkFiles: false,
                excludeFilters: ['**/ignored/**/*.*'],
                mvvm: {},
                nodeClasses: {}
            };
            plugin.importProcessor.config = plugin.maestroConfig;

            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('components/ignored/mv/comp.xml', `
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

            let a = getContents('components/ignored/mv/comp.xml');
            let b = trimLeading(`<component name="mv_BaseScreen" extends="mv_BaseView">
            <interface>
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children>
            <Label id="test" text="{{field}}" />
            </children>
            </component>
            `);
            expect(a).to.equal(b);

        });
    });

    describe('node class tests', () => {

        it('parses a node class with no errors', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    public title = ""
                    public content = ""

                    function new()
                    end function
               end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

            let a = getContents('components/maestro/generated/Comp.xml');
            let b = trimLeading(`<?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
            <interface>
            <field id="title" type="string" />
            <field id="content" type="string" />
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children />
            </component>
            `);
            expect(a).to.equal(b);

            a = getContents('components/maestro/generated/Comp.brs');
            b = trimLeading(`'import "pkg:/source/comp.bs"

            function init()
            m.top.title = ""
            m.top.content = ""
            instance = __Comp_builder()
            instance.delete("top")
            instance.delete("global")
            top = m.top
            m.append(instance)
            m.__isVMCreated = true
            m.new()
            m.top = top
            m_wireUpObservers()
            end function

            function m_wireUpObservers()
            end function

            function __m_setTopField(field, value)
            if m.top.doesExist(field) then
            m.top[field] = value
            end if
            return value
            end function`);
            expect(a).to.equal(b);

        });

        it('parses tunnels public functions', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    public title = ""
                    public content = ""

                    function new()
                    end function

                    public function someFunction()
                    end function

                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

            let a = getContents('components/maestro/generated/Comp.xml');
            let b = trimLeading(`<?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
            <interface>
            <field id="title" type="string" />
            <field id="content" type="string" />
            <function name="someFunction" />
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children />
            </component>
            `);
            expect(a).to.equal(b);

            a = getContents('components/maestro/generated/Comp.brs');
            b = trimLeading(`'import "pkg:/source/comp.bs"

            function init()
            m.top.title = ""
            m.top.content = ""
            instance = __Comp_builder()
            instance.delete("top")
            instance.delete("global")
            top = m.top
            m.append(instance)
            m.__isVMCreated = true
            m.new()
            m.top = top
            m_wireUpObservers()
            end function

            function m_wireUpObservers()
            end function

            function __m_setTopField(field, value)
            if m.top.doesExist(field) then
            m.top[field] = value
            end if
            return value
            end function

            function someFunction(dummy = invalid)
            return m.someFunction()
            end function`);
            expect(a).to.equal(b);

        });

        it('hooks up public fields with observers', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    public title = ""
                    public content = ""

                    function new()
                    end function

                    private function onTitleChange(value)
                    end function

                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

            let a = getContents('components/maestro/generated/Comp.xml');
            let b = trimLeading(`<?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
            <interface>
            <field id="title" type="string" />
            <field id="content" type="string" />
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children />
            </component>
            `);
            expect(a).to.equal(b);

            a = getContents('components/maestro/generated/Comp.brs');
            b = trimLeading(`'import "pkg:/source/comp.bs"

            function init()
            m.top.title = ""
            m.top.content = ""
            instance = __Comp_builder()
            instance.delete("top")
            instance.delete("global")
            top = m.top
            m.append(instance)
            m.__isVMCreated = true
            m.new()
            m.top = top
            m_wireUpObservers()
            end function

            function on_title(event)
            m.onTitleChange(event.getData())
            end function

            function m_wireUpObservers()
            m.top.observeField("title", "on_title")
            end function

            function __m_setTopField(field, value)
            if m.top.doesExist(field) then
            m.top[field] = value
            end if
            return value
            end function`);
            expect(a).to.equal(b);

        });

        it('manages inferred and specific field types', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                class TestClass
                end class
                @node("Comp", "Group")
                class Comp

                public clazzTyped as TestClass
                    public s = "string"
                    public num = 2
                    public numFloat = 2.5
                    public arr = [1,2,3]
                    public aa = {id:"1"}
                    public clazz = new TestClass()
                    public sTyped as string
                    public numTyped as integer
                    public numFloatTyped as float
                    public arrTyped as mc.types.array
                    public aaTyped as mc.types.assocarray

                    function new()
                    end function

                    private function onTitleChange(value)
                    end function

                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error && !d.message.includes('mc.types.'))).to.be.empty;

            let a = getContents('components/maestro/generated/Comp.xml');
            let b = trimLeading(`<?xml version="1.0" encoding="UTF-8" ?>
            <component name="Comp" extends="Group">
            <interface>
            <field id="clazzTyped" type="assocarray" />
            <field id="s" type="string" />
            <field id="num" type="integer" />
            <field id="numFloat" type="float" />
            <field id="arr" type="array" />
            <field id="aa" type="assocarray" />
            <field id="clazz" type="assocarray" />
            <field id="sTyped" type="string" />
            <field id="numTyped" type="integer" />
            <field id="numFloatTyped" type="float" />
            <field id="arrTyped" type="array" />
            <field id="aaTyped" type="assocarray" />
            </interface>
            <script type="text/brightscript" uri="pkg:/source/bslib.brs" />
            <children />
            </component>
            `);
            expect(a).to.equal(b);

            a = getContents('components/maestro/generated/Comp.brs');
            b = trimLeading(`'import "pkg:/source/comp.bs"

            function init()
            m.top.clazzTyped = invalid
            m.top.s = "string"
            m.top.num = 2
            m.top.numFloat = 2.5
            m.top.arr = [
            1,
            2,
            3
            ]
            m.top.aa = {
            id: "1"
            }
            m.top.clazz = invalid
            m.top.sTyped = invalid
            m.top.numTyped = invalid
            m.top.numFloatTyped = invalid
            m.top.arrTyped = invalid
            m.top.aaTyped = invalid
            instance = __Comp_builder()
            instance.delete("top")
            instance.delete("global")
            top = m.top
            m.append(instance)
            m.__isVMCreated = true
            m.new()
            m.top = top
            m_wireUpObservers()
            end function

            function m_wireUpObservers()
            end function

            function __m_setTopField(field, value)
            if m.top.doesExist(field) then
            m.top[field] = value
            end if
            return value
            end function`);
            expect(a).to.equal(b);

        });
        it('gives diagnostics for missing observer function params', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    public title = ""
                    public content = ""

                    function new()
                    end function
                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.not.empty;

        });
        it('does not produce diagnostics for missing observer function when extra validation is enabled', async () => {
            plugin.maestroConfig.extraValidation.doExtraValidation = false;
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    public title = ""
                    public content = ""

                    function new()
                    end function
                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;

        });
        it('gives diagnostics for wrong observer function params', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    public title = ""
                    public content = ""

                    function new()
                    end function

                    private function onTitleChange(too, manyParams)
                    end function

                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.not.empty;

        });
        it('gives diagnostics for wrong constructor function params', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    public title = ""
                    public content = ""

                    function new()
                    end function
                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.not.empty;

        });
        it('gives diagnostics for no constructor', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    @observer("onTitleChange")
                    public title = ""
                    public content = ""

                end class
            `);
            program.validate();
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.not.empty;

        });
    });
    describe('reflection', () => {

        it('adds __classname to all classes in a project', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/comp.bs', `
                @node("Comp", "Group")
                class Comp

                    public title = ""
                    public content = ""

                    function new()
                    end function
               end class
            `);
            program.addOrReplaceFile('source/myClass.bs', `
                class myClass
                    public title
                end class
                namespace myNamespace
                        class myNamespacedClass
                            public title
                        end class
                end namespace
            `);
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            let classFile = program.getFileByPkgPath<BrsFile>('source/myClass.bs');
            let cs = classFile.parser.references.classStatements[0];
            expect(cs.body.length === 3);
            expect(cs.fields.length === 2);
            expect(cs.memberMap['__className'].name.text === '__className');
            let a = getContents('source/myClass.brs');
            let b = trimLeading(`function __myClass_builder()
            instance = {}
            instance.new = sub()
            m.title = invalid
            m.__className = "myClass"
            end sub
            return instance
            end function
            function myClass()
            instance = __myClass_builder()
            instance.new()
            return instance
            end function
            function __myNamespace_myNamespacedClass_builder()
            instance = {}
            instance.new = sub()
            m.title = invalid
            m.__className = "myNamespace.myNamespacedClass"
            end sub
            return instance
            end function
            function myNamespace_myNamespacedClass()
            instance = __myNamespace_myNamespacedClass_builder()
            instance.new()
            return instance
            end function`);
            a = getContents('source/comp.brs');
            b = trimLeading(`function __Comp_builder()
            instance = {}
            instance.new = function()
            m.title = ""
            m.content = ""
            m.__classname = "Comp"
            end function
            return instance
            end function
            function Comp()
            instance = __Comp_builder()
            instance.new()
            return instance
            end function`);
            expect(a).to.equal(b);

        });

        it('does not add __classname if in parent class', async () => {
            plugin.afterProgramCreate(program);
            program.addOrReplaceFile('source/myClass.bs', `
                class ClassA
                    public title
                end class
                class ClassB extends ClassA
                    public title2
                end class
            `);
            await builder.transpile();
            expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            let classFile = program.getFileByPkgPath<BrsFile>('source/myClass.bs');
            let cs = classFile.parser.references.classStatements[0];
            expect(cs.body.length === 3);
            expect(cs.fields.length === 2);
            expect(cs.memberMap['__className'].name.text === '__className');
            let a = getContents('source/myClass.brs');
            let b = trimLeading(`function __ClassA_builder()
            instance = {}
            instance.new = sub()
            m.title = invalid
            m.__classname = "ClassA"
            end sub
            return instance
            end function
            function ClassA()
            instance = __ClassA_builder()
            instance.new()
            return instance
            end function
            function __ClassB_builder()
            instance = __ClassA_builder()
            instance.super0_new = instance.new
            instance.new = sub()
            m.super0_new()
            m.title2 = invalid
            end sub
            return instance
            end function
            function ClassB()
            instance = __ClassB_builder()
            instance.new()
            return instance
            end function`);
            expect(a).to.equal(b);
        });

        describe('extra validation', () => {

            it('gives diagostic for unknown field', () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    @strict
                    class VM
                        public fieldA
                        function doStuff()
                        m.fieldA = "ok"
                        m.fieldB = "notOk"
                        end function
                    end class
                `);
                program.validate();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.not.be.empty;
            });

            it('gives diagostic for unknown field; but skips valid skips', () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    @strict
                    class VM
                        public fieldA
                        function doStuff()
                        ? m.__className
                        m.__className = "foo"
                        ? m.doesExist("foo")
                        ? m.lookup("foo")
                        ? m.keys("foo")
                        ? m.count("foo")
                        end function
                    end class
                `);
                program.validate();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            });

            it('gives diagnostic for  unknown function', () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    @strict
                    class VM
                        function doStuff()
                        m.notThere()
                        end function

                        function other()
                        end function
                    end class
                `);
                program.validate();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.not.be.empty;
            });
            it('does not gives diagostic for field in superclass', () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    class VM
                        public isThere
                        protected isThereToo
                    end class
                `);

                program.addOrReplaceFile('source/SubVM.bs', `
                    class SubVM extends VM
                        function doStuff2()
                        m.isthere = true
                        m.isthereToo = true
                        end function
                    end class
                `);
                program.validate();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            });
            it('takes into account d files from roku modules', () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    class VM
                        public isThere
                    end class
                `);

                program.addOrReplaceFile('source/SubVM.bs', `
                    class SubVM extends VM
                        function doStuff2()
                        m.isthere = true
                        end function
                    end class
                `);
                program.validate();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            });

            it('does not gives diagnostic for function in superclass', () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    class VM
                        function there()
                        end function
                    end class
                `);

                program.addOrReplaceFile('source/SubVM.bs', `
                    class SubVM extends VM
                        function doStuff2()
                        m.there()
                        end function
                    end class
                `);
                program.validate();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
            });

        });
        describe('vms', () => {

            it('replaces m.value = with m.setField', async () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    @useSetField
                    class VM

                        public fieldA
                        public fieldB
                        private fieldC
                        function doStuff()
                            m.setField("fieldA", "val1")
                            m.fieldA = "val1"
                            m.fieldB = {this:"val2"}
                            m.fieldC = {this:"val1"}
                            m.notKnown = true
                            m.fieldA = something.getVAlues({this:"val1"}, "sdfd")
                        end function
                   end class
                `);
                await builder.transpile();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                let a = getContents('source/VM.brs');
                let b = trimLeading(`function __VM_builder()
                instance = {}
                instance.new = sub()
                m.fieldA = invalid
                m.fieldB = invalid
                m.fieldC = invalid
                m.__classname = "VM"
                end sub
                instance.doStuff = function()
                m.setField("fieldA", "val1")
                m.setField("fieldA", "val1")
                m.setField("fieldB", {
                this: "val2"
                })
                m.fieldC = {
                this: "val1"
                }
                m.notKnown = true
                m.setField("fieldA", something.getVAlues({
                this: "val1"
                }, "sdfd"))
                end function
                return instance
                end function
                function VM()
                instance = __VM_builder()
                instance.new()
                return instance
                end function`);
                expect(a).to.equal(b);
            });

            it('replaces m.value = with m.setField, when field is defined in super class', async () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    @useSetField
                    class VM

                        public fieldA
                        public fieldB
                        private fieldC
                        function doStuff()
                        end function
                   end class
                    class ChildVM extends VM
                        function doStuff()
                            m.setField("fieldA", "val1")
                            m.fieldA = "val1"
                            m.fieldB = {this:"val2"}
                            m.fieldC = {this:"val1"}
                            m.notKnown = true
                            m.fieldA = something.getVAlues({this:"val1"}, "sdfd")
                        end function
                   end class
                `);
                await builder.transpile();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                let a = getContents('source/VM.brs');
                let b = trimLeading(`function __VM_builder()
                instance = {}
                instance.new = sub()
                m.fieldA = invalid
                m.fieldB = invalid
                m.fieldC = invalid
                m.__classname = "VM"
                end sub
                instance.doStuff = function()
                end function
                return instance
                end function
                function VM()
                instance = __VM_builder()
                instance.new()
                return instance
                end function
                function __ChildVM_builder()
                instance = __VM_builder()
                instance.super0_new = instance.new
                instance.new = sub()
                m.super0_new()
                end sub
                instance.doStuff = function()
                m.setField("fieldA", "val1")
                m.setField("fieldA", "val1")
                m.setField("fieldB", {
                this: "val2"
                })
                m.fieldC = {
                this: "val1"
                }
                m.notKnown = true
                m.setField("fieldA", something.getVAlues({
                this: "val1"
                }, "sdfd"))
                end function
                return instance
                end function
                function ChildVM()
                instance = __ChildVM_builder()
                instance.new()
                return instance
                end function`);
                expect(a).to.equal(b);
            });
        });
        describe('ioc', () => {

            it('wires up fields with inject annotations', async () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    class VM
                        @inject("EntitleMents")
                        public fieldA
                        @injectClass("mc.collections.FieldMapper")
                        public fieldB
                   end class
                   namespace mc.collections
                    class FieldMapper
                    end class
                   end namespace
                `);
                program.validate();
                await builder.transpile();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                let a = getContents('source/VM.brs');
                let b = trimLeading(`function __VM_builder()
                instance = {}
                instance.new = sub()
                m.fieldA = mioc_getInstance("EntitleMents")
                m.fieldB = mioc_getClassInstance("mc.collections.FieldMapper")
                m.__classname = "VM"
                end sub
                return instance
                end function
                function VM()
                instance = __VM_builder()
                instance.new()
                return instance
                end function
                function __mc_collections_FieldMapper_builder()
                instance = {}
                instance.new = sub()
                m.__classname = "mc.collections.FieldMapper"
                end sub
                return instance
                end function
                function mc_collections_FieldMapper()
                instance = __mc_collections_FieldMapper_builder()
                instance.new()
                return instance
                end function`);
                expect(a).to.equal(b);
            });

            it('allows instantiation of class objects from annotation', async () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    class VM
                        @inject("Entitlements")
                        public fieldA
                        @createClass("ChildVM")
                        public fieldB
                        @createClass("ChildVM", arg1, arg2)
                        public fieldC
                    end class
                    class ChildVM extends VM
                    end class
                `);
                program.validate();
                await builder.transpile();
                expect(builder.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error)).to.be.empty;
                let a = getContents('source/VM.brs');
                let b = trimLeading(`function __VM_builder()
                instance = {}
                instance.new = sub()
                m.fieldA = mioc_getInstance("Entitlements")
                m.fieldB = mioc_createClassInstance("ChildVM")
                m.fieldC = mioc_createClassInstance("ChildVM")
                m.__classname = "VM"
                end sub
                return instance
                end function
                function VM()
                instance = __VM_builder()
                instance.new()
                return instance
                end function
                function __ChildVM_builder()
                instance = __VM_builder()
                instance.super0_new = instance.new
                instance.new = sub()
                m.super0_new()
                end sub
                return instance
                end function
                function ChildVM()
                instance = __ChildVM_builder()
                instance.new()
                return instance
                end function`);
                expect(a).to.equal(b);
            });

            it('gives diagnostics when the injection annotations are malformed', () => {
                plugin.afterProgramCreate(program);

                program.addOrReplaceFile('source/VM.bs', `
                    class VM
                        @inject()
                        public fieldA
                        @inject("")
                        public fieldB
                        @createClass("")
                        public fieldC
                        @createClass("notInScope")
                        public fieldD
                        @createClass("ChildVM", bad, values)
                        public fieldE
                    end class
                    class ChildVM extends VM
                    end class
                `);
                program.validate();
                let d = program.getDiagnostics().filter((d) => d.severity === DiagnosticSeverity.Error);
                expect(d).to.have.lengthOf(4);
                expect(d[0].code).to.equal('MSTO1042');
                expect(d[1].code).to.equal('MSTO1042');
                expect(d[2].code).to.equal('MSTO1042');
                expect(d[3].code).to.equal('MSTO1043');
            });
        });
    });
    describe.skip('run a local project (zp)', () => {
        it('sanity checks on parsing - only run this outside of ci', () => {
            let programBuilder = new ProgramBuilder();
            let config = {
                'rootDir': '/home/george/hope/applicaster/zapp-roku-app/src',
                'stagingFolderPath': '/home/george/hope/applicaster/zapp-roku-app/build',
                'retainStagingFolder': true,
                'createPackage': false,
                'autoImportComponentScript': true,
                'files': [
                    'manifest',
                    'source/**/*.*',
                    'components/**/*.*',
                    'images/**/*.*',
                    {
                        'src': '../external/plugins-src/**/*.*',
                        'dest': ''
                    },
                    {
                        'src': '../external/plugins-core-src/**/*.*',
                        'dest': ''
                    },
                    {
                        'src': '../external/private-emmys-src/**/*.*',
                        'dest': ''
                    },
                    {
                        'src': '../external/private-oc-src/**/*.*',
                        'dest': ''
                    },
                    {
                        'src': '!../external/plugins-src/**/*.spec.bs',
                        'dest': ''
                    },
                    {
                        'src': '!../external/plugins-core-src/**/*.spec.*',
                        'dest': ''
                    },
                    {
                        'src': '!../external/private-emmys-src/**/*.spec.*',
                        'dest': ''
                    },
                    {
                        'src': '!../external/private-oc-src/**/*.spec.*',
                        'dest': ''
                    },
                    '!**/*.spec.bs'
                ],
                'diagnosticFilters': [
                    {
                        'src': '**/roku_modules/**/*.*',
                        'codes': [
                            1107,
                            1009,
                            1001,
                            1067
                        ]
                    },
                    {
                        'src': '**/Whitelist.xml',
                        'codes': [
                            1067
                        ]
                    },
                    {
                        'src': 'components/maestro/generated/**/*.*',
                        'codes': [
                            1001
                        ]
                    },
                    1013,
                    {
                        'src': '../external/plugins-src/components/YouboraAnalytics/*.*'
                    },
                    {
                        'src': '../external/plugins-src/components/segment_analytics/*.*'
                    },
                    {
                        'src': '../external/plugins-src/source/segment_analytics/SegmentAnalytics.brs'
                    },
                    {
                        'src': '**/RALETrackerTask.*'
                    }
                ],
                'plugins': [
                    '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js'
                ],
                'rooibos': {
                    'isRecordingCodeCoverage': false,
                    'testsFilePattern': null
                },
                'maestro': {
                    'buildTimeImports': {
                        'IAuthProvider': [
                            'pkg:/source/inplayer_auth_plugin_roku/InPlayerAuthPlugin.bs'
                        ],
                        'IEntitlementsProvider': [
                            'pkg:/source/inplayer_entitlements_plugin/InPlayerEntitlementsPlugin.bs'
                        ],
                        'IBookmarksProvider': [],
                        'IPlayerAnalytics': [],
                        'IAnalytics': [
                            'pkg:/source/google_analytics_roku/GoogleAnalyticsPlugin.bs'
                        ]
                    }
                },
                'rokuLog': {
                    'strip': false,
                    'insertPkgPath': true
                },
                'sourceMap': true
            };
            programBuilder.run(
                config
            //     {
            //     project: '/home/george/hope/applicaster/zapp-roku-app/bsconfig-test.json'
            //     // project: '/home/george/hope/open-source/maestro/swerve-app/bsconfig-test.json'
            // }
            ).catch(e => {
                console.error(e);
            });
        });
    });
    describe('run a local project (s)', () => {
        it('sanity checks on parsing - only run this outside of ci', () => {
            let swv = {
                'stagingFolderPath': 'build',
                'rootDir': 'src',
                'files': [
                    'manifest',
                    'source/**/*.*',
                    'images/**/*.*',
                    'sounds/**/*.*',
                    'sounds/*.*',
                    'fonts/**/*.*',
                    'meta/**/*.*',
                    'components/**/*.*'
                ],
                'autoImportComponentScript': true,
                'createPackage': false,
                'diagnosticFilters': [
                    {
                        'src': '**/roku_modules/**/*.*'
                    },
                    {
                        'src': '**/Whitelist.xml',
                        'codes': [
                            1067
                        ]
                    },
                    {
                        'src': 'components/maestro/generated/**/*.*'
                    },
                    1013,
                    {
                        'src': '**/RALETrackerTask.*'
                    }
                ],
                'plugins': [
                    '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js',
                    '/home/george/hope/open-source/rooibos/bsc-plugin/dist/plugin.js'
                ],
                'maestro': {
                    'excludeFilters': [
                        '**/roku_modules/**/*',
                        '**/*BaseTestSuite*.bs'
                    ]
                },
                'rooibos': {
                    'isRecordingCodeCoverage': false,
                    'testsFilePattern': null
                },
                'rokuLog': {
                    'strip': false,
                    'insertPkgPath': true,
                    'removeComments': true
                },
                'logLevel': 'error'
            };
            let programBuilder = new ProgramBuilder();
            programBuilder.run(swv as any).catch(e => {
                console.error(e);
            });
        });
    });

    it('MV', () => {
        let config = {
            'rootDir': 'src',
            'files': [
                'manifest',
                'source/**/*.*',
                'components/**/*.*'
            ],
            'autoImportComponentScript': true,
            'createPackage': false,
            'stagingFolderPath': 'build',
            'diagnosticFilters': [
                {
                    'src': '**/roku_modules/**/*.*'
                },
                {
                    'src': '**/WhiteList.xml',
                    'codes': [
                        1067
                    ]
                },
                1120
            ],
            'emitDefinitions': true,
            'plugins': [
                '/home/george/hope/open-source/maestro/maestro-roku-bsc-plugin/dist/plugin.js',
                '/home/george/hope/open-source/rooibos/bsc-plugin/dist/plugin.js'
            ],
            'rooibos': {
                'isRecordingCodeCoverage': false,
                'testsFilePattern': null,
                'tags': [
                    '!integration',
                    '!deprecated',
                    '!fixme'
                ],
                'showOnlyFailures': true,
                'catchCrashes': true,
                'lineWidth': 70
            },
            'rokuLog': {
                'strip': false,
                'insertPkgPath': true
            },
            'sourceMap': true
        };
        let programBuilder = new ProgramBuilder();
        programBuilder.run(config as any).catch(e => {
            console.error(e);
        });

    });


});

function getContents(filename: string) {
    return trimLeading(fsExtra.readFileSync(s`${_stagingFolderPath}/${filename}`).toString());
}

function checkDiagnostic(d: BsDiagnostic, expectedCode: number, line?: number) {
    expect(d.code).is.equal(`MSTO${expectedCode}`);
    if (line) {
        expect(d.range.start.line).is.equal(line);
    }
}
