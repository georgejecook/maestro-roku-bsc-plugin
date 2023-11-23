/* eslint-disable @typescript-eslint/no-unsafe-argument */
import type { XmlFile } from 'brighterscript';
import { BrsFile, Program } from 'brighterscript';
import { expect } from 'chai';

import { MaestroFile } from './MaestroFile';

import { FileType } from './FileType';
import { ProjectFileMap } from './ProjectFileMap';

describe('MaestroFile', () => {
    let projectFileMap;
    let program = new Program({});
    beforeEach(() => {
        projectFileMap = new ProjectFileMap();
    });
    describe('Initialization', () => {
        it('correctly sets directory', () => {
            const file = new MaestroFile(makeBrsFile('test.xml'), projectFileMap);
            expect(file.fullPath).to.equal('test.xml');
        });
    });

    describe('file types', () => {
        it('correctly identifies type other', () => {
            const file = new MaestroFile(makeBrsFile('/fsPath/test.json'), projectFileMap);
            expect(file.fileType).to.equal(FileType.Other);

        });

        it('correctly identifies type xml', () => {
            const file = new MaestroFile(makeBrsFile('test.xml'), projectFileMap);
            expect(file.fileType).to.equal(FileType.Xml);

        });

        it('correctly identifies type brs', () => {
            const file = new MaestroFile(makeBrsFile('/fsPath/test.brs'), projectFileMap);
            expect(file.fileType).to.equal(FileType.Brs);

        });

        it('correctly identifies type other - no extension', () => {
            const file = new MaestroFile(makeBrsFile('/fsPath/test'), projectFileMap);
            expect(file.fileType).to.equal(FileType.Other);
        });
    });


    describe.skip('reset diagnostics', () => {
        // it('only resets maestro diagnostics', () => {
        //     const file = new File(makeBrsFile('/fsPath/test.json'), projectFileMap);
        //     file.bscFile['diagnostics'] = [{ code: 'MSTO100' }, { code: '1004' }];
        //     file.resetDiagnostics();
        //     expect(file.bscFile['diagnostics']).to.have.lengthOf(1);
        //     expect(file.bscFile['diagnostics'][0].code).to.equal('1004');

        // });
        // it('only resets maestro diagnostics, and does not crash on number codes', () => {
        //     const file = new File(makeBrsFile('/fsPath/test.json'), projectFileMap);
        //     file.bscFile['diagnostics'] = [{ code: 'MSTO100' }, { code: 1004 }];
        //     file.resetDiagnostics();
        //     expect(file.bscFile['diagnostics']).to.have.lengthOf(1);
        //     expect((file.bscFile['diagnostics'][0].code)).to.equal(1004);

        // });
    });
    function makeBrsFile<T extends BrsFile | XmlFile>(path) {
        return new BrsFile({ srcPath: path, destPath: path, program: program });
    }

});
