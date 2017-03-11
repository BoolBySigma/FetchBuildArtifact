import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import * as process from 'process';

describe('FetchBuildArtifact', function () {

    describe('Input varible', function(){

        describe('project', function(){
            
            process.env['BUILD_SOURCESDIRECTORY'] = __dirname;
            process.env['SYSTEM_TEAMPROJECT'] = 'DefaultMockProject';
            
            it('should default to ' + process.env['SYSTEM_TEAMPROJECT'] + ' if not set', (done: MochaDone) => {
                this.timeout(1000);

                let testPath = path.join(__dirname, 'projectNotSet.js');
                let runner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

                runner.run();

                assert(runner.succeeded);
                assert.equal(runner.errorIssues.length, 0, "should not have any error issue");
                assert(runner.stdOutContained('project is null or empty'), 'should be null or empty');
                assert(runner.stdOutContained('project defaulting to ' + process.env['SYSTEM_TEAMPROJECT']), 'should default to ' + process.env['SYSTEM_TEAMPROJECT']);
                assert(runner.stdOutContained('project=' + process.env['SYSTEM_TEAMPROJECT']), 'should have been set to ' + process.env['SYSTEM_TEAMPROJECT']);

                done();
            });
        });

        describe('buildDefinitionId', function(){
            it('is required', (done: MochaDone) => {
                this.timeout(1000);

                let testPath = path.join(__dirname, 'buildDefinitionIdNotSet.js');
                let runner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

                runner.run();
                
                assert(runner.failed);
                assert.equal(runner.errorIssues.length, 1, "should fail with 1 error issue");
                assert(runner.createdErrorIssue('Input required: buildDefinitionId'));

                done();
            });

            it('must be a number', (done: MochaDone) => {
                this.timeout(1000);

                let testPath = path.join(__dirname, 'buildDefinitionIdNotNumeric.js');
                let runner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

                runner.run();
                
                assert(runner.failed);
                assert.equal(runner.errorIssues.length, 1, "should fail with 1 error issue");
                assert(runner.createdErrorIssue('Build Definition Id must be a numerical value'));

                done();
            });
        });

        describe('artifactName', function(){
            it('is required', (done: MochaDone) => {
                this.timeout(1000);

                let testPath = path.join(__dirname, 'artifactNameNotSet.js');
                let runner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

                runner.run();

                assert(runner.failed);
                assert.equal(runner.errorIssues.length, 1, "should fail with 1 error issue");
                assert(runner.createdErrorIssue('Input required: artifactName'));

                done();
            });
        });        

        describe('targetDirectory', function(){
            it('should default to ' + process.env['BUILD_SOURCESDIRECTORY'] + ' if not set', (done: MochaDone) => {
                this.timeout(1000);

                let testPath = path.join(__dirname, 'targetDirectoryNotSet.js');
                let runner: ttm.MockTestRunner = new ttm.MockTestRunner(testPath);

                runner.run();

                assert(runner.succeeded);
                assert.equal(runner.errorIssues.length, 0, "should not have any error issue");
                assert(runner.stdOutContained('targetDirectory is null or empty'), 'should be null or empty');
                assert(runner.stdOutContained('targetDirectory defaulting to ' + process.env['BUILD_SOURCESDIRECTORY']), 'should default to ' + process.env['BUILD_SOURCESDIRECTORY']);
                assert(runner.stdOutContained('targetDirectory=' + process.env['BUILD_SOURCESDIRECTORY']), 'should have been set to ' + process.env['BUILD_SOURCESDIRECTORY']);

                done();
            });
        });
    });
});