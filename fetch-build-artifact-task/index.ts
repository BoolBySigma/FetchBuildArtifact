import * as task from 'vsts-task-lib/task';
import * as process from 'process';
import * as request from 'request';

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

        let projectUri = process.env['SYSTEM_TEAMFOUNDATIONCOLLECTIONURI'] + project;
        task.debug('projectUri=' + projectUri);

        let authHeader = {
            'auth': {
                'bearer': 'bearerToken'
            }
        };

        let buildUri = projectUri + '/_apis/build/builds?definitions=' + definitionId + '&statusFilter=completed&resultFilter=succeeded&$top=1&api-version=2.0';
        request.get(buildUri, authHeader).on('response', function (response) {
            console.log(response);
        });


        //task.setResult(task.TaskResult.Failed, "Martin Nilsson");
        //task.error(process.env['SYSTEM_TEAMPROJECT']);
    } catch (error) {
        task.setResult(task.TaskResult.Failed, error.message);
    }
}

run();