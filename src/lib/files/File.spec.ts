// import { expect } from 'chai';

// import { File } from './File';

// import { FileType } from './FileType';

// describe('File File', function() {
//   describe('Initialization', function() {
//     it('correctly sets directory', function() {
//       const file = new File('test.xml');
//       expect(file.fullPath).to.equal('test.xml');
//     });
//   });

//   describe('file types', function() {
//     it('correctly identifies type other', function() {
//       const file = new File('/fsPath/test.json');
//       expect(file.fileType).to.equal(FileType.Other);

//     });

//     it('correctly identifies type xml', function() {
//       const file = new File('test.xml');
//       expect(file.fileType).to.equal(FileType.Xml);

//     });

//     it('correctly identifies type brs', function() {
//       const file = new File('/fsPath/test.brs');
//       expect(file.fileType).to.equal(FileType.Brs);

//     });

//     it('correctly identifies type codebehind', function() {
//       const file = new File('test.brs');
//       file.associatedFile = new File('test.xml');
//       expect(file.fileType).to.equal(FileType.CodeBehind);
//     });

//     it('correctly identifies type codebehind bs', function() {
//       const file = new File('test.bs');
//       file.associatedFile = new File('test.xml');
//       expect(file.fileType).to.equal(FileType.CodeBehind);
//     });

//     it('correctly identifies type other - no extension', function() {
//       const file = new File('/fsPath/test');
//       expect(file.fileType).to.equal(FileType.Other);
//     });
//   });
// });
