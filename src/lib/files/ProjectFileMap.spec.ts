// import { expect } from 'chai';

// import { File } from './File';
// import { ProjectFileMap } from './ProjectFileMap';

// let config = require('../../test/testProcessorConfig.json');

// describe('Project File map', function() {
//   beforeEach(() => {
//   });

//   describe('Initialization', function() {
//     it('correctly initializes with default files and import dictionary', function() {
//       const fileMap = new ProjectFileMap();
//       expect(fileMap.allFiles).to.not.be.empty;
//       expect([...fileMap.allFiles.values()].length).to.equal(1);

//       // expect(getFeedbackErrors()).to.be.empty;
//     });

//     it('correctly initializes with preset files and import dictionary, which are used for unit testing', function() {
//       const file = new File('projectPath/filename.brs');
//       const fileMap = new ProjectFileMap();
//       fileMap.addFile(file);
//       expect(fileMap.allFiles.get('projectPath/filename.brs')).to.equal(file);
//     });
//   });

//   describe('addClass', function() {
//     let fileMap = new ProjectFileMap();
//     let namespace = null;

//     beforeEach(() => {
//     });

//     // it('adds class', function() {
//     //   fileMap.addClass('C1');
//     //   expect(fileMap.classNames.length).to.equal(1);
//     //   expect(fileMap.allClassNames.has('C1')).to.be.true;
//     //   // expect(getFeedbackErrors()).to.be.empty;
//     // });

//     // it('adds second class', function() {
//     //   fileMap.addClass('C1');
//     //   fileMap.addClass('C2');
//     //   expect(fileMap.classNames.length).to.equal(1);
//     //   expect(fileMap.allClassNames.has('C1')).to.be.true;
//     //   expect(fileMap.allClassNames.has('C2')).to.be.true;
//     //   // expect(getFeedbackErrors()).to.be.empty;
//     // });
//   });
// });
