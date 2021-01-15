const path = require('path');
const ProgramBuilder = require('brighterscript').ProgramBuilder;

let programBuilder = new ProgramBuilder();
programBuilder.run({
  // project: '/home/george/hope/open-source/maestro/maestro-roku-sample/bsconfig.json'
  project: path.join(__dirname, '../', 'test-project', 'bsconfig.json')
}).catch(e => {
  console.error(e);
});