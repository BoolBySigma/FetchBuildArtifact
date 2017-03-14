import * as task from 'vsts-task-lib/task';
import * as process from 'process';
import * as https from 'https';

import * as request from 'request';
import * as requestPromise from 'request-promise';

function stringIsNullOrEmpty(val: string): boolean {
    if (val === undefined || val === null || val.trim() === '') {
        return true;
    }
    return false;
};

async function run() {
    try {
        let project = task.getInput('project', false);
        if (stringIsNullOrEmpty(project)) {
            task.debug('project is null or empty');
            task.debug('project defaulting to ' + process.env['SYSTEM_TEAMPROJECT']);
            project = process.env['SYSTEM_TEAMPROJECT'];
            task.debug('project=' + process.env['SYSTEM_TEAMPROJECT']);
        }

        let buildDefinitionId = task.getInput('buildDefinitionId', true);
        let definitionId = Number(buildDefinitionId);
        if (Number.isNaN(definitionId)) {
            throw new Error('Build Definition Id must be a numerical value');
        }

        let artifactName = task.getInput('artifactName', true);

        let targetDirectory = task.getInput('targetDirectory', false);
        if (stringIsNullOrEmpty(targetDirectory)) {
            task.debug('targetDirectory is null or empty');
            task.debug('targetDirectory defaulting to ' + process.env['BUILD_SOURCESDIRECTORY']);
            targetDirectory = process.env['BUILD_SOURCESDIRECTORY'];
            task.debug('targetDirectory=' + process.env['BUILD_SOURCESDIRECTORY']);
        }

        let accountUri = process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'];
        task.debug('accountUri=' + accountUri);

        let projectUri = accountUri + project;
        task.debug('projectUri=' + projectUri);

        let authHeader = {
            'Authorization': {
                'Bearer': process.env['SYSTEM_ACCESSTOKEN']
            }
        };

        let buildsUri = projectUri + '/_apis/build/builds';
        task.debug('buildsUri=' + buildsUri);

        var buildsOptions = {
            uri: buildsUri,
            auth: {
                'bearer': process.env['SYSTEM_ACCESSTOKEN']
            },
            qs: {
                definitions: definitionId,
                statusFilter: 'completed',
                resultFilter: 'succeeded',
                $top: 1,
                'api-version': '2.0'
            },
            headers: authHeader,
            json: true
        };
        task.debug('buildsOption:');
        task.debug(JSON.stringify(buildsOptions));

        console.log('Querying completed successful builds of build definition\'' + definitionId + '\'');

        await requestPromise(buildsOptions)
            .then(function (builds: any[]) {
                if (builds.length === 0){
                    task.debug('no builds found for project');
                    throw new Error('Could not find project \'' + project + '\'. Make sure \'Allow Scripts to Access OAuth Token\' is enabled and that the project exists.');
                }

                let build = builds[0];
                task.debug('build:');
                task.debug(JSON.stringify(build));

                return build.id;
            })
            .then(function(buildId){
                console.log(buildId);
            })
            .then(function(){
                console.log('Done');
            });

    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
}

run();