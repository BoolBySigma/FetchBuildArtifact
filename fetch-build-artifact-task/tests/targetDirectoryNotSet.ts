import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');

let taskPath = path.join(__dirname, '..', 'index.js');
let runner: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

runner.setInput('project', 'MockProject');
runner.setInput('buildDefinitionId', '1');
runner.setInput('artifactName', 'drop');
//runner.setInput('targetDirectory', 'c:\\');

runner.run();