const path = require('path');
const ProgramBuilder = require('brighterscript').ProgramBuilder;

let programBuilder = new ProgramBuilder();
programBuilder.run({
  project: path.join(__dirname, '../', 'test', 'stubProject', 'bsconfig.json')
  // project: '/home/george/hope/applicaster/zapp-roku-app/bsconfig.json'
}).catch(e => {
  console.error(e);
});